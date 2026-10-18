# DOM notes

Pinned to opencode web UI 2.0.32 (OpenCode 2, SolidJS). Selectors are read
from the served bundles and from the source at
`github.com/anomalyco/opencode` (branch `dev`, packages/session-ui,
packages/app). The UI is a SolidJS SPA; hashed asset names change per release,
the DOM attributes below are the stable hooks.

## OpenCode 1 vs 2

The script supports both. OpenCode 2 kept most anchors; the changes are:

- Thinking row: `[data-slot="session-turn-thinking"]` (v1) became
  `[data-slot="session-turn-thinking-row"]` (v2). The script matches both. In
  v2 the row wraps the reasoning part, so only the row's heading/title is read
  for the heartbeat (not the full reasoning text).
- Custom question input: `[data-slot="question-custom-input"]` (v1) was
  removed. In v2 the custom option is a `TextInput` with
  `[data-slot="text-input-v2-input"]` (inside
  `[data-slot="question-option"][data-custom="true"]`). The script accepts
  several fallbacks.
- New wrappers in v2: `[data-component="session-timeline"]` around rows and
  `[data-component="session-composer-dock"]` around the docks. Both are
  transparent for the annotations.
- The v2 timeline is virtualized; rows remount while scrolling, so annotation
  is re-applied by the MutationObserver and element-keyed state may reset.
- Everything else below is unchanged between v1 and v2.

Selectors the script relies on (v2): `[data-slot="session-turn-thinking-row"]`,
`[data-component="reasoning-part"]`, `[data-component="text-part"]`,
`[data-slot="text-part-body"]`, `[data-component="tool-trigger"]`,
`[data-slot="basic-tool-tool-title"] / -subtitle / -arg`,
`[data-component="tool-output"]`, `[data-slot="basic-tool-tool-arg"]`,
`[data-slot="session-turn-message-container"]`,
`[data-slot="session-turn-assistant-content"]`,
`[data-slot="session-turn-message-content"]`,
`[data-component="session-question-dock"]`, `[data-slot="question-text"]`,
`[data-slot="question-option"]` (incl. `data-custom="true"`),
`[data-slot="option-label"]`,
`[data-component="dock-prompt"][data-kind="permission"]`,
`[data-slot="permission-header-title"]`.

## Chat structure

- Message row: `[data-slot="session-turn-message-container"]`
- Assistant content wrapper: `[data-slot="session-turn-assistant-content"]`
- Chat content has `aria-live="off"`, so nothing is announced by opencode.
- User message meta and attachments: `[data-slot="user-message-*"]`

## Assistant text (result)

- `[data-component="text-part"]` -> `[data-slot="text-part-body"]`
- Actions (copy etc.): `[data-slot="message-part-actions"]`, `.hover-reveal`,
  excluded from reading.

## Reasoning (streamed thinking text)

- `[data-component="reasoning-part"]`
- Rendered via the text-reveal widget: `[data-component="text-reveal"]`,
  `[data-slot="text-reveal-track"]`, `[data-slot="text-reveal-entering"]`,
  `[data-slot="text-reveal-leaving"]`.
- The leaving node holds stale text and must not be read.

## Thinking status row

- Root: `[data-slot="session-turn-thinking-row"]` (v2) / `[data-slot="session-turn-thinking"]` (v1).
- Heading: `.session-turn-thinking-heading` (only when reasoning summaries are
  hidden).
- Status label uses the text-shimmer widget:
  `[data-slot="text-shimmer-char"]` containing
  `[data-slot="text-shimmer-char-base"]` and
  `[data-slot="text-shimmer-char-shimmer"]`, both `aria-hidden="true"`.
  Read only the base node; the shimmer node duplicates it. In v2 the widget
  wrapper `[data-component="text-shimmer"]` also carries an `aria-label`.
- i18n keys: `ui.sessionTurn.status.thinking` ->
  EN "Thinking", DE "Denkt nach";
  `ui.sessionTurn.status.thinkingWithTopic` -> EN "Thinking - {{topic}}",
  DE "Denkt nach: {{topic}}". The script reads rendered text, not the key.

