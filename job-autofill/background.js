// Jobnaut service worker: keyboard shortcut + tab id lookup for the in-page Resume Analytics panel.
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "autofill") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: "jn:autofill" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg && msg.type === "jn:whoami") { send({ tabId: sender.tab ? sender.tab.id : null }); return; }
});
