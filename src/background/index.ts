// Manifest V3 service worker. It can be stopped and restarted by the browser at
// any time, so it must never keep important state only in memory.
// Later phases add alarms, blocking rules and notifications here.

import { initStorage } from "../services/storage";

// Runs when the extension is installed or updated.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await initStorage();
    console.log("[Focus Mode] storage initialised");
  } catch (error) {
    console.error("[Focus Mode] could not initialise storage", error);
  }
});
