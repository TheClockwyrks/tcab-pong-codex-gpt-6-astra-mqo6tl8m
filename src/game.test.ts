import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type CaromState } from "./game";
import * as C from "./constants";
import { debug } from "./debug";
const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn());
});
async function setup(step = 8) {
  const events = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  cleanup.push(() => engine.destroy());
  const key = (code: string, down = true) =>
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pointer = (type: string, x: number, y: number, device = "mouse") =>
    events.dispatchEvent(
      Object.assign(new Event(type), {
        clientX: x,
        clientY: y,
        pointerId: 1,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
      }),
    );
  const pose = (fn: (s: CaromState) => CaromState) => engine.apply(fn);
  const live = (x = 640, y = 360, vx = 520, vy = 0) =>
    pose((s) => ({
      ...debug.clearWorld(s),
      screen: "playing",
      mode: "versus",
      ball: { ...debug.spawnBall(s).ball!, held: false, x, y, vx, vy },
    }));
  return { engine, key, tap, pointer, pose, live };
}
describe("engine integration and input", () => {
  it("initializes the complete world and pure diagnostics", async () => {
    const { engine } = await setup();
    expect(engine.debug.version).toBe(C.CAROM_DEBUG_VERSION);
    const before = engine.debug.snapshot(engine.state);
    expect(before.screen).toBe("title");
    expect(before.ball?.held).toBe(true);
    expect(before.obstacles).toHaveLength(2);
    expect(engine.diagnostics().every((r) => !r.error)).toBe(true);
    expect(engine.debug.snapshot(engine.state)).toEqual(before);
    await engine.advance(2);
    expect(engine.state.simTime).toBeCloseTo(0.016);
    expect(engine.state.obstacleClock).toBe(0);
  });
  it("navigates with edge priority, remembers title, and freezes pause", async () => {
    const { engine, key, tap, pose } = await setup();
    key("KeyW");
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(2);
    expect(engine.state.screen).toBe("title");
    ["KeyW", "KeyS", "Enter"].forEach((k) => key(k, false));
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.menuIndex).toBe(2);
    await tap("ArrowUp");
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    const before = engine.state;
    await tap("Escape");
    await engine.advance(3);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.ball).toEqual(before.ball);
    expect(engine.state.obstacleClock).toBe(before.obstacleClock);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
    pose((s) => debug.setScreen(s, "paused"));
    pose((s) => debug.setMenuIndex(s, 2));
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it.each(["mouse", "touch"])(
    "matches both %s edges to the same menu item",
    async (device) => {
      const { engine, pointer } = await setup();
      const a = debug.menuItemRect(engine.state, 0)!,
        b = debug.menuItemRect(engine.state, 1)!;
      pointer("pointerdown", a.x + 20, a.y + 20, device);
      await engine.advance(1);
      pointer("pointerup", b.x + 20, b.y + 20, device);
      await engine.advance(1);
      expect(engine.state.screen).toBe("title");
      pointer("pointerdown", b.x + 20, b.y + 20, device);
      await engine.advance(1);
      pointer("pointerup", b.x + 20, b.y + 20, device);
      await engine.advance(1);
      expect(engine.state.mode).toBe("versus");
      expect(engine.state.screen).toBe("countdown");
    },
  );
  it("serves on the expired hold frame without advancing flight", async () => {
    const { engine, pose, key } = await setup(10);
    pose((s) => debug.setScreen(s, "countdown"));
    pose((s) => debug.setBallHoldTimer(s, 0.01));
    pose((s) => debug.setBallServeSign(s, -1));
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vy).toBeLessThan(0);
    expect(engine.state.ball?.vx).toBeLessThan(0);
    expect(engine.state.paddles.left.cy).toBeGreaterThan(C.FIELD_CY);
    expect(engine.state.screen).toBe("playing");
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("integrates actual driven velocity at bounds without changing driver demand", async () => {
    const { engine, pose, live } = await setup(10);
    live();
    pose((s) => debug.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2));
    pose((s) => debug.setPaddleVy(s, "left", C.PADDLE_SPEED));
    pose((s) => debug.setPaddleDriven(s, "left", true));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBeCloseTo(200);
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
  });
  it("gates AI senses and movement independently", async () => {
    const { engine, pose, live } = await setup();
    live(900, 560, 400, 0);
    pose((s) => debug.setMode(s, "solo"));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => debug.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    pose((s) => debug.setAiMovement(s, true));
    pose((s) => debug.setAiTracking(s, false));
    pose((s) => debug.setPaddleCy(s, "right", 600));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
});
describe("contacts, spin and scoring", () => {
  it.each(["left", "right"] as const)(
    "accelerates a %s paddle hit and adds motion spin",
    async (side) => {
      const { engine, pose, live } = await setup(8);
      const left = side === "left";
      live(
        left ? C.P1_X1 + C.BALL_R + 2 : C.P2_X0 - C.BALL_R - 2,
        360,
        left ? -520 : 520,
        0,
      );
      pose((s) => debug.setPaddleDriven(s, side, true));
      pose((s) => debug.setPaddleVy(s, side, 300));
      const cues: string[] = [];
      engine.events.on("cue:played", (e) => cues.push(e.cue));
      const before = engine.state;
      await engine.advance(1);
      expect(Math.sign(engine.state.ball!.vx)).toBe(left ? 1 : -1);
      expect(
        Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
      ).toBeCloseTo(520 * C.SPEED_MULT);
      expect(engine.state.ball!.spin).toBeGreaterThan(250);
      expect(cues).toEqual([C.CUES.paddleHit]);
      expect(before.ball!.spin).toBe(0);
    },
  );
  it("reflects walls and end caps without changing speed", async () => {
    const { engine, live } = await setup();
    live(300, C.BALL_R + 1, 0, -520);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(520);
    live(
      (C.P1_X0 + C.P1_X1) / 2,
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      0,
      520,
    );
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-520);
  });
  it("reflects tilted faces and preserves spin except decay", async () => {
    const { engine, live, pose } = await setup(2);
    live();
    pose((s) => debug.spawnObstacle(s, 0));
    pose((s) => debug.setObstacleClock(s, 0.75));
    pose((s) => debug.setObstacleClockRunning(s, false));
    const o = engine.state.obstacles[0];
    const nx = Math.cos(o.theta),
      ny = Math.sin(o.theta);
    pose((s) => debug.setBallPosition(s, o.cx + nx * 22, o.cy + ny * 22));
    pose((s) => debug.setBallVelocity(s, -520 * nx, -520 * ny));
    pose((s) => debug.setBallSpin(s, 100));
    await engine.advance(2);
    expect(
      engine.state.ball!.vx * nx + engine.state.ball!.vy * ny,
    ).toBeGreaterThan(500);
    expect(engine.state.ball!.spin).toBeCloseTo(
      100 * Math.pow(0.5, 0.004 / C.SPIN_HALFLIFE),
    );
  });
  it("curves flight at constant speed and keeps only recent trail", async () => {
    const { engine, live, pose } = await setup();
    live(300, 300, 520, 0);
    pose((s) => debug.setBallSpin(s, 600));
    await engine.advance(30);
    expect(engine.state.ball!.vy).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520);
    expect(
      engine.state.ball!.trail.every(
        (p) => engine.state.simTime - p.t <= C.TRAIL_TIME,
      ),
    ).toBe(true);
  });
  it("parks after points and enforces the two-point lead", async () => {
    const { engine, live, pose } = await setup();
    live(C.FIELD_W + C.BALL_R + 1, 300, 520, 0);
    pose((s) => debug.setScore(s, 10, 10));
    await engine.advance(1);
    expect(engine.state.score).toEqual({ p1: 11, p2: 10 });
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball!.trail).toEqual([]);
    live(C.FIELD_W + C.BALL_R + 1, 300, 520, 0);
    await engine.advance(1);
    expect(engine.state.winner).toBe("left");
    expect(engine.state.screen).toBe("matchover");
  });
  it("agrees across 2ms and 16ms on a wall and paddle rally", async () => {
    const results = [];
    for (const step of [2, 16]) {
      const { engine, live, pose } = await setup(step);
      live(240, 360, -600, -100);
      pose((s) => debug.setPaddleCy(s, "left", 330));
      await engine.advance(800 / step);
      results.push(debug.snapshot(engine.state));
    }
    expect(results[0].score).toEqual(results[1].score);
    expect(
      Math.abs(results[0].ball!.speed - results[1].ball!.speed),
    ).toBeLessThan(10);
    expect(Math.sign(results[0].ball!.vx)).toBe(Math.sign(results[1].ball!.vx));
  });
});
describe("debug operations", () => {
  it("poses fields independently, fails on missing entities, and resets", async () => {
    const { engine, pose } = await setup();
    pose((s) => debug.clearWorld(s));
    expect(() => debug.setBallSpin(engine.state, 1)).toThrow();
    expect(() => debug.spawnObstacle(engine.state, 2)).toThrow();
    pose((s) => debug.spawnBall(s));
    pose((s) => debug.setBallPosition(s, 100, 200));
    pose((s) => debug.setBallVelocity(s, 3, 4));
    pose((s) => debug.setBallSpin(s, 42));
    pose((s) => debug.setBallHeld(s, false));
    pose((s) => debug.setBallHoldTimer(s, 0.3));
    pose((s) => debug.setBallServeSign(s, -1));
    const before = debug.snapshot(engine.state);
    pose(debug.reconcile);
    expect(debug.snapshot(engine.state)).toEqual(before);
    expect(before.ball?.speed).toBe(5);
    pose((s) => debug.spawnObstacle(s, 1));
    pose((s) => debug.setObstacleClock(s, 1));
    expect(engine.state.obstacles[0].theta).toBe(C.OBSTACLE_SPIN_RATE);
    pose((s) => debug.setWinner(s, "right"));
    pose((s) => debug.setReceiver(s, "right"));
    pose((s) => debug.setTitleIndex(s, 2));
    pose((s) => debug.setResumeScreen(s, "countdown"));
    pose((s) => debug.setMuted(s, true));
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    pose(debug.reset);
    expect(engine.state.simTime).toBe(0);
    expect(engine.state.titleIndex).toBe(0);
    expect(engine.state.muted).toBe(true);
    expect(engine.state.obstacles).toHaveLength(2);
    pose(debug.drawBallServeSign);
    expect([-1, 1]).toContain(engine.state.ball!.serveSign);
  });
  it("draws every screen with absent entities and menu regions", async () => {
    const { engine, pose, tap } = await setup();
    pose(debug.clearWorld);
    for (const screen of [
      "title",
      "howto",
      "paused",
      "matchover",
      "countdown",
      "playing",
    ] as const) {
      pose((s) => debug.setScreen(s, screen));
      await engine.advance(1);
      expect(debug.menuItemRect(engine.state, 99)).toBeNull();
    }
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
  });
});
