// Manifest V3 service worker. The browser can stop it and start it again at any
// time, so it never keeps important state only in memory: everything is read
// from chrome.storage.local and the timer is driven by timestamps.

import { initStorage } from "../services/storage";
import { isTimerMessage, type TimerResponse } from "../types/timer";
import { PHASE_END_ALARM, handleTimerCommand, syncTimer } from "./timerController";

function logError(message: string, error: unknown) {
  console.error(`[Focus Mode] ${message}`, error);
}

// Install or update.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await initStorage();
    await syncTimer();
    console.log("[Focus Mode] storage initialised");
  } catch (error) {
    logError("could not initialise storage", error);
  }
});

// Browser start: catch up on phases that ended while the browser was closed.
chrome.runtime.onStartup.addListener(() => {
  syncTimer().catch((error) => logError("timer recovery failed", error));
});

// The scheduled end of a phase.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PHASE_END_ALARM) {
    syncTimer().catch((error) => logError("could not finish timer phase", error));
  }
});

// Commands from the popup and dashboard.
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (response: TimerResponse) => void) => {
  // Only accept messages from this extension's own pages.
  if (sender.id !== chrome.runtime.id || !isTimerMessage(message)) return false;

  handleTimerCommand(message.action)
    .then((state) => sendResponse({ ok: true, state }))
    .catch((error) => {
      logError(`timer command "${message.action}" failed`, error);
      sendResponse({ ok: false, error: "The timer could not be updated. Please try again." });
    });

  return true; // keep the message channel open for the async response
});

// Every time the worker wakes up, make sure the timer state and alarm are correct.
syncTimer().catch((error) => logError("timer sync failed on wake-up", error));
