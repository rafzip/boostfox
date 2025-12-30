const api = globalThis.browser || globalThis.chrome;

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function getActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadAllCss() {
  const { siteCss = {} } = await api.storage.local.get("siteCss");
  return siteCss;
}

async function saveSiteCss(host, css) {
  const siteCss = await loadAllCss();
  if (css) {
    siteCss[host] = css;
  } else {
    delete siteCss[host];
  }
  await api.storage.local.set({ siteCss });
  return siteCss;
}

async function ensurePermission(url) {
  const origin = new URL(url).origin + "/*";
  const hasPermission = await api.permissions.contains({ origins: [origin] });
  if (hasPermission) {
    return true;
  }
  return api.permissions.request({ origins: [origin] });
}

async function applyCss(tabId, css, previousCss) {
  if (previousCss) {
    try {
      await api.scripting.removeCSS({
        target: { tabId, allFrames: true },
        css: previousCss,
      });
    } catch {
      // Ignore if not present yet.
    }
  }

  if (!css) {
    return;
  }

  try {
    await api.scripting.insertCSS({
      target: { tabId, allFrames: true },
      css,
    });
  } catch {
    // Ignore restricted URLs or injection errors.
  }
}

function setStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
}

async function init() {
  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    setStatus("No active tab.");
    return;
  }

  const host = hostFromUrl(tab.url);
  if (!host) {
    setStatus("Unsupported URL.");
    return;
  }

  const hostLabel = document.getElementById("host");
  const cssInput = document.getElementById("css");
  const zapToggle = document.getElementById("zapToggle");
  hostLabel.textContent = host;

  let siteCss = await loadAllCss();
  cssInput.value = siteCss[host] || "";

  async function saveAndApply(css) {
    const previousCss = siteCss[host] || "";

    const permissionOk = await ensurePermission(tab.url);
    if (!permissionOk) {
      setStatus("Permission denied for this site.");
      await applyCss(tab.id, css, previousCss);
      return;
    }

    siteCss = await saveSiteCss(host, css);
    await applyCss(tab.id, css, previousCss);
    setStatus(css ? "Saved and applied." : "Cleared and removed.");
  }

  document.getElementById("saveApply").addEventListener("click", async () => {
    const css = cssInput.value;
    await saveAndApply(css);
  });

  document.getElementById("clear").addEventListener("click", async () => {
    const previousCss = siteCss[host] || "";
    siteCss = await saveSiteCss(host, "");
    await applyCss(tab.id, "", previousCss);
    cssInput.value = "";
    setStatus("Cleared for this site.");
  });

  document.querySelectorAll(".font-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const stack = button.dataset.font || "";
      const css = stack ? `* { font-family: ${stack} !important; }` : "";
      cssInput.value = css;
      await saveAndApply(css);
    });
  });

  document.getElementById("openOptions").addEventListener("click", () => {
    api.runtime.openOptionsPage();
  });

  document.getElementById("undoZap").addEventListener("click", async () => {
    const permissionOk = await ensurePermission(tab.url);
    if (!permissionOk) {
      setStatus("Permission denied for this site.");
      return;
    }

    try {
      const response = await api.runtime.sendMessage({
        type: "zap-undo",
        url: tab.url,
        tabId: tab.id,
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

  async function refreshZapToggle() {
    try {
      const response = await api.tabs.sendMessage(tab.id, { type: "zap-query" });
      zapToggle.checked = Boolean(response && response.enabled);
    } catch {
      zapToggle.checked = false;
    }
  }

  zapToggle.addEventListener("change", async () => {
    const permissionOk = await ensurePermission(tab.url);
    if (!permissionOk) {
      setStatus("Permission denied for this site.");
      zapToggle.checked = false;
      return;
    }

    if (zapToggle.checked) {
      try {
        await api.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["zap.js"],
        });
        await api.tabs.sendMessage(tab.id, { type: "zap-enable" });
        setStatus("Zap mode on. Click elements to remove.");
      } catch {
        setStatus("Unable to enable zap mode.");
        zapToggle.checked = false;
      }
      return;
    }

    try {
      await api.tabs.sendMessage(tab.id, { type: "zap-disable" });
      setStatus("Zap mode off.");
    } catch {
      setStatus("Zap mode already off.");
    }
  });

  await refreshZapToggle();
}

init().catch(() => setStatus("Error loading tab."));
