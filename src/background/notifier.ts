// Phase-end notification and sound (FR-37..40). Every function here swallows its
// own errors: a missing permission, a blocked notification or a failed sound must
// never stop the timer (FR-40, NFR-09).

import { phaseEndAlert } from "../services/notifications";
import { durationMsFor } from "../services/timerLogic";
import type { UserSettings } from "../types/settings";
import type { TimerState } from "../types/timer";

const NOTIFICATION_ID = "focusmode:phase-end"; // a new alert replaces the previous one
const PLAY_CHIME_MESSAGE = "focusmode:play-chime";

async function showNotification(after: TimerState, settings: UserSettings): Promise<void> {
  const alert = phaseEndAlert(after, (state) => Math.round(durationMsFor(state.phase, settings) / 60_000));
  await chrome.notifications.create(NOTIFICATION_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: alert.title,
    message: alert.message,
    priority: 1,
  });
}

async function playSound(): Promise<void> {
  const url = chrome.runtime.getURL("offscreen.html");
  const open = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] });
  if (open.length === 0) {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play a short chime when a focus or break phase ends.",
      });
    } catch (error) {
      // Another call may have created it first; that is fine.
      if (!String(error).includes("single offscreen")) throw error;
    }
  }
  await chrome.runtime.sendMessage({ type: PLAY_CHIME_MESSAGE });
}

// `after` is the timer state right after the phase ended.
export async function announcePhaseEnd(after: TimerState, settings: UserSettings): Promise<void> {
  if (settings.notificationsEnabled) {
    try {
      await showNotification(after, settings);
    } catch (error) {
      console.error("[Focus Mode] could not show notification", error);
    }
  }
  if (settings.soundEnabled) {
    try {
      await playSound();
    } catch (error) {
      console.error("[Focus Mode] could not play sound", error);
    }
  }
}