## Tool calls

- Trigger: `[data-component="tool-trigger"]`
- Title: `[data-slot="basic-tool-tool-title"]`
- Subtitle: `[data-slot="basic-tool-tool-subtitle"]`
- Argument: `[data-slot="basic-tool-tool-arg"]`
- Output: `[data-component="tool-output"]` (already `role="region" tabindex="0"`)
- Bash output: `[data-component="bash-output"]`,
  `[data-slot="bash-pre"]`, `[data-slot="bash-scroll"]`
- Edit/write: `[data-component="edit-tool"]`, `write-tool`,
  `[data-slot="message-part-title-text"]`, `message-part-title-filename`
- Errors: `[data-slot="tool-error-card-copy"]`, `tool-error-card-content`
- Task/subagent: `[data-component="task-tool-*"]`

## Existing ARIA and i18n

- Many controls already get a localized `aria-label`, e.g.
  `t.t("ui.common.dismiss")`, `t.t("ui.common.close")`.
- Locale is stored in `localStorage["opencode.global.dat:language"]` as
  `{"locale":"de"}` and mirrored to `document.documentElement.lang`.
- Locale chunks are dynamic imports, e.g. `de-DLNsfDjw.js`, `de-DPPrl5ZN.js`.
- Toast live region exists in the bundle but is unrelated to chat.

## Questions and permission prompts

- Question dock: `[data-component="session-question-dock"]`
  - header title `[data-slot="question-header-title"]`
  - progress `[data-slot="question-progress"]`,
    `[data-slot="question-progress-segment"]`
  - question text `[data-slot="question-text"]`
  - options `[data-slot="question-options"]`, each option a
    `[data-slot="question-option"]` button with `role="radio"` or
    `role="checkbox"` and `aria-checked`, containing `[data-slot="option-label"]`
    and `[data-slot="option-description"]`.
  - Custom answer: a button `[data-slot="question-option"][data-custom="true"]`
    (`role="radio"|"checkbox"`) that, when activated, is replaced by a
    `[data-slot="question-option"][data-custom="true"]` form holding a v2
    `TextInput` (`[data-component="text-input-v2"]` with
    `[data-slot="text-input-v2-input"]`; v1 used a bare
    `<textarea data-slot="question-custom-input">`). opencode focuses the field
    on `mousedown` only, so keyboard activation does not focus it; the
    userscript focuses it (and labels it from the option label).
  - hint `[data-slot="question-hint"]`, footer `[data-slot="question-footer-actions"]`
- Permission prompt: `[data-component="dock-prompt"][data-kind="permission"]`
  - `[data-slot="permission-header-title"]`, `permission-hint`,
    `permission-patterns`, `permission-footer-actions` (Deny / Allow once /
    Allow always are real buttons with text).
- Only assistant text parts count as result text: they live under
  `[data-slot="session-turn-assistant-content"]`. User text parts live under
  `[data-slot="session-turn-message-content"]` and are ignored.

## Desktop app (Electron)

- The desktop renderer is not served over HTTP. It loads `oc://renderer/index.html`
  from a custom privileged scheme; files come from `out/renderer` on disk
  (inside `app.asar`). `location` is protocol `oc:`, hostname `renderer`, no port.
- The renderer HTML has no CSP meta tag, only a `Document-Policy` response header,
  so a same-origin `<script src="./oc-a11y.js">` tag works.
- The API sidecar listens on `127.0.0.1` with a random port (or `OPENCODE_PORT`),
  `cors: ["oc://renderer"]`. That is the API, not the page, so match patterns
  cannot target the desktop UI.
- Injection is done by `scripts/patch_desktop.sh` / `patch_desktop.ps1`, adding
  the script under `out/renderer/` and a script tag in `out/renderer/index.html`.

## Not used

- Do not rely on hashed asset filenames.
- Do not rely on translated strings for detection.
