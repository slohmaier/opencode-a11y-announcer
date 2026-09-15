# opencode-a11y-announcer

Tampermonkey userscript that makes the opencode web UI usable with a screen
reader: it labels controls, makes chat elements reachable by keyboard, and
announces streamed activity in a controlled order.

Target version: opencode 1.18.31 (web UI, SolidJS).

## Features

- Accessibility labels for controls. Elements that already carry a localized
  `aria-label` from opencode keep it. Only controls without any accessible name
  receive a fallback label (English).
- Keyboard reachability: tool calls, reasoning parts, assistant text parts,
  thinking rows and message containers get `tabindex="0"` and a role if missing.
  Focus gets a visible outline.
- Ordered announcements through two hidden live regions:
  - polite region for tools, reasoning and the thinking heartbeat,
  - assertive region for assistant result text, which interrupts everything that
    is not result text.
- Read once: each streamed element is tracked by its already-announced length,
  so only newly appended text is announced. Reasoning text is never repeated.
- Thinking heartbeat: while a thinking block is active and the announcer is idle,
  the thinking status is re-announced every 5 seconds (configurable).
- Tool calls announce title, subtitle and optionally arguments and output.
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

## Settings

Open the Tampermonkey menu and choose `opencode-a11y: Settings`.

- Enable on allowed hosts
- Announce tool arguments
- Announce tool output
- Read code blocks instead of "Code block"
- Label unlabeled controls
- Debug mode (console log + focus outlines)
- Thinking heartbeat (ms), default 5000
- Allowed hosts, one per line. Default `localhost` and `127.0.0.1`, all ports.
  Add your own host names as needed.

`opencode-a11y: Toggle debug` switches debug mode without opening the dialog.

## Announcement semantics

- Normal events are appended to the polite region. Screen readers read them in
  the order they were added.
- Result text (assistant `text-part`) is appended to the assertive region and
  clears the pending polite queue, so it interrupts anything that is not result
  text.
- Streamed reasoning and result text are batched over a short window (350 ms) to
  avoid per-token spam while staying streaming.
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
  thinking, reasoning, result text and tool calls.
- Syntax check: `node --check opencode-a11y-announcer.user.js`
- DOM reference: `docs/dom-notes.md`
- Task list: `TASKS.md`
