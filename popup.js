async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getDomainFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname;
  } catch {
    return null;
  }
}

(async function init() {
  const openOptionsBtn = document.getElementById("openOptions");

  const tab = await getActiveTab();
  const domain = getDomainFromUrl(tab?.url);

  
  openOptionsBtn.addEventListener("click", async () => {
    await browser.runtime.openOptionsPage();
    window.close();
  });

  await refresh();
})();
