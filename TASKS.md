# TASKS

Status: 2026-09-15

## Open

- Manual verification in the real opencode web UI on localhost:4096 with the
  screen reader: ordering, read-once, heartbeat, result interrupt, focus order.
- Verify selectors against a live session: thinking row, reasoning part, text
  part, tool trigger, tool output. Adjust if the DOM differs from the bundle
  analysis.
- Test patch_desktop.sh on macOS and patch_desktop.ps1 on Windows: verify the
  renderer loads oc-a11y.js, settings via localStorage, and re-patch after an
  app update.
- Check whether localStorage persists on the custom `oc://` origin; if not,
  route desktop settings through the preload `window.api`/electron-store.
- Decide whether tool output should be batched more aggressively (long bash
  output).
- Consider a "stop announcements" keybind (panic key) to silence the queue.
- Consider announcing errors (`tool-error-card-*`) and diffs explicitly.
- Consider adding additional locales beyond EN/DE if opencode's own labels are
  ever missing (currently not needed; only fallback labels are English).
- Evaluate optional browser end-to-end test (Playwright) against a local
  opencode instance with basic auth.

## Done

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
