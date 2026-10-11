import type { DeepReadonly } from "ts-essentials";
import type {
  BallState,
  CaromState,
  Mode,
  PaddleState,
  Screen,
  Side,
} from "./game";
import { CAROM_DEBUG_VERSION } from "./constants";
import { initialState, parked, serveSign } from "./simulation";
import { obstacle } from "./physics";
import { menuItemRect } from "./menus";
type State = DeepReadonly<CaromState>;
function ball(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the playfield");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddle(s: State, side: Side, patch: Partial<PaddleState>): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export const debug = {
  version: CAROM_DEBUG_VERSION,
  clearWorld: (s: State): CaromState => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s: State): CaromState => ({ ...s, ball: parked() }),
  spawnObstacle: (s: State, index: number): CaromState => ({
    ...s,
    obstacles: [
      ...s.obstacles.filter((o) => o.index !== index),
      obstacle(index, s.obstacleClock),
    ].sort((a, b) => a.index - b.index),
  }),
  reset: (s: State): CaromState => initialState(s.muted),
  reconcile: (s: State): CaromState => ({
    ...s,
    obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
  }),
  setScreen: (s: State, screen: Screen): CaromState => ({ ...s, screen }),
  setMode: (s: State, mode: Mode): CaromState => ({ ...s, mode }),
  setMenuIndex: (s: State, menuIndex: number): CaromState => ({
    ...s,
    menuIndex,
  }),
  setTitleIndex: (s: State, titleIndex: number): CaromState => ({
    ...s,
    titleIndex,
  }),
  setResumeScreen: (
    s: State,
    resumeScreen: "countdown" | "playing",
  ): CaromState => ({ ...s, resumeScreen }),
  setScore: (s: State, p1: number, p2: number): CaromState => ({
    ...s,
    score: { p1, p2 },
  }),
  setWinner: (s: State, winner: Side | null): CaromState => ({ ...s, winner }),
  setReceiver: (s: State, receiver: Side): CaromState => ({ ...s, receiver }),
  setPaddleCy: (s: State, side: Side, cy: number): CaromState =>
    paddle(s, side, { cy }),
  setPaddleVy: (s: State, side: Side, drivenVy: number): CaromState =>
    paddle(s, side, { drivenVy }),
  setPaddleDriven: (s: State, side: Side, driven: boolean): CaromState =>
    paddle(s, side, { driven }),
  setBallPosition: (s: State, x: number, y: number): CaromState =>
    ball(s, { x, y }),
  setBallVelocity: (s: State, vx: number, vy: number): CaromState =>
    ball(s, { vx, vy }),
  setBallSpin: (s: State, spin: number): CaromState => ball(s, { spin }),
  setBallHeld: (s: State, held: boolean): CaromState => ball(s, { held }),
  setBallHoldTimer: (s: State, holdTimer: number): CaromState =>
    ball(s, { holdTimer }),
  setBallServeSign: (s: State, sign: 1 | -1): CaromState =>
    ball(s, { serveSign: sign }),
  drawBallServeSign: (s: State): CaromState =>
    ball(s, { serveSign: serveSign() }),
  setAiTracking: (s: State, tracking: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, tracking },
  }),
  setAiMovement: (s: State, movement: boolean): CaromState => ({
    ...s,
    ai: { ...s.ai, movement },
  }),
  setMuted: (s: State, muted: boolean): CaromState => ({ ...s, muted }),
  setObstacleClock: (s: State, obstacleClock: number): CaromState => ({
    ...s,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
  }),
  setObstacleClockRunning: (
    s: State,
    obstacleClockRunning: boolean,
  ): CaromState => ({ ...s, obstacleClockRunning }),
  snapshot: (s: State) => {
    const { menuPresses: _presses, ...declared } = s;
    return {
      ...structuredClone(declared),
      version: CAROM_DEBUG_VERSION,
      ball: s.ball
        ? {
            ...structuredClone(s.ball),
            speed: Math.hypot(s.ball.vx, s.ball.vy),
          }
        : null,
    };
  },
  menuItemRect,
};
