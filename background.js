const api = globalThis.browser || globalThis.chrome;

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function loadAllCss() {
  const { siteCss = {} } = await api.storage.local.get("siteCss");
  return siteCss;
}

async function applyCssForTab(tabId, url) {
  const host = hostFromUrl(url);
  if (!host) {
    return;
  }

  const siteCss = await loadAllCss();
  const css = siteCss[host];
  if (!css) {
    return;
  }

  const origin = new URL(url).origin + "/*";
  const hasPermission = await api.permissions.contains({ origins: [origin] });
  if (!hasPermission) {
    return;
  }

  try {
    await api.scripting.removeCSS({
      target: { tabId, allFrames: true },
      css,
    });
  } catch {
    // Ignore missing CSS on initial inject.
  }

  try {
    await api.scripting.insertCSS({
      target: { tabId, allFrames: true },
      css,
    });
  } catch {
    // Ignore injection errors (e.g. restricted URLs).
  }
}

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    applyCssForTab(tabId, tab.url);
  }
});

api.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await api.tabs.get(tabId);
    if (tab.url) {
      applyCssForTab(tabId, tab.url);
    }
  } catch {
    // Ignore tabs that disappear while activating.
  }
});
