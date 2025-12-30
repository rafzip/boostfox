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

  const permissionOk = await ensurePermission(tab.url);
  if (!permissionOk) {
    window.close();
    return;
  }

  try {
    await api.tabs.sendMessage(tab.id, { type: "bar-toggle" });
  } catch {
    try {
      await api.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ["bar.js"],
      });
    } catch {
      // Ignore injection errors (e.g. restricted URLs).
    }
  }

  window.close();
}

showBar().catch(() => window.close());
