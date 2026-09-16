# opencode-a11y-announcer

Tampermonkey userscript that makes the opencode web UI usable with a screen
reader: it labels controls, makes chat elements reachable by keyboard, and
announces streamed activity in a controlled order.

Target version: opencode 1.18.31 (web UI, SolidJS).

## Features

- Accessibility labels for controls. Elements that already carry a localized
  `aria-label` from opencode keep it. Only controls without any accessible name
  receive a fallback label (English).
- Keyboard reachability: tool calls, tool outputs, reasoning parts, assistant
  text parts and thinking rows get `tabindex="0"`. Message containers are kept
  out of the tab order (`role="article"`, `tabindex="-1"`) so tabbing does not
  stop on a redundant wrapper that only says "article". Focus gets a visible
  outline.
- Ordered announcements through two hidden live regions:
  - polite region for tools, reasoning and the thinking heartbeat,
  - assertive region for assistant result text, which interrupts everything that
    is not result text.
- Read once: each streamed element is tracked by its already-announced length,
  so only newly appended text is announced. Reasoning text is never repeated.
- Thinking heartbeat: while a thinking block is active and the announcer is idle,
  the thinking status is re-announced every 5 seconds (configurable).
- Tool calls announce title, subtitle and optionally arguments and output.
- Questions and permission prompts are announced assertively (question text,
  options and hint) and the question text is made focusable and focused when the
  prompt appears. The prompt is re-announced when the question changes.
- Code blocks are announced as "Code block" by default; a setting reads the raw
  code instead.

## Install

1. Install the Tampermonkey browser extension.
2. Open this URL and confirm the install:
   `https://raw.githubusercontent.com/slohmaier/opencode-a11y-announcer/main/opencode-a11y-announcer.user.js`
   Alternatively drag `opencode-a11y-announcer.user.js` onto a Tampermonkey tab.
   Tampermonkey auto-updates the script from the same URL.
3. Run the opencode web UI (`opencode web`, or your existing service on port
   4096) and open it in the browser.

## Matching

The script ships with port-specific includes only, because `@match` ignores
ports and would otherwise run on every service on localhost:

- `http://localhost:4096/*`
- `http://127.0.0.1:4096/*`

opencode binds a random port unless you pin it (`--port` or `server.port`); 4096
is the documented example. For other ports or hosts, add your own patterns in
Tampermonkey: script editor > Settings > User matches or User includes (for
example `http://localhost:9999/*` or a domain). Per-site scoping is handled by
Tampermonkey, not by the script.

## Settings

Open the Tampermonkey menu and choose `opencode-a11y: Settings`.

- Enable announcements
- Announce tool arguments
- Announce tool output
- Read code blocks instead of "Code block"
- Label unlabeled controls
- Debug mode (console log + focus outlines)
- Thinking heartbeat (ms), default 5000

`opencode-a11y: Toggle debug` switches debug mode without opening the dialog.

## Desktop app (Electron)

The opencode desktop app does not load the UI over HTTP and does not support
browser extensions. Its renderer is served from a custom `oc://renderer` scheme,
so Tampermonkey cannot run there and `@match`/`@include` never apply. Instead,
the same userscript is injected into the packaged renderer with a patch script.

- `scripts/patch_desktop.sh` (macOS and Linux)
- `scripts/patch_desktop.ps1` (Windows)

Both locate `app.asar` automatically (or take an override), back it up to
`app.asar.bak`, copy the userscript to `out/renderer/oc-a11y.js`, add a script
tag to `out/renderer/index.html`, and repack. Use `--unpatch` / `-Unpatch` to
restore the backup. On macOS the script also strips `ElectronAsarIntegrity` from
`Info.plist` if present and ad-hoc signs the bundle (`--no-sign` to skip).

Examples:

- macOS/Linux: `./scripts/patch_desktop.sh` or `./scripts/patch_desktop.sh --app /Applications/OpenCode.app`
- Windows: `powershell -ExecutionPolicy Bypass -File .\scripts\patch_desktop.ps1`

Notes:

- Quit the app before patching. Re-run after every opencode update, because the
  installer overwrites `app.asar`.
- The scripts refuse to repack when `app.asar.unpacked` is non-empty, because
  that would break unpacked native modules (`--force` to override).
- Injected mode has no `GM_*` and no Tampermonkey menu: settings are stored in
  localStorage and the dialog opens with Cmd/Ctrl+Alt+Shift+A (also available as
  `window.ocA11y.openSettings()`). If localStorage is unavailable on the custom
  origin, settings fall back to in-memory defaults.

## Announcement semantics

- Normal events are appended to the polite region. Screen readers read them in
  the order they were added.
- Result text (assistant `text-part`) is appended to the assertive region and
  clears the pending polite queue, so it interrupts anything that is not result
  text.
- Streamed reasoning and result text are batched over a short window (350 ms) to
  avoid per-token spam while staying streaming.
- Only assistant text is treated as result text. User messages are not announced
  and do not interrupt anything.
- Questions and permission prompts go to the assertive region so they interrupt
  reasoning or the thinking heartbeat.
- The heartbeat only fires when no other announcement is pending and the last
  announcement is at least `heartbeatMs` old.
- Announcements are capped at 1200 characters, then marked "(truncated)".

## Localization

Detection is language independent: elements are identified by `data-slot` and
`data-component` attributes, never by their text. The script reads the text that
opencode already renders, so German ("Denkt nach") and English ("Thinking") are
announced as-is. The only fallback labels are English and only used for controls
that have no accessible name at all.

## Limitations

- Selectors depend on opencode's DOM attributes. A web UI refactor can break
  them; `docs/dom-notes.md` lists the pinned anchors.
- "Finished speaking" cannot be detected from a live region. The heartbeat is
  therefore gated by queue idleness and a quiet-time threshold, not by the
  screen reader's actual speech end.
- The script is not a replacement for opencode fixing its own ARIA. It is a
  bridge until the chat content is exposed accessibly.

## Development

- Source: `opencode-a11y-announcer.user.js` (single file, no build step).
- Fixture: `test/fixture.html` replicates the chat slots with stubbed `GM_*`
  APIs and mirrors live-region output into a log. Serve it, for example
  `python3 -m http.server`, then open it and use the buttons to simulate
  thinking, reasoning, result text, tool calls and questions.
- Injected-mode fixture: `test/fixture-injected.html` loads the script with no
  `GM_*` APIs, covering the desktop injection path (localStorage settings,
  shortcut, `window.ocA11y`).
- Desktop patch: `scripts/patch_desktop.sh`, `scripts/patch_desktop.ps1`.
- Syntax check: `node --check opencode-a11y-announcer.user.js`
- DOM reference: `docs/dom-notes.md`
- Task list: `TASKS.md`
