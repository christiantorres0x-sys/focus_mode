// UI-side helper: sends a timer command to the background worker and returns
// the new timer state. Throws an Error with a readable message if it fails.

import type { TimerAction, TimerResponse, TimerState } from "../types/timer";

export async function sendTimerCommand(action: TimerAction): Promise<TimerState> {
  let response: TimerResponse | undefined;
  try {
    response = (await chrome.runtime.sendMessage({ type: "timer", action })) as TimerResponse | undefined;
  } catch (error) {
    console.error("[Focus Mode] could not reach the background worker", error);
    throw new Error("Could not reach the Focus Mode background service. Try reloading the extension.");
  }
  if (!response) throw new Error("The background service did not respond.");
  if (!response.ok) throw new Error(response.error);
  return response.state;
}
