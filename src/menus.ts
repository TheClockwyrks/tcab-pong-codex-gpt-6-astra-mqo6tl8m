import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { CaromState } from "./game";
import * as C from "./constants";
import { startMatch, title } from "./simulation";
export function items(s: CaromState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(
  s: CaromState,
  index: number,
): { x: number; y: number; w: number; h: number } | null {
  if (!Number.isInteger(index) || index < 0 || index >= items(s).length)
    return null;
  return s.screen === "title"
    ? { x: 92, y: 368 + index * 66, w: 370, h: 54 }
    : s.screen === "howto"
      ? { x: 92, y: 594, w: 370, h: 54 }
      : { x: 455, y: 365 + index * 66, w: 370, h: 54 };
}
function confirm(s: CaromState): CaromState {
  if (s.screen === "title") {
    s = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...s, screen: "howto", menuIndex: 0 }
      : startMatch(s, s.menuIndex === 0 ? "solo" : "versus");
  }
  if (s.screen === "howto") return title(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? startMatch(s, s.mode)
        : title(s);
  if (s.screen === "matchover")
    return s.menuIndex === 0 ? startMatch(s, s.mode) : title(s);
  return s;
}
export function readMenus(
  state: CaromState,
  api: UpdateApi,
  e: Record<C.ActionName, boolean>,
): CaromState {
  let s = state;
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  if (s.screen === "playing" || s.screen === "countdown")
    return e.pause
      ? { ...s, resumeScreen: s.screen, screen: "paused", menuIndex: 0 }
      : s;
  if (s.screen === "paused" && (e.pause || e.back))
    return { ...s, screen: s.resumeScreen };
  if ((s.screen === "howto" || s.screen === "matchover") && e.back)
    return title(s);
  const count = items(s).length;
  const up = e["p1-up"] || e["p2-up"],
    down = e["p1-down"] || e["p2-down"];
  if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
  else if (e.confirm) return confirm(s);
  const hit = (x: number, y: number) =>
    items(s).findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    });
  const presses = { ...s.menuPresses };
  for (const p of samples) {
    const index = hit(p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (p.type === "down") presses[p.id] = index;
    if (p.type === "up") {
      const matches = index >= 0 && presses[p.id] === index;
      delete presses[p.id];
      if (matches) return { ...confirm(s), menuPresses: {} };
    }
  }
  for (const p of contacts) {
    const index = hit(p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
  }
  return { ...s, menuPresses: presses };
}
