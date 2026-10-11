import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./menus";
const INK = "#101c20",
  WHITE = "#edf2e4",
  MINT = "#aaf0ca",
  CORAL = "#ff8c78",
  GOLD = "#e9bb69",
  MUTED = "#81968f",
  LINE = "#2c4043";
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = WHITE,
  align: CanvasTextAlign = "left",
  weight = 400,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size < 20 ? "monospace" : "Arial, sans-serif"}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x1: number,
  y1: number,
  color = LINE,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 6));
  ctx.fill();
}
function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function court(s: CaromState, ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, C.FIELD_W - 48, C.FIELD_H - 48);
  ctx.setLineDash([5, 13]);
  line(ctx, C.NET_X, 26, C.NET_X, C.FIELD_H - 26);
  ctx.setLineDash([]);
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 84, 0, Math.PI * 2);
  ctx.stroke();
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.strokeStyle = "#5e533c";
    ctx.strokeRect(
      -C.OBSTACLE_HW - 5,
      -C.OBSTACLE_HH - 5,
      C.OBSTACLE_W + 10,
      C.OBSTACLE_H + 10,
    );
    bar(ctx, -C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, GOLD);
    dot(ctx, 0, 0, 3, INK);
    ctx.restore();
  }
  for (const side of ["left", "right"] as const) {
    const p = s.paddles[side],
      x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? MINT : CORAL;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    bar(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color);
    ctx.restore();
  }
}

