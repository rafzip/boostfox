const api = globalThis.browser || globalThis.chrome;

function normalizeHost(value) {
  const input = value.trim();
  if (!input) {
    return "";
  }

  try {
    if (input.includes("://")) {
      return new URL(input).hostname;
    }
    const trimmed = input.split("/")[0];
    return trimmed;
  } catch {
    return "";
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

function setStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
}

function refreshList(siteCss) {
  const list = document.getElementById("siteList");
  list.innerHTML = "";
  const hosts = Object.keys(siteCss).sort();

  for (const host of hosts) {
    const option = document.createElement("option");
    option.value = host;
    option.textContent = host;
    list.appendChild(option);
  }
}

function refreshZapList(siteZaps) {
  const list = document.getElementById("zapList");
  list.innerHTML = "";
  const hosts = Object.keys(siteZaps).sort();

  for (const host of hosts) {
    const option = document.createElement("option");
    option.value = host;
    option.textContent = host;
    list.appendChild(option);
  }
}

async function init() {
  const hostInput = document.getElementById("host");
  const cssInput = document.getElementById("css");
  const list = document.getElementById("siteList");
  const zapList = document.getElementById("zapList");

  let siteCss = await loadAllCss();
  refreshList(siteCss);
  let siteZaps = await loadAllZaps();
  refreshZapList(siteZaps);

  list.addEventListener("change", () => {
    const host = list.value;
    hostInput.value = host;
    cssInput.value = siteCss[host] || "";
  });

  document.getElementById("save").addEventListener("click", async () => {
    const host = normalizeHost(hostInput.value);
    if (!host) {
      setStatus("Enter a valid host.");
      return;
    }

    const css = cssInput.value;
    siteCss = await saveSiteCss(host, css);
    refreshList(siteCss);
    setStatus(css ? "Saved." : "Cleared.");
  });

  document.getElementById("remove").addEventListener("click", async () => {
    const host = normalizeHost(hostInput.value);
    if (!host) {
      setStatus("Choose a host to remove.");
      return;
    }

    siteCss = await saveSiteCss(host, "");
    refreshList(siteCss);
    if (list.value === host) {
      list.value = "";
    }
    cssInput.value = "";
    setStatus("Removed.");
  });

  document.getElementById("clearZaps").addEventListener("click", async () => {
    const host = zapList.value;
    if (!host) {
      setStatus("Choose a host with zaps.");
      return;
    }

    siteZaps = await saveSiteZaps(host, []);
    refreshZapList(siteZaps);
    if (zapList.value === host) {
      zapList.value = "";
    }
    setStatus("Zaps cleared for site.");
  });
}

init().catch(() => setStatus("Failed to load options."));
