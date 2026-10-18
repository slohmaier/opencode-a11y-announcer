# TASKS

Status: 2026-10-18

## Open

- Live screen-reader verification in OpenCode 2 (2.0.32) on the pilot host
  (tuxer): ordering, read-once, heartbeat, result interrupt, focus order,
  question/permission docks. The fixture passes; real-DOM pass still pending.
- Verify `patch_desktop.sh` on macOS and `patch_desktop.ps1` on Windows against
  an OpenCode 2 desktop build (Linux .deb verified: injects oc-a11y.js and keeps
  node-pty unpacked).
- Decide whether the v2 virtualized timeline needs stronger de-duplication of
  announcements when rows remount on scroll.
- Consider a "stop announcements" keybind (panic key) to silence the queue.
- Consider announcing errors (`tool-error-card-*`) and diffs explicitly.
- Evaluate optional browser end-to-end test (Playwright) against a local
  OpenCode 2 instance with basic auth.

## Done

- 2026-10-18 0.2.1: live v2 fixes. Added the v2 working/thinking status
  (`[data-component="session-working"]` / `session-preparing`, text-shimmer
  label "Working" / "Denkt nach") to the announced/heartbeat sources. Root
  cause of "nothing announced" through nginx: OpenCode 2 brotli/gzip-compresses
  the HTML for browsers, so `sub_filter` injection silently produced no script
  tag; fixed with `proxy_set_header Accept-Encoding "";` on all five vhosts.
  Verified end-to-end on tuxer (public URL): tool calls (Shell), results and the
  working status are announced.

- 2026-10-18 0.2.0: OpenCode 2 support. Selectors updated for the v2 web UI
  (`session-turn-thinking` -> `session-turn-thinking-row`; custom question input
  `question-custom-input` -> `text-input-v2-input`). The thinking row now wraps
  the reasoning part, so the heartbeat reads only the row heading/title to avoid
  double-reading reasoning. Desktop patch scripts repack with `--unpack` so the
  v2 node-pty native module (app.asar.unpacked) keeps loading; non-native
  unpacked files still require `--force`. dom-notes and README retargeted to
  2.0.32. Verified against the updated fixture with jsdom and against a real
  OpenCode 2 desktop .deb (asar inject + unpack preserved).

- 2026-10-01 0.1.4: custom answer in the question dock now receives focus. When
  the custom option (button `[data-slot="question-option"][data-custom="true"]`)
  is activated by keyboard, the new `[data-slot="question-custom-input"]`
  textarea is focused (opencode only focuses it on mousedown), and
  `handleQuestion` no longer steals focus while the user is inside the custom
  option. See docs/dom-notes.md.
- 2026-09-15 0.1.3: matching via port-specific @include (localhost/127.0.0.1
  port 4096); removed the internal host allowlist and its settings field;
  added injected mode (localStorage settings, Cmd/Ctrl+Alt+Shift+A shortcut,
  window.ocA11y, body-ready guard); added scripts/patch_desktop.sh and
  scripts/patch_desktop.ps1 plus the injected-mode fixture.
- 2026-09-15 Tab order cleaned up: message containers are no longer tab stops
  (role article, tabindex -1); content parts are focusable without a role
  prefix; thinking row no longer uses role status (avoided live-region
  duplication).
- 2026-09-15 Fixed thinking heartbeat: user messages no longer set the result
  state, so reasoning and the 5s heartbeat are no longer blocked. Result text is
  now restricted to assistant content.
- 2026-09-15 Added question and permission prompt handling: assertive
  announcement of text and options, question text focusable and focused.
- 2026-09-15 Published to https://github.com/slohmaier/opencode-a11y-announcer
  (public, main), added @updateURL/@downloadURL for Tampermonkey auto-update.
- 2026-09-15 Repo scaffolded, userscript implemented, fixture created,
  README and DOM notes written, syntax check passed.