/** Draw the ball above the score furniture so it never disappears behind it. */
function drawBall(s: CaromState, ctx: CanvasRenderingContext2D): void {
  const b = s.ball;
  if (b) {
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      ctx.globalAlpha =
        Math.max(0, 1 - (s.simTime - p.t) / C.TRAIL_TIME) * 0.55;
      ctx.strokeStyle = MINT;
      ctx.lineWidth = (C.BALL_R * 2 * i) / b.trail.length;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = WHITE;
    dot(ctx, b.x, b.y, C.BALL_R, WHITE);
    ctx.restore();
    if (Math.abs(b.spin) > 35) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        C.BALL_R + 6,
        s.simTime * 5,
        s.simTime * 5 + Math.PI * 1.3,
      );
      ctx.stroke();
    }
  }
}
function menu(s: CaromState, ctx: CanvasRenderingContext2D): void {
  items(s).forEach((item, i) => {
    const r = menuItemRect(s, i)!,
      selected = i === s.menuIndex;
    if (selected) {
      bar(ctx, r.x, r.y, r.w, r.h, MINT);
    } else {
      ctx.strokeStyle = LINE;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      12,
      selected ? "#355346" : MUTED,
    );
    text(
      ctx,
      item,
      r.x + 61,
      r.y + r.h / 2,
      18,
      selected ? INK : WHITE,
      "left",
      600,
    );
    text(
      ctx,
      selected ? "↗" : "→",
      r.x + r.w - 28,
      r.y + r.h / 2,
      23,
      selected ? INK : MUTED,
    );
  });
}
function footer(s: CaromState, ctx: CanvasRenderingContext2D): void {
  line(ctx, 92, 663, 1188, 663);
  text(ctx, "A GAME OF ANGLES & INSTINCT", 92, 686, 11, MUTED);
  text(
    ctx,
    `M  SOUND ${s.muted ? "OFF" : "ON"}     /     P  PAUSE`,
    1188,
    686,
    11,
    MUTED,
    "right",
  );
}
function titleArt(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(650, 142);
  text(ctx, "THE COURT / 01", 0, -42, 12, MUTED);
  ctx.strokeStyle = LINE;
  ctx.strokeRect(0, 0, 535, 450);
  for (let y = 18; y < 450; y += 22) dot(ctx, 267, y, 1.5, LINE);
  bar(ctx, 28, 210, 12, 92, MINT);
  bar(ctx, 495, 130, 12, 92, CORAL);
  for (const [x, y, a] of [
    [175, 145, -0.45],
    [362, 300, 0.55],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    bar(ctx, -8, -55, 16, 110, GOLD);
    dot(ctx, 0, 0, 3, INK);
    ctx.restore();
  }
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(42, 245);
  ctx.bezierCurveTo(120, 160, 125, 320, 305, 190);
  ctx.bezierCurveTo(400, 120, 360, 60, 477, 72);
  ctx.stroke();
  ctx.strokeStyle = "#304c46";
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(305, 190);
  ctx.lineTo(420, 286);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.shadowColor = MINT;
  ctx.shadowBlur = 26;
  dot(ctx, 477, 72, 12, WHITE);
  ctx.restore();
  text(ctx, "PUT A LITTLE", 32, 372, 12, MUTED);
  text(ctx, "SPIN ON IT.", 32, 409, 35, MINT, "left", 700);
  text(ctx, "↗", 478, 399, 50, GOLD, "center");
  ctx.restore();
}
export function render(s: DeepReadonly<CaromState>, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  if (s.screen === "title") {
    text(ctx, "C /", 92, 70, 24, MINT, "left", 700);
    text(ctx, "INDEPENDENT ARCADE   /   VOL. 01", 151, 70, 12, MUTED);
    text(ctx, C.TITLE_TEXT, 85, 207, 112, WHITE, "left", 800);
    text(ctx, "Find your angle.", 92, 291, 26, MINT);
    text(ctx, "A paddle duel with a twist.", 92, 326, 16, MUTED);
    menu(s, ctx);
    text(ctx, "↑ ↓  SELECT     ENTER  PLAY", 92, 601, 12, MUTED);
    titleArt(ctx);
    footer(s, ctx);
  } else if (s.screen === "howto") {
    text(ctx, "FIELD NOTES / HOW TO PLAY", 92, 76, 13, MINT);
    text(ctx, "Make the angle yours.", 88, 151, 56, WHITE, "left", 700);
    const notes = [
      [
        "01",
        "MOVE",
        "SOLO: W / S or ↑ / ↓",
        "VERSUS: W / S left · ↑ / ↓ right",
      ],
      [
        "02",
        "BEND",
        "Move your paddle as you strike.",
        "Your motion adds spin to the ball.",
      ],
      [
        "03",
        "BANK",
        "Gold obstacles sway and rotate.",
        "Use their tilted faces for bank shots.",
      ],
    ];
    notes.forEach((n, i) => {
      const x = 92 + i * 380;
      line(ctx, x, 231, x + 333, 231);
      text(ctx, n[0], x, 265, 14, GOLD);
      text(ctx, n[1], x, 313, 30, MINT, "left", 700);
      text(ctx, n[2], x, 362, 14, WHITE);
      text(ctx, n[3], x, 391, 14, MUTED);
    });
    text(
      ctx,
      `FIRST TO ${C.WIN_SCORE} · WIN BY ${C.WIN_LEAD}`,
      92,
      478,
      22,
      WHITE,
      "left",
      600,
    );
    text(
      ctx,
      "Pass the far edge to score. Each paddle hit makes the rally faster.",
      92,
      520,
      16,
      MUTED,
    );
    menu(s, ctx);
    footer(s, ctx);
  } else {
    court(s, ctx);
    ctx.fillStyle = INK;
    ctx.fillRect(444, 25, 392, 106);
    text(
      ctx,
      s.mode === "solo" ? "YOU" : "PLAYER 01",
      540,
      47,
      11,
      MINT,
      "center",
    );
    text(
      ctx,
      s.mode === "solo" ? "COMPUTER" : "PLAYER 02",
      740,
      47,
      11,
      CORAL,
      "center",
    );
    text(
      ctx,
      String(s.score.p1).padStart(2, "0"),
      540,
      93,
      54,
      MINT,
      "center",
      700,
    );
    text(
      ctx,
      String(s.score.p2).padStart(2, "0"),
      740,
      93,
      54,
      CORAL,
      "center",
      700,
    );
    text(ctx, "/", C.FIELD_CX, 88, 22, MUTED, "center");
    text(
      ctx,
      `${s.mode === "solo" ? "SOLO / HUMAN VS MACHINE" : "VERSUS / LOCAL DUEL"}   ·   FIRST TO ${C.WIN_SCORE}`,
      92,
      50,
      11,
      MUTED,
    );
    text(ctx, "CAROM", 1188, 50, 18, WHITE, "right", 700);
    text(ctx, "W / S", 92, 685, 11, MINT);
    text(
      ctx,
      s.mode === "solo" ? "AI" : "↑ / ↓",
      1188,
      685,
      11,
      CORAL,
      "right",
    );
    text(
      ctx,
      `P  PAUSE   /   M  SOUND ${s.muted ? "OFF" : "ON"}`,
      C.FIELD_CX,
      685,
      11,
      MUTED,
      "center",
    );
    drawBall(s, ctx);
    if (s.screen === "countdown") {
      text(ctx, "GET READY", C.FIELD_CX, 286, 15, MINT, "center");
      const progress = 1 - (s.ball?.holdTimer ?? C.HOLD_TIME) / C.HOLD_TIME;
      ctx.strokeStyle = MINT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        C.FIELD_CX,
        C.FIELD_CY,
        34,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
      );
      ctx.stroke();
      text(
        ctx,
        `SERVING ${s.receiver === "left" ? "← LEFT" : "RIGHT →"}`,
        C.FIELD_CX,
        428,
        12,
        MUTED,
        "center",
      );
    }
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#101c20df";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      ctx.fillStyle = INK;
      ctx.fillRect(410, 170, 460, 440);
      ctx.strokeStyle = LINE;
      ctx.strokeRect(410, 170, 460, 440);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        215,
        12,
        GOLD,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : `${s.winner === "left" ? "PLAYER 01" : "PLAYER 02"} WINS`,
        C.FIELD_CX,
        275,
        s.screen === "paused" ? 54 : 35,
        WHITE,
        "center",
        700,
      );
      text(
        ctx,
        s.screen === "paused"
          ? "Your next angle can wait."
          : `${s.score.p1}  —  ${s.score.p2}`,
        C.FIELD_CX,
        322,
        18,
        MUTED,
        "center",
      );
      menu(s, ctx);
    }
  }
  ctx.restore();
}
