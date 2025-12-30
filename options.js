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

async function init() {
  const hostInput = document.getElementById("host");
  const cssInput = document.getElementById("css");
  const list = document.getElementById("siteList");

  let siteCss = await loadAllCss();
  refreshList(siteCss);

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
}

init().catch(() => setStatus("Failed to load options."));
