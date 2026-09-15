# TASKS

Status: 2026-09-15

## Open

- Manual verification in the real opencode web UI (localhost:4096) with the
  screen reader: ordering, read-once, heartbeat, result interrupt, focus order.
- Verify selectors against a live session: thinking row, reasoning part, text
  part, tool trigger, tool output. Adjust if the DOM differs from the bundle
  analysis.
- Decide whether tool output should be batched more aggressively (long bash
  output).
- Consider a "stop announcements" keybind (panic key) to silence the queue.
- Consider announcing errors (`tool-error-card-*`) and diffs explicitly.
- Consider adding additional locales beyond EN/DE if opencode's own labels are
  ever missing (currently not needed; only fallback labels are English).
- Evaluate optional browser end-to-end test (Playwright) against a local
  opencode instance with basic auth.

## Done

- 2026-09-15 Repo scaffolded, userscript implemented, fixture created,
  README and DOM notes written, syntax check passed.
