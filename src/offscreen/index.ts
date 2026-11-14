// Offscreen page: a service worker cannot play audio, so it asks this hidden page.
import { playChime } from "../utils/chime";

export const PLAY_CHIME_MESSAGE = "focusmode:play-chime";

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === PLAY_CHIME_MESSAGE) {
    playChime().catch((error) => console.error("[Focus Mode] could not play sound", error));
  }
  return false;
});
