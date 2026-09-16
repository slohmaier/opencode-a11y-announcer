// ==UserScript==
// @name         opencode a11y announcer
// @namespace    https://github.com/slohmaier/opencode-a11y-announcer
// @version      0.1.2
// @description  Accessibility labels and ordered screen-reader announcements for the opencode web UI
// @author       Stefan
// @homepageURL  https://github.com/slohmaier/opencode-a11y-announcer
// @supportURL   https://github.com/slohmaier/opencode-a11y-announcer/issues
// @updateURL    https://raw.githubusercontent.com/slohmaier/opencode-a11y-announcer/main/opencode-a11y-announcer.user.js
// @downloadURL  https://raw.githubusercontent.com/slohmaier/opencode-a11y-announcer/main/opencode-a11y-announcer.user.js
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var VERSION = '0.1.0';
  var STORE_KEY = 'opencode-a11y:settings';
  var FLUSH_MS = 350;
  var BEAT_TICK_MS = 1000;
  var REGION_TTL_MS = 60000;
  var REGION_MAX = 20;
  var MAX_CHARS = 1200;

  var DEFAULTS = {
    enabled: true,
    hosts: ['localhost', '127.0.0.1'],
    announceToolArgs: true,
    announceToolOutput: true,
    announceCodeBlocks: false,
    labelUnlabeledControls: true,
    heartbeatMs: 5000,
    debug: false
  };

  var MSG = {
    codeBlock: 'Code block',
    toolCall: 'Tool call',
    button: 'Button',
    reasoning: 'Reasoning',
    message: 'Message',
    thinking: 'Thinking'
  };

  var SLOT_LABELS = {
    'dialog-close-button': 'Close',
    'toast-close-button': 'Dismiss',
    'popover-close-button': 'Close',
    'image-preview-close': 'Close preview',
    'dialog-title': 'Dialog',
    'toast-title': 'Notification'
  };

  var SEL = {
    thinking: '[data-slot="session-turn-thinking"]',
    thinkingHeading: '.session-turn-thinking-heading',
    reasoning: '[data-component="reasoning-part"]',
    textPart: '[data-component="text-part"]',
    textBody: '[data-slot="text-part-body"]',
    toolTrigger: '[data-component="tool-trigger"]',
    toolOutput: '[data-component="tool-output"]',
    toolTitle: '[data-slot="basic-tool-tool-title"]',
    toolSubtitle: '[data-slot="basic-tool-tool-subtitle"]',
    toolArg: '[data-slot="basic-tool-tool-arg"]',
    messageContainer: '[data-slot="session-turn-message-container"]',
    assistantContent: '[data-slot="session-turn-assistant-content"]',
    userContent: '[data-slot="session-turn-message-content"]',
    assistantTextBody: '[data-slot="session-turn-assistant-content"] [data-slot="text-part-body"]',
    questionDock: '[data-component="session-question-dock"]',
    questionText: '[data-slot="question-text"]',
    questionOption: '[data-slot="question-option"]',
    permissionDock: '[data-component="dock-prompt"][data-kind="permission"]',
    permissionTitle: '[data-slot="permission-header-title"]'
  };

  function loadSettings() {
    var raw;
    try {
      raw = GM_getValue(STORE_KEY, null);
    } catch (e) {
      raw = null;
    }
    var s = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      s[k] = DEFAULTS[k];
    });
    if (raw) {
      try {
        var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        Object.keys(DEFAULTS).forEach(function (k) {
          if (parsed && Object.prototype.hasOwnProperty.call(parsed, k)) s[k] = parsed[k];
        });
      } catch (e) {}
    }
    if (!Array.isArray(s.hosts) || !s.hosts.length) s.hosts = DEFAULTS.hosts.slice();
    s.hosts = s.hosts.map(function (h) { return String(h).trim().toLowerCase(); }).filter(Boolean);
    s.heartbeatMs = Math.max(1000, parseInt(s.heartbeatMs, 10) || DEFAULTS.heartbeatMs);
    return s;
  }

  function saveSettings(next) {
    try {
      GM_setValue(STORE_KEY, JSON.stringify(next));
    } catch (e) {}
  }

  var settings = loadSettings();

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') {
      try { GM_addStyle(css); return; } catch (e) {}
    }
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function qsa(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function textOf(el, sel) {
    if (!el) return '';
    var node = sel ? el.querySelector(sel) : el;
    return node ? normalize(node.textContent) : '';
  }

  function collectText(node, opts, out) {
    var C = opts || {};
    out = out || [];
    if (!node) return out;
    if (node.nodeType === 3) {
      out.push(node.nodeValue);
      return out;
    }
    if (node.nodeType !== 1) return out;
    var el = node;
    if (!C.includeHidden && el.getAttribute('aria-hidden') === 'true') return out;
    if (el.getAttribute && el.getAttribute('data-slot') === 'text-reveal-leaving') return out;
    if (el.getAttribute && el.getAttribute('data-slot') === 'text-shimmer-char-shimmer') return out;
    var tag = el.tagName;
    if (tag === 'PRE') {
      if (C.includeCode) out.push(el.textContent);
      else out.push(' ' + MSG.codeBlock + ' ');
      return out;
    }
    if (tag === 'CODE') {
      if (el.closest('pre')) return out;
      if (C.includeCode) out.push(el.textContent);
      else out.push(' ' + MSG.codeBlock + ' ');
      return out;
    }
    var kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) collectText(kids[i], C, out);
    return out;
  }

  function readText(el, opts) {
    return normalize(collectText(el, opts || {}).join(' '));
  }

  function cap(text) {
    if (text.length <= MAX_CHARS) return text;
    return text.slice(0, MAX_CHARS) + ' (truncated)';
  }

  var politeRegion;
  var assertiveRegion;
  var started = false;
  var lastAnnounce = 0;
  var politeBuffer = '';
  var assertiveBuffer = '';
  var politeTimer = 0;
  var assertiveTimer = 0;
  var resultActive = false;
  var activeThinking = null;
  var beatNonce = 0;
  var streamState = new WeakMap();
  var seenBlocks = new WeakSet();
  var announcedTools = new WeakSet();
  var questionState = new WeakMap();
  var permissionState = new WeakMap();
  var ignoreFocusUntil = 0;
  var observer = null;
  var beatTimer = 0;
  var scanScheduled = false;

  function makeRegion(role) {
    var el = document.createElement('div');
    el.className = 'oc-a11y-sr oc-a11y-region';
    el.setAttribute('aria-live', role === 'assertive' ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'false');
    el.setAttribute('aria-relevant', 'additions text');
    el.setAttribute('role', role === 'assertive' ? 'alert' : 'status');
    el.setAttribute('data-oc-a11y', 'region');
    return el;
  }

  function trimRegion(region) {
    while (region.childNodes.length > REGION_MAX) region.removeChild(region.firstChild);
  }

  function pushRegion(region, text) {
    var item = document.createElement('div');
    item.textContent = text;
    region.appendChild(item);
    trimRegion(region);
    setTimeout(function () {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, REGION_TTL_MS);
  }

  function announcePolite(text) {
    text = cap(normalize(text));
    if (!text) return;
    pushRegion(politeRegion, text);
    lastAnnounce = Date.now();
    if (settings.debug) console.log('[oc-a11y] polite:', text);
  }

  function announceAssertive(text) {
    text = cap(normalize(text));
    if (!text) return;
    pushRegion(assertiveRegion, text);
    lastAnnounce = Date.now();
    if (settings.debug) console.log('[oc-a11y] assertive:', text);
  }

  function bufferPolite(text) {
    if (!text) return;
    politeBuffer += (politeBuffer ? ' ' : '') + text;
    if (!politeTimer) politeTimer = setTimeout(flushPolite, FLUSH_MS);
  }

  function flushPolite() {
    politeTimer = 0;
    var text = politeBuffer;
    politeBuffer = '';
    announcePolite(text);
  }

  function bufferAssertive(text) {
    if (!text) return;
    assertiveBuffer += (assertiveBuffer ? ' ' : '') + text;
    if (!assertiveTimer) assertiveTimer = setTimeout(flushAssertive, FLUSH_MS);
  }

  function flushAssertive() {
    assertiveTimer = 0;
    var text = assertiveBuffer;
    assertiveBuffer = '';
    announceAssertive(text);
  }

  function interruptPolite() {
    politeBuffer = '';
    if (politeTimer) {
      clearTimeout(politeTimer);
      politeTimer = 0;
    }
    if (politeRegion) politeRegion.textContent = '';
  }

  function streamDelta(el, channel, opts) {
    if (!el) return;
    var full = readText(el, opts);
    var rec = streamState.get(el) || { len: 0, last: '' };
    var delta = '';
    if (full === rec.last) {
      return;
    }
    if (full.length > rec.len && full.slice(0, rec.len) === rec.last) {
      delta = full.slice(rec.len);
    } else if (rec.last && full.indexOf(rec.last) === -1 && rec.last.indexOf(full) === -1) {
      delta = full;
    }
    streamState.set(el, { len: full.length, last: full });
    if (!delta.trim()) return;
    if (channel === 'result') {
      if (!resultActive) {
        resultActive = true;
        interruptPolite();
      }
      bufferAssertive(delta);
    } else {
      if (resultActive) return;
      bufferPolite(delta);
    }
  }

  function announceTool(trigger) {
    if (announcedTools.has(trigger)) return;
    announcedTools.add(trigger);
    var parts = [];
    var title = textOf(trigger, SEL.toolTitle);
    var subtitle = textOf(trigger, SEL.toolSubtitle);
    if (title) parts.push(title);
    if (subtitle) parts.push(subtitle);
    if (settings.announceToolArgs) {
      var arg = textOf(trigger, SEL.toolArg);
      if (arg) parts.push(arg);
    }
    if (!parts.length) parts.push(MSG.toolCall);
    if (!resultActive) bufferPolite(parts.join(', '));
    if (settings.debug) console.log('[oc-a11y] tool:', parts.join(', '));
  }

  function focusElement(target) {
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '0');
    if (document.activeElement === target) return;
    try {
      target.focus({ preventScroll: false });
    } catch (e) {
      try { target.focus(); } catch (e2) {}
    }
  }

  function handleQuestion(dock) {
    var sig = readText(dock, { includeCode: true });
    var rec = questionState.get(dock);
    if (rec && rec.sig === sig) return;
    questionState.set(dock, { sig: sig });
    if (!dock.hasAttribute('role')) dock.setAttribute('role', 'group');
    if (!dock.hasAttribute('aria-label')) dock.setAttribute('aria-label', 'Question');
    interruptPolite();
    announceAssertive(sig || 'Question');
    var target = dock.querySelector(SEL.questionText) || dock.querySelector(SEL.questionOption) || dock;
    focusElement(target);
    if (settings.debug) console.log('[oc-a11y] question:', sig);
  }

  function handlePermission(dock) {
    var sig = readText(dock, { includeCode: true });
    var rec = permissionState.get(dock);
    if (rec && rec.sig === sig) return;
    permissionState.set(dock, { sig: sig });
    if (!dock.hasAttribute('role')) dock.setAttribute('role', 'group');
    interruptPolite();
    announceAssertive(sig || 'Permission required');
    var target = dock.querySelector(SEL.permissionTitle) || dock.querySelector('button') || dock;
    focusElement(target);
    if (settings.debug) console.log('[oc-a11y] permission:', sig);
  }

  function accessibleName(el) {
    if (!el) return '';
    var name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (name) return normalize(name);
    var title = el.getAttribute('title');
    if (title) return normalize(title);
    return readText(el, {});
  }

  function markFocusable(el, role, fallback) {
    if (!el || el.getAttribute('data-oc-a11y') === 'focusable') return;
    if (role && !el.hasAttribute('role')) el.setAttribute('role', role);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('aria-label')) {
      var name = accessibleName(el);
      if (!name && fallback) el.setAttribute('aria-label', fallback);
    }
    el.setAttribute('data-oc-a11y', 'focusable');
    el.classList.add('oc-a11y-focusable');
  }

  function makeFocusable(el) {
    if (!el || el.getAttribute('data-oc-a11y') === 'focusable') return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('data-oc-a11y', 'focusable');
    el.classList.add('oc-a11y-focusable');
  }

  function markContainer(el) {
    if (!el) return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'article');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  }

  function labelButtons(root) {
    if (!settings.labelUnlabeledControls) return;
    qsa(root, 'button, [role="button"], [role="menuitem"]').forEach(function (btn) {
      if (btn.getAttribute('data-oc-a11y') === 'focusable') return;
      var name = accessibleName(btn);
      if (name && name.length > 1) {
        btn.setAttribute('data-oc-a11y', 'focusable');
        return;
      }
      var slot = btn.getAttribute('data-slot');
      var label = (slot && SLOT_LABELS[slot]) || btn.getAttribute('data-tooltip') || MSG.button;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('data-oc-a11y', 'focusable');
      if (settings.debug) console.log('[oc-a11y] labelled control:', slot || btn.className, '->', label);
    });
  }

  function applyA11y(root) {
    if (!root.querySelectorAll) return;
    qsa(root, SEL.toolTrigger).forEach(function (el) { markFocusable(el, 'button', null); });
    qsa(root, SEL.reasoning).forEach(makeFocusable);
    qsa(root, SEL.textPart).forEach(makeFocusable);
    qsa(root, SEL.thinking).forEach(makeFocusable);
    qsa(root, SEL.messageContainer).forEach(markContainer);
    qsa(root, SEL.questionDock).forEach(function (el) { markFocusable(el, 'group', 'Question'); });
    qsa(root, SEL.questionText).forEach(makeFocusable);
    qsa(root, SEL.questionOption).forEach(function (el) {
      if (el.tagName === 'BUTTON' && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    });
    qsa(root, SEL.permissionDock).forEach(function (el) { markFocusable(el, 'group', 'Permission required'); });
    qsa(root, SEL.toolOutput).forEach(function (el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    });
    labelButtons(root);
  }

  function hasPendingStream() {
    return !!politeTimer || !!assertiveTimer;
  }

  function beat() {
    if (!activeThinking || !document.contains(activeThinking)) return;
    if (resultActive || hasPendingStream()) return;
    if (Date.now() - lastAnnounce < settings.heartbeatMs) return;
    var text = readText(activeThinking, { includeHidden: true, includeCode: true }) || MSG.thinking;
    beatNonce = (beatNonce + 1) % 4;
    if (beatNonce > 0) text += new Array(beatNonce + 1).join('\u200B');
    announcePolite(text);
  }

  function scan() {
    if (!started) return;
    applyA11y(document);

    qsa(document, SEL.reasoning).forEach(function (el) {
      if (!seenBlocks.has(el)) {
        seenBlocks.add(el);
        resultActive = false;
      }
      streamDelta(el, 'polite', { includeCode: settings.announceCodeBlocks });
    });

    qsa(document, SEL.thinking).forEach(function (el) {
      if (!seenBlocks.has(el)) {
        seenBlocks.add(el);
        resultActive = false;
      }
      activeThinking = el;
      streamDelta(el, 'polite', { includeHidden: true, includeCode: true });
    });

    qsa(document, SEL.assistantTextBody).forEach(function (el) {
      if (!seenBlocks.has(el)) {
        seenBlocks.add(el);
        resultActive = true;
        interruptPolite();
      }
      streamDelta(el, 'result', { includeCode: settings.announceCodeBlocks });
    });

    qsa(document, SEL.questionDock).forEach(handleQuestion);
    qsa(document, SEL.permissionDock).forEach(handlePermission);

    qsa(document, SEL.toolTrigger).forEach(function (el) { announceTool(el); });

    if (settings.announceToolOutput) {
      qsa(document, SEL.toolOutput).forEach(function (el) {
        streamDelta(el, 'polite', { includeCode: true });
      });
    }
  }

  function scheduleScan() {
    if (!started || scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(function () {
      scanScheduled = false;
      try {
        scan();
      } catch (e) {
        if (settings.debug) console.error('[oc-a11y] scan failed', e);
      }
    });
  }

  function start() {
    if (started) return;
    started = true;
    politeRegion = makeRegion('polite');
    assertiveRegion = makeRegion('assertive');
    document.body.appendChild(politeRegion);
    document.body.appendChild(assertiveRegion);

    observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var target = records[i].target;
        var el = target && target.nodeType === 1 ? target : (target ? target.parentElement : null);
        if (el && el.closest && el.closest('.oc-a11y-region')) continue;
        scheduleScan();
        return;
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    beatTimer = setInterval(beat, BEAT_TICK_MS);
    scan();
    if (settings.debug) console.log('[oc-a11y] started on', location.host, 'v' + VERSION);
  }

  function stop() {
    if (!started) return;
    started = false;
    if (observer) observer.disconnect();
    observer = null;
    if (beatTimer) clearInterval(beatTimer);
    beatTimer = 0;
    if (politeTimer) clearTimeout(politeTimer);
    if (assertiveTimer) clearTimeout(assertiveTimer);
    politeTimer = assertiveTimer = 0;
    politeBuffer = assertiveBuffer = '';
    streamState = new WeakMap();
    seenBlocks = new WeakSet();
    announcedTools = new WeakSet();
    activeThinking = null;
    [politeRegion, assertiveRegion].forEach(function (r) {
      if (r && r.parentNode) r.parentNode.removeChild(r);
    });
    politeRegion = assertiveRegion = null;
  }

  function hostAllowed() {
    return settings.hosts.indexOf(String(location.hostname).toLowerCase()) !== -1;
  }

  function startIfAllowed() {
    if (settings.enabled && hostAllowed()) start();
    else stop();
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'for') node.htmlFor = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (text != null) node.textContent = text;
    return node;
  }

  function openSettings() {
    if (document.querySelector('[data-oc-a11y="settings"]')) return;
    var overlay = el('div', { 'data-oc-a11y': 'settings', class: 'oc-a11y-overlay' });
    var dialog = el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'opencode a11y announcer settings', class: 'oc-a11y-dialog' });
    dialog.appendChild(el('h2', { class: 'oc-a11y-h2' }, 'opencode a11y announcer'));

    function checkbox(key, label) {
      var wrap = el('label', { class: 'oc-a11y-row' });
      var input = el('input', { type: 'checkbox' });
      input.checked = !!settings[key];
      input.setAttribute('data-key', key);
      wrap.appendChild(input);
      wrap.appendChild(el('span', {}, label));
      dialog.appendChild(wrap);
    }

    checkbox('enabled', 'Enable on allowed hosts');
    checkbox('announceToolArgs', 'Announce tool arguments');
    checkbox('announceToolOutput', 'Announce tool output');
    checkbox('announceCodeBlocks', 'Read code blocks instead of "Code block"');
    checkbox('labelUnlabeledControls', 'Label unlabeled controls');
    checkbox('debug', 'Debug mode (console log + focus outlines)');

    var hbWrap = el('label', { class: 'oc-a11y-row' });
    hbWrap.appendChild(el('span', {}, 'Thinking heartbeat (ms)'));
    var hb = el('input', { type: 'number', min: '1000', step: '500', class: 'oc-a11y-num' });
    hb.value = String(settings.heartbeatMs);
    hb.setAttribute('data-key', 'heartbeatMs');
    hbWrap.appendChild(hb);
    dialog.appendChild(hbWrap);

    dialog.appendChild(el('label', { class: 'oc-a11y-row' }, 'Allowed hosts (one per line)'));
    var hosts = el('textarea', { rows: '4', class: 'oc-a11y-textarea', 'aria-label': 'Allowed hosts, one per line' });
    hosts.value = settings.hosts.join('\n');
    hosts.setAttribute('data-key', 'hosts');
    dialog.appendChild(hosts);

    var actions = el('div', { class: 'oc-a11y-actions' });
    var save = el('button', { type: 'button', class: 'oc-a11y-btn oc-a11y-primary' }, 'Save');
    var cancel = el('button', { type: 'button', class: 'oc-a11y-btn' }, 'Cancel');
    actions.appendChild(save);
    actions.appendChild(cancel);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() {
      document.removeEventListener('keydown', onKey, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    }

    save.addEventListener('click', function () {
      var next = Object.assign({}, settings);
      qsa(dialog, '[data-key]').forEach(function (input) {
        var key = input.getAttribute('data-key');
        if (input.type === 'checkbox') next[key] = input.checked;
        else if (key === 'heartbeatMs') next.heartbeatMs = Math.max(1000, parseInt(input.value, 10) || DEFAULTS.heartbeatMs);
        else if (key === 'hosts') next.hosts = input.value.split('\n').map(function (h) { return h.trim().toLowerCase(); }).filter(Boolean);
      });
      if (!next.hosts.length) next.hosts = DEFAULTS.hosts.slice();
      saveSettings(next);
      settings = loadSettings();
      applyDebugClass();
      stop();
      startIfAllowed();
      close();
    });

    cancel.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    save.focus();
  }

  function applyDebugClass() {
    document.documentElement.classList.toggle('oc-a11y-debug', !!settings.debug);
  }

  addStyle(
    '.oc-a11y-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
    'clip:rect(0 0 0 0);white-space:nowrap;border:0}' +
    '.oc-a11y-focusable:focus-visible{outline:2px solid currentColor;outline-offset:2px}' +
    '.oc-a11y-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,.55)}' +
    '.oc-a11y-dialog{background:Canvas;color:CanvasText;border:1px solid CanvasText;border-radius:8px;padding:16px;' +
    'width:min(520px,92vw);max-height:90vh;overflow:auto;font:14px/1.5 system-ui,sans-serif}' +
    '.oc-a11y-h2{margin:0 0 12px;font-size:16px}' +
    '.oc-a11y-row{display:flex;gap:8px;align-items:center;margin:8px 0}' +
    '.oc-a11y-num{width:90px}' +
    '.oc-a11y-textarea{width:100%;box-sizing:border-box;font:inherit}' +
    '.oc-a11y-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}' +
    '.oc-a11y-btn{padding:6px 14px;font:inherit;border:1px solid CanvasText;border-radius:6px;background:ButtonFace;' +
    'color:ButtonText;cursor:pointer}' +
    '.oc-a11y-debug .oc-a11y-focusable{outline:2px dashed Highlight}' +
    '@media (prefers-color-scheme: dark){.oc-a11y-dialog{background:#1e1e1e;color:#f2f2f2}}'
  );

  try {
    GM_registerMenuCommand('opencode-a11y: Settings', openSettings);
    GM_registerMenuCommand('opencode-a11y: Toggle debug', function () {
      settings.debug = !settings.debug;
      saveSettings(settings);
      applyDebugClass();
    });
  } catch (e) {}

  applyDebugClass();
  startIfAllowed();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startIfAllowed);
  }
})();
