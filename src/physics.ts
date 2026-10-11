import * as C from "./constants";
import type { BallState, CaromState, ObstacleState, PaddleState } from "./game";
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
export function obstacle(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new RangeError("Unknown obstacle index");
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function movePaddle(
  p: PaddleState,
  velocity: number,
  dt: number,
): PaddleState {
  const raw = p.cy + velocity * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : velocity };
}
type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
function paddle(
  b: MovingBall,
  p: PaddleState,
  left: boolean,
  cues: Set<C.CueName>,
): void {
  const x0 = left ? C.P1_X0 : C.P2_X0,
    x1 = left ? C.P1_X1 : C.P2_X1;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (p.cy - C.PADDLE_HALF - C.BALL_R),
    p.cy + C.PADDLE_HALF + C.BALL_R - b.y,
  ];
  if (depths.some((d) => d <= 0)) return;
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    const angle =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (left ? 1 : -1) * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    cues.add(C.CUES.paddleHit);
  } else {
    b.y = p.cy + (face === 2 ? -1 : 1) * (C.PADDLE_HALF + C.BALL_R);
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
  }
}
function bank(b: MovingBall, o: ObstacleState, cues: Set<C.CueName>): void {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta),
    dx = b.x - o.cx,
    dy = b.y - o.cy;
  const x = dx * c + dy * s,
    y = -dx * s + dy * c;
  const qx = clamp(x, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(y, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const distance = Math.hypot(x - qx, y - qy);
  if (distance >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (distance > 0) {
    nx = (x - qx) / distance;
    ny = (y - qy) / distance;
    push = C.BALL_R - distance;
  } else if (C.OBSTACLE_HW - Math.abs(x) <= C.OBSTACLE_HH - Math.abs(y)) {
    nx = x < 0 ? -1 : 1;
    ny = 0;
    push = C.BALL_R + C.OBSTACLE_HW - Math.abs(x);
  } else {
    nx = 0;
    ny = y < 0 ? -1 : 1;
    push = C.BALL_R + C.OBSTACLE_HH - Math.abs(y);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c,
    dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
/** Pure simulation; obstacles keep their frame-start pose through all substeps. */
export function fly(
  ball: BallState,
  state: CaromState,
  dt: number,
  cues: Set<C.CueName>,
): BallState {
  const b = { ...ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy),
      angle = speed > 0 ? (b.spin / speed) * h : 0;
    const vx = b.vx * Math.cos(angle) - b.vy * Math.sin(angle);
    b.vy = b.vx * Math.sin(angle) + b.vy * Math.cos(angle);
    b.vx = vx;
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y < C.BALL_R && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y > C.FIELD_H - C.BALL_R && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    paddle(b, state.paddles.left, true, cues);
    paddle(b, state.paddles.right, false, cues);
    for (const o of state.obstacles) bank(b, o, cues);
  }
  return b;
}
