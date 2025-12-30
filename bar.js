(() => {
  const api = globalThis.browser || globalThis.chrome;
  const existing = document.getElementById("boostfox-bar-root");
  if (existing) {
    const isHidden = existing.dataset.hidden === "1";
    existing.dataset.hidden = isHidden ? "0" : "1";
    existing.style.display = isHidden ? "block" : "none";
    return;
  }

  const host = location.hostname || "unknown";
  const root = document.createElement("div");
  root.id = "boostfox-bar-root";
  root.dataset.hidden = "0";
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.right = "0";
  root.style.bottom = "0";
  root.style.zIndex = "2147483647";
  root.style.display = "block";

  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      .bar {
        font: 13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        background: #f8fafc;
        border-top: 1px solid #cbd5f5;
        color: #111827;
        box-shadow: 0 -6px 16px rgba(15, 23, 42, 0.2);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        flex-wrap: wrap;
      }
      .row + .row {
        border-top: 1px solid #e2e8f0;
      }
      .title {
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .muted {
        opacity: 0.7;
      }
      .host {
        font-weight: 600;
      }
      .spacer {
        flex: 1;
      }
      button {
        padding: 6px 10px;
        border: 1px solid #cbd5f5;
        background: #ffffff;
        border-radius: 6px;
        cursor: pointer;
      }
      button:hover {
        background: #f1f5f9;
      }
      textarea {
        width: 100%;
        height: 120px;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        padding: 6px;
        border: 1px solid #cbd5f5;
        border-radius: 6px;
      }
      .font-buttons {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .status {
        font-size: 12px;
        color: #334155;
      }
    </style>
    <div class="bar">
      <div class="row">
        <span class="title">boostfox</span>
        <span class="muted">site</span>
        <span class="host" id="host"></span>
        <span class="spacer"></span>
        <label class="toggle">
          <input type="checkbox" id="zapToggle" />
          <span>zap mode</span>
        </label>
        <button id="undoZap">undo zap</button>
        <button id="saveApply">save + apply</button>
        <button id="clear">clear</button>
        <button id="openOptions">options</button>
        <button id="hideBar">hide</button>
      </div>
      <div class="row">
        <textarea id="css" placeholder="/* your CSS for this site */"></textarea>
        <div class="font-buttons">
          <button class="font-btn" data-font="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif">sans</button>
          <button class="font-btn" data-font="'Times New Roman', Times, serif">serif</button>
          <button class="font-btn" data-font="'Courier New', Courier, monospace">mono</button>
          <button class="font-btn" data-font="'Comic Sans MS', 'Comic Sans', cursive">comic</button>
          <button class="font-btn" data-font="'Georgia', 'Times New Roman', serif">georgia</button>
        </div>
      </div>
      <div class="row">
        <div class="status" id="status"></div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(root);

  const hostLabel = shadow.getElementById("host");
  const cssInput = shadow.getElementById("css");
  const zapToggle = shadow.getElementById("zapToggle");
  const statusEl = shadow.getElementById("status");
  hostLabel.textContent = host;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function getLocalStyle() {
    let style = document.getElementById("boostfox-local-css");
    if (!style) {
      style = document.createElement("style");
      style.id = "boostfox-local-css";
      document.documentElement.appendChild(style);
    }
    return style;
  }

  function applyLocalCss(css) {
    const style = getLocalStyle();
    style.textContent = css || "";
  }

  async function loadAllCss() {
    const { siteCss = {} } = await api.storage.local.get("siteCss");
    return siteCss;
  }

  async function saveSiteCss(hostname, css) {
    const siteCss = await loadAllCss();
    if (css) {
      siteCss[hostname] = css;
    } else {
      delete siteCss[hostname];
    }
    await api.storage.local.set({ siteCss });
    return siteCss;
  }

  async function init() {
    const siteCss = await loadAllCss();
    const initialCss = siteCss[host] || "";
    cssInput.value = initialCss;
    applyLocalCss(initialCss);
  }

  shadow.getElementById("saveApply").addEventListener("click", async () => {
    const css = cssInput.value;
    await saveSiteCss(host, css);
    applyLocalCss(css);
    setStatus(css ? "Saved and applied." : "Cleared and removed.");
  });

  shadow.getElementById("clear").addEventListener("click", async () => {
    await saveSiteCss(host, "");
    cssInput.value = "";
    applyLocalCss("");
    setStatus("Cleared for this site.");
  });

  shadow.getElementById("undoZap").addEventListener("click", async () => {
    try {
      const response = await api.runtime.sendMessage({
        type: "zap-undo",
        url: location.href,
      });
      if (response && response.ok) {
        setStatus("Undid last zap.");
      } else {
        setStatus("Nothing to undo.");
      }
    } catch {
      setStatus("Unable to undo zap.");
    }
  });

  shadow.querySelectorAll(".font-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const stack = button.dataset.font || "";
      const css = stack ? `* { font-family: ${stack} !important; }` : "";
      cssInput.value = css;
      await saveSiteCss(host, css);
      applyLocalCss(css);
      setStatus("Saved and applied.");
    });
  });

  zapToggle.addEventListener("change", async () => {
    if (zapToggle.checked) {
      try {
        await api.runtime.sendMessage({ type: "zap-ui-enable" });
        setStatus("Zap mode on. Click elements to remove.");
      } catch {
        zapToggle.checked = false;
        setStatus("Unable to enable zap mode.");
      }
      return;
    }

    try {
      await api.runtime.sendMessage({ type: "zap-ui-disable" });
      setStatus("Zap mode off.");
    } catch {
      setStatus("Unable to disable zap mode.");
    }
  });

  shadow.getElementById("openOptions").addEventListener("click", async () => {
    try {
      await api.runtime.sendMessage({ type: "open-options" });
    } catch {
      setStatus("Unable to open options.");
    }
  });

  shadow.getElementById("hideBar").addEventListener("click", () => {
    root.dataset.hidden = "1";
    root.style.display = "none";
  });

  api.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "bar-toggle") {
      return;
    }
    const isHidden = root.dataset.hidden === "1";
    root.dataset.hidden = isHidden ? "0" : "1";
    root.style.display = isHidden ? "block" : "none";
  });

  init().catch(() => setStatus("Unable to load site settings."));
})();
