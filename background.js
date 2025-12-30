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

async function loadAllZaps() {
  const { siteZaps = {} } = await api.storage.local.get("siteZaps");
  return siteZaps;
}

async function saveSiteZaps(host, selectors) {
  const siteZaps = await loadAllZaps();
  if (selectors && selectors.length) {
    siteZaps[host] = selectors;
  } else {
    delete siteZaps[host];
  }
  await api.storage.local.set({ siteZaps });
  return siteZaps;
}

function buildZapCss(selectors) {
  if (!selectors || !selectors.length) {
    return "";
  }
  return selectors.map((selector) => `${selector} { display: none !important; }`).join("\n");
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

async function applyZapsForTab(tabId, url) {
  const host = hostFromUrl(url);
  if (!host) {
    return;
  }

  const siteZaps = await loadAllZaps();
  const selectors = siteZaps[host];
  if (!selectors || !selectors.length) {
    return;
  }

  const origin = new URL(url).origin + "/*";
  const hasPermission = await api.permissions.contains({ origins: [origin] });
  if (!hasPermission) {
    return;
  }

  const css = buildZapCss(selectors);
  if (!css) {
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
    applyZapsForTab(tabId, tab.url);
  }
});

api.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await api.tabs.get(tabId);
    if (tab.url) {
      applyCssForTab(tabId, tab.url);
      applyZapsForTab(tabId, tab.url);
    }
  } catch {
    // Ignore tabs that disappear while activating.
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "zap-add") {
    (async () => {
      const url = message.url || (sender.tab && sender.tab.url);
      const tabId = sender.tab && sender.tab.id;
      if (!url || typeof message.selector !== "string" || !tabId) {
        return;
      }

      const host = hostFromUrl(url);
      if (!host) {
        return;
      }

      const siteZaps = await loadAllZaps();
      const selectors = Array.isArray(siteZaps[host]) ? siteZaps[host].slice() : [];
      if (!selectors.includes(message.selector)) {
        selectors.push(message.selector);
      }
      await saveSiteZaps(host, selectors);
      await applyZapsForTab(tabId, url);
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false }));

    return true;
  }

  if (message.type === "zap-undo") {
    (async () => {
      const url = message.url || (sender.tab && sender.tab.url);
      const tabId = message.tabId || (sender.tab && sender.tab.id);
      if (!url || !tabId) {
        return;
      }

      const host = hostFromUrl(url);
      if (!host) {
        return;
      }

      const siteZaps = await loadAllZaps();
      const selectors = Array.isArray(siteZaps[host]) ? siteZaps[host].slice() : [];
      const selector = selectors.pop();
      if (!selector) {
        sendResponse({ ok: false });
        return;
      }

      await saveSiteZaps(host, selectors);
      await applyZapsForTab(tabId, url);
      try {
        await api.tabs.sendMessage(tabId, {
          type: "zap-undo-applied",
          selector,
        });
      } catch {
        // Ignore if the content script is not present.
      }
      sendResponse({ ok: true, selector });
    })().catch(() => sendResponse({ ok: false }));

    return true;
  }
});
