const $ = (id) => document.getElementById(id);
(async () => {
  const { settings = {} } = await chrome.storage.local.get("settings");
  const s = Object.assign({}, JN.DEFAULT_SETTINGS, settings);
  $("learn").checked = s.learn;
  $("learn").onchange = async () => { const { settings: cur = {} } = await chrome.storage.local.get("settings"); await chrome.storage.local.set({ settings: Object.assign({}, JN.DEFAULT_SETTINGS, cur, { learn: $("learn").checked }) }); };
  $("opt").onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };
  $("lab").onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try { await chrome.tabs.sendMessage(tab.id, { type: "jn:openLab" }); window.close(); }
    catch (e) { $("s").textContent = "Reload this page once, then try again."; }
  };
  $("fill").onclick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    $("s").textContent = "Filling…";
    try {
      const rs = await chrome.tabs.sendMessage(tab.id, { type: "jn:autofill" });
      $("s").textContent = rs && rs.empty ? "Add your profile first." : rs ? `Filled ${rs.filled}, ${rs.skipped} left for you.` : "Done.";
    } catch (e) { $("s").textContent = "Reload the page once, then try again."; }
  };
})();
