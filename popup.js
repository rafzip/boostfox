const api = globalThis.browser || globalThis.chrome;

async function getActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensurePermission(url) {
  const origin = new URL(url).origin + "/*";
  const hasPermission = await api.permissions.contains({ origins: [origin] });
  if (hasPermission) {
    return true;
  }
  return api.permissions.request({ origins: [origin] });
}

async function showBar() {
  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    window.close();
    return;
  }

  try {
    await api.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      files: ["bar.js"],
    });
  } catch {
    // Ignore injection errors (e.g. restricted URLs).
  }

  const enableButton = document.getElementById("enableAccess");
  const statusEl = document.getElementById("status");
  if (!enableButton || !statusEl) {
    window.close();
    return;
  }

  enableButton.addEventListener("click", async () => {
    try {
      const ok = await ensurePermission(tab.url);
      statusEl.textContent = ok
        ? "Site access enabled for persistence."
        : "Permission denied.";
    } catch {
      statusEl.textContent = "Unable to request permission.";
    }
  });
}

showBar().catch(() => window.close());
