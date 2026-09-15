# DOM notes

Pinned to opencode web UI 1.18.31. Selectors are read from the served bundles
(`/assets/index-*.js`) and CSS. The UI is a SolidJS SPA; hashed asset names
change per release, the DOM attributes below are the stable hooks.

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

- Root: `[data-slot="session-turn-thinking"]`
- Heading: `.session-turn-thinking-heading` (only when reasoning summaries are
  hidden).
- Status label uses the text-shimmer widget:
  `[data-slot="text-shimmer-char"]` containing
  `[data-slot="text-shimmer-char-base"]` and
  `[data-slot="text-shimmer-char-shimmer"]`, both `aria-hidden="true"`.
  Read only the base node; the shimmer node duplicates it.
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

## Not used

- Do not rely on hashed asset filenames.
- Do not rely on translated strings for detection.
