# Carom

A browser paddle duel about spin, timing, and bank shots. Play against the
computer or share a keyboard with a friend. Moving your paddle at contact curves
the ball; two swaying, rotating obstacles turn each rally into a new angle to
read. First to 11 wins, with a two-point lead.

All graphics are drawn on canvas and sound is synthesized by the Simple 2D
engine. No backend, accounts, downloaded assets, or runtime services are needed.

## Run

```sh
npm ci
npm run dev
```

Open the local address Vite prints. To build the static site:

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` at the root of any static server. The build needs
no additional generation step.

## Controls

| Action | Keys |
| --- | --- |
| Solo paddle | W / S or ↑ / ↓ |
| Versus left paddle | W / S |
| Versus right paddle | ↑ / ↓ |
| Menu selection | W / S or ↑ / ↓ |
| Confirm | Enter or Space |
| Pause / resume | P or Escape |
| Back | Escape |
| Toggle sound | M |
| Engine diagnostics | Backtick |

Menus also support mouse and touch. On a touchscreen, the engine presents two
vertical paddle controls and menu buttons. A moving paddle imparts spin; contact
near its ends makes a steeper shot. Paddle hits accelerate the ball, while wall
and obstacle banks preserve its speed.

## Development

The simulation is independent of rendering. The engine owns input, audio, canvas
fitting, the frame clock, diagnostics, and recording. `game.initialize` returns
the complete state and a debug API for arranging reproducible scenarios through
`engine.apply`. Tests use real engine frames with an in-process canvas.

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The player description, screenshots, and six-second engine replay are in
[`showcase/`](showcase/showcase.md).
