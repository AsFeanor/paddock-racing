# Paddock repository guide

## Project and boundaries

- Vue 3 Composition API, TypeScript, Pinia, Vite and Three.js; custom CSS, no backend.
- Use Node.js 22.12+; CI and Netlify use Node.js 24. See `README.md` for setup and design decisions.
- Keep pure race rules in `src/domain/race.ts`, transitions in `src/stores/race.ts`, and browser timing in `src/composables/useRaceClock.ts`.
- `RaceExperience.vue` coordinates presentation; `RaceScene.vue` and `RaceTrack.vue` render the same Pinia race state.
- Preserve the single-session scope. Discuss new services, dependencies or persistence before adding them.

## Commands and verification

- Install: `npm ci`. Develop: `npm run dev`. Production preview: `npm run build` then `npm run preview`.
- Type checking and production build: `npm run build`. Domain, store and scene-helper tests: `npm test`.
- Browser setup: `npx playwright install chromium` (`--with-deps` on Linux when system dependencies are missing).
- Build first, then run `npm run test:e2e` for desktop/mobile behavior or `npm run test:visual` for layout comparisons.
- Visual baselines use Ubuntu 24.04/Chromium, seeded data, Classic view and system font fallbacks. Review intentional changes before updating references with `npm run test:visual:update`.
- Report checks actually executed, including failures, skips and unverified behavior. Test discovery is not a browser-test pass.

## Behavior to preserve

- Keep 20 stable horse identities with unique colours and integer condition scores from 1 to 100.
- Draw 10 distinct horses per round for six rounds: 1200, 1400, 1600, 1800, 2000 and 2200 metres. Horses may enter multiple rounds.
- Run rounds sequentially; publish each complete, ordered result once, after the last runner finishes.
- Sample performance once per race day. Derive movement from elapsed simulation time at 8× speed; camera controls, frame rate and pause/resume must not alter outcomes.
- Reset retains the roster and program while clearing progress and results. Refresh starts a fresh race session; only the explicit theme preference persists.
- Starting a race day selects Trackside. Resume preserves the chosen camera. Switching presentation preserves the race state.
- Keep Classic usable when optional 3D loading or graphics fail. Release scene resources, timers, listeners and observers when their owners unmount.
- Preserve keyboard controls, focus handling, reduced-motion behavior and both themes. Hiding the document pauses a running race.
- Keep artwork local and retain its provenance and licence credits in `docs/`.

## Reviewing this project

- Begin with the requested change or supplied assessment requirements; use the README to locate implementation decisions.
- Explain the architecture and user experience, then assess correctness, maintainability, accessibility, performance and test coverage.
- Support strengths and concerns with specific code or observed behavior. For defects, include a reproducible trigger, location and user impact where available.
- Distinguish required functionality, optional presentation, verified defects, suspected risks and potential improvements.
- Evaluate the shared race engine and optional 3D presentation individually, including how they work together and fail gracefully.
- Conclude with trade-offs, unresolved questions and prioritized recommendations grounded in the evidence and verification limits.

## Making changes

- Keep changes focused and preserve unrelated local edits. Add or adjust meaningful checks for changed behavior.
- Do not weaken assertions or replace visual baselines just to obtain passing checks.
- Keep generated builds, browser reports, local editor files, credentials and correspondence out of commits.
