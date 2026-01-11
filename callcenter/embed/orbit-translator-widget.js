/*!
 * Orbit Translator Widget (Embed Button)
 * - Injects a floating button into any page
 * - Opens a full-screen overlay iframe to your hosted Orbit Translator page
 *
 * Usage:
 *   <script
 *     src="https://YOUR_DOMAIN/embed/orbit-translator-widget.js"
 *     data-orbit-url="https://YOUR_DOMAIN/index.html"
 *     data-target="English"
 *     data-autostart="1"
 *     data-position="br"  <!-- br|bl|tr|tl -->
 *     data-z="2147483000"
 *   ></script>
 *
 * Optional API:
 *   window.OrbitTranslatorWidget.open()
 *   window.OrbitTranslatorWidget.close()
 *   window.OrbitTranslatorWidget.toggle()
 */
(function () {
  "use strict";

  if (window.OrbitTranslatorWidget && window.OrbitTranslatorWidget.__installed) return;

  var scriptEl = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  function getAttr(name, fallback) {
    if (!scriptEl) return fallback;
    var v = scriptEl.getAttribute(name);
    return (v === null || v === undefined || v === "") ? fallback : v;
  }

  var ORBIT_URL = getAttr("data-orbit-url", getAttr("data-url", ""));
  var TARGET = getAttr("data-target", "English");
  var AUTOSTART = getAttr("data-autostart", "1");
  var POSITION = (getAttr("data-position", "br") || "br").toLowerCase();
  var Z = parseInt(getAttr("data-z", "2147483000"), 10);
  var LABEL = getAttr("data-label", "Translate");
  var SIZE = parseInt(getAttr("data-size", "56"), 10);

  if (!ORBIT_URL) {
    console.error("[OrbitTranslatorWidget] Missing data-orbit-url. Provide the hosted translator page URL.");
    ORBIT_URL = "about:blank";
  }

  function buildIframeSrc() {
    try {
      var u = new URL(ORBIT_URL, window.location.href);
      if (TARGET) u.searchParams.set("target", TARGET);
      if (AUTOSTART) u.searchParams.set("autostart", AUTOSTART);
      return u.toString();
    } catch (_) {
      var joiner = ORBIT_URL.indexOf("?") >= 0 ? "&" : "?";
      return ORBIT_URL + joiner + "target=" + encodeURIComponent(TARGET) + "&autostart=" + encodeURIComponent(AUTOSTART);
    }
  }

  function createEl(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "style") Object.assign(el.style, props.style);
        else if (k === "className") el.className = props.className;
        else if (k === "text") el.textContent = props.text;
        else el.setAttribute(k, props[k]);
      });
    }
    return el;
  }

  function posStyles(pos) {
    var s = { position: "fixed" };
    var gap = "18px";
    if (pos.indexOf("b") >= 0) s.bottom = gap;
    if (pos.indexOf("t") >= 0) s.top = gap;
    if (pos.indexOf("r") >= 0) s.right = gap;
    if (pos.indexOf("l") >= 0) s.left = gap;
    return s;
  }

  // Root mount (CSS isolated via shadow DOM when supported)
  var host = createEl("div", { style: { position: "fixed", zIndex: String(Z) } });
  Object.assign(host.style, posStyles(POSITION));
  host.setAttribute("data-orbit-translator-widget", "1");
  document.documentElement.appendChild(host);

  var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var style = createEl("style");
  style.textContent = `
    :host, * { box-sizing: border-box; }
    .orbit-btn {
      width: ${SIZE}px;
      height: ${SIZE}px;
      border-radius: 999px;
      border: 0;
      cursor: pointer;
      display: grid;
      place-items: center;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 18px 45px rgba(0,0,0,.35);
      background: rgba(22, 122, 58, 0.95);
      color: #fff;
      font: 600 14px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .orbit-btn:active { transform: translateY(1px); }
    .orbit-label {
      position: absolute;
      right: calc(${SIZE}px + 12px);
      bottom: 10px;
      background: rgba(0,0,0,.75);
      color: #fff;
      padding: 8px 10px;
      border-radius: 12px;
      font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      white-space: nowrap;
      display: none;
    }
    .wrap:hover .orbit-label { display: block; }
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.55);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 14px;
    }
    .panel {
      width: min(520px, 100%);
      height: min(760px, 100%);
      border-radius: 18px;
      overflow: hidden;
      background: #0b0b0b;
      box-shadow: 0 30px 80px rgba(0,0,0,.55);
      display: flex;
      flex-direction: column;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: rgba(0,0,0,.75);
      color: #fff;
      font: 600 13px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .bar .meta { opacity: .9; font-weight: 600; }
    .bar .actions { display: flex; gap: 8px; }
    .icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 0;
      cursor: pointer;
      background: rgba(255,255,255,.10);
      color: #fff;
      font: 700 14px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .icon:active { transform: translateY(1px); }
    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      background: #000;
    }
  `;

  var wrap = createEl("div", { className: "wrap", style: { position: "relative" } });

  var label = createEl("div", { className: "orbit-label", text: LABEL });
  var btn = createEl("button", { className: "orbit-btn", type: "button", title: "Open Orbit Translator" });
  btn.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7Z" stroke="currentColor" stroke-width="2"/>
      <path d="M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 22h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  var overlay = createEl("div", { className: "overlay", role: "dialog", "aria-modal": "true" });
  var panel = createEl("div", { className: "panel" });
  var bar = createEl("div", { className: "bar" });
  var meta = createEl("div", { className: "meta", text: "Orbit Translator" });
  var actions = createEl("div", { className: "actions" });
  var minimize = createEl("button", { className: "icon", type: "button", title: "Minimize", text: "—" });
  var close = createEl("button", { className: "icon", type: "button", title: "Close", text: "×" });

  var iframe = createEl("iframe", {
    allow: "autoplay *; microphone *; camera *; geolocation *; midi *; encrypted-media *; clipboard-read *; clipboard-write *; fullscreen *; display-capture *; web-share *",
    referrerpolicy: "origin-when-cross-origin",
    sandbox: "allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-presentation allow-pointer-lock allow-storage-access-by-user-activation allow-top-navigation-by-user-activation",
    src: buildIframeSrc(),
    title: "Orbit Translator",
    allowfullscreen: "true"
  });

  actions.appendChild(minimize);
  actions.appendChild(close);
  bar.appendChild(meta);
  bar.appendChild(actions);
  panel.appendChild(bar);
  panel.appendChild(iframe);
  overlay.appendChild(panel);

  wrap.appendChild(label);
  wrap.appendChild(btn);

  shadow.appendChild(style);
  shadow.appendChild(wrap);
  shadow.appendChild(overlay);

  var isOpen = false;

  function postToIframe(command, payload) {
    try {
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage({
        type: "orbit_translator_command",
        command: command,
        payload: payload || {}
      }, "*");
    } catch (_) {}
  }

  function open() {
    if (isOpen) return;
    overlay.style.display = "flex";
    isOpen = true;
    postToIframe("start", { target: TARGET });
  }

  function closeOverlay() {
    if (!isOpen) return;
    postToIframe("shutdown", {});
    overlay.style.display = "none";
    isOpen = false;
  }

  function toggle() {
    if (isOpen) closeOverlay();
    else open();
  }

  btn.addEventListener("click", toggle);
  minimize.addEventListener("click", closeOverlay);
  close.addEventListener("click", closeOverlay);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeOverlay();
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeOverlay();
  });

  window.OrbitTranslatorWidget = {
    __installed: true,
    open: open,
    close: closeOverlay,
    toggle: toggle,
    setTarget: function (lang) {
      TARGET = String(lang || "English");
      iframe.src = buildIframeSrc();
      postToIframe("set_target", { target: TARGET });
    }
  };
})();
