import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { BallState, CaromState, Mode, Side } from "./game";
import * as C from "./constants";
import { fly, movePaddle, obstacle } from "./physics";
import { readMenus } from "./menus";
export const serveSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parked(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: serveSign(),
    trail: [],
  };
}
export function initialState(muted: boolean): CaromState {
  const p = { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: { ...p }, right: { ...p } },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parked(),
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function startMatch(s: CaromState, mode: Mode): CaromState {
  return {
    ...s,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parked(),
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
    obstacleClock: 0,
    obstacleClockRunning: true,
    obstacles: C.OBSTACLE_CENTERS.map((_, i) => obstacle(i, 0)),
  };
}
export function title(s: CaromState): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}
function paddles(
  s: CaromState,
  api: UpdateApi,
  dt: number,
): CaromState["paddles"] {
  const held = (action: C.ActionName) => api.input.value(action) > 0;
  const velocity = (side: Side): number => {
    const p = s.paddles[side];
    if (p.driven) return p.drivenVy;
    if (side === "right" && s.mode === "solo") {
      if (!s.ai.movement) return 0;
      const defending =
        s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0;
      const target =
        defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
      const diff = target - p.cy;
      return Math.abs(diff) <=
        (defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE) || dt <= 0
        ? 0
        : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
    }
    const up =
      side === "left"
        ? held("p1-up") || (s.mode === "solo" && held("p2-up"))
        : held("p2-up");
    const down =
      side === "left"
        ? held("p1-down") || (s.mode === "solo" && held("p2-down"))
        : held("p2-down");
    return (Number(down) - Number(up)) * C.PADDLE_SPEED;
  };
  return {
    left: movePaddle(s.paddles.left, velocity("left"), dt),
    right: movePaddle(s.paddles.right, velocity("right"), dt),
  };
}
export function update(
  state: DeepReadonly<CaromState>,
  api: UpdateApi,
  dt: number,
): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  ) as Record<C.ActionName, boolean>;
  api.audio.setMuted(edges.mute ? !state.muted : state.muted);
  let s: CaromState = {
    ...state,
    simTime: state.simTime + dt,
    muted: api.audio.muted(),
  };
  s = readMenus(s, api, edges);
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = { ...s, paddles: paddles(s, api, dt) };
  const cues = new Set<C.CueName>();
  let b = s.ball;
  if (b) {
    if (b.held || s.screen === "countdown") {
      const holdTimer = Math.max(0, b.holdTimer - dt);
      b = { ...b, x: C.FIELD_CX, y: C.FIELD_CY, holdTimer };
      if (holdTimer <= 0) {
        b = {
          ...b,
          held: false,
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
          trail: [],
        };
        s = { ...s, screen: "playing" };
      }
    } else b = fly(b, s, dt, cues);
    b = {
      ...b,
      trail: [
        ...b.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
        { x: b.x, y: b.y, t: s.simTime },
      ],
    };
    if (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0) {
      const left = b.x > C.FIELD_W,
        score = {
          p1: s.score.p1 + Number(left),
          p2: s.score.p2 + Number(!left),
        };
      cues.add(C.CUES.score);
      const won =
        Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
        Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
      s = {
        ...s,
        score,
        screen: won ? "matchover" : "countdown",
        winner: won ? (left ? "left" : "right") : null,
        menuIndex: won ? 0 : s.menuIndex,
        receiver: won ? s.receiver : left ? "right" : "left",
      };
      if (!won) b = parked();
    }
  }
  const obstacleClock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    ball: b,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
  };
  for (const cue of cues) api.audio.play(cue);
  return s;
}
