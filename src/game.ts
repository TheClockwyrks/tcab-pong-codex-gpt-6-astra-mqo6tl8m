import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { initialState, update } from "./simulation";
import { debug } from "./debug";
import { render } from "./render";
export type CaromDebugApi = typeof debug;
export const BACKGROUND = "#101c20";
export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  /** Transient menu gesture bookkeeping, discarded whenever a menu closes. */
  readonly menuPresses?: Readonly<Record<number, number>>;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;
}

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    api.audio.define(C.CUES.paddleHit, {
      freq: 480,
      freqTo: 260,
      durationMs: 75,
      wave: "triangle",
    });
    api.audio.define(C.CUES.wallBounce, {
      freq: 210,
      freqTo: 150,
      durationMs: 45,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      freq: 820,
      freqTo: 520,
      durationMs: 100,
      wave: "triangle",
    });
    api.audio.define(C.CUES.score, { freq: 330, freqTo: 660, durationMs: 240 });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    for (const side of ["left", "right"] as const)
      api.diagnostics.register(
        side,
        (s) =>
          `y ${s.paddles[side].cy.toFixed(1)} / vy ${s.paddles[side].vy.toFixed(1)}`,
      );
    api.diagnostics.register("ball position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "none",
    );
    api.diagnostics.register("speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : 0,
    );
    api.diagnostics.register("spin", (s) => s.ball?.spin ?? 0);
    return [initialState(false), debug];
  },
  update,
  render,
};
