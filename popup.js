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
  hostLabel.textContent = host;

  let siteCss = await loadAllCss();
  cssInput.value = siteCss[host] || "";

  document.getElementById("saveApply").addEventListener("click", async () => {
    const css = cssInput.value;
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
  });

  document.getElementById("clear").addEventListener("click", async () => {
    const previousCss = siteCss[host] || "";
    siteCss = await saveSiteCss(host, "");
    await applyCss(tab.id, "", previousCss);
    cssInput.value = "";
    setStatus("Cleared for this site.");
  });

  document.getElementById("openOptions").addEventListener("click", () => {
    api.runtime.openOptionsPage();
  });
}

init().catch(() => setStatus("Error loading tab."));
