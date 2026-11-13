// Blocking manager (SRS 5.4): turns the saved blocklist + the timer state into
// declarativeNetRequest rules. The saved blocklist and the active rules are kept
// separate: removing rules never touches the user's list (BR-04, FR-16).

import {
  getBlocklist,
  getBlockingStatus,
  getTimerState,
  saveBlockingStatus,
} from "../services/storage";
import { activeDomains, buildRules, sameRules } from "../services/blockingRules";
import { HOST_ORIGINS, type BlockingStatus } from "../types/blocker";
import type { TimerState } from "../types/timer";
import { enqueue } from "./queue";

const RULE_ERROR_MESSAGE =
  "Focus Mode couldn't update its website blocking rules. Try reloading the extension from the extensions page.";

// Makes the browser's rules match what the timer state requires. Call this ONLY
// from inside the queue (see syncBlockingNow below, and timerController).
// It never throws: a blocking problem must not break the timer (SRS 9.2).
export async function syncBlocking(timer: TimerState): Promise<void> {
  let ruleCount = 0;
  let error: string | null = null;

  try {
    const sites = await getBlocklist();
    const wanted = buildRules(activeDomains(sites, timer));
    ruleCount = wanted.length;

    const current = await chrome.declarativeNetRequest.getDynamicRules();
    // NFR-06: only talk to the browser when something actually changed. We own
    // every dynamic rule, so replacing all of them in ONE call is atomic.
    if (!sameRules(current, wanted)) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: current.map((rule) => rule.id),
        // Our rule type uses plain strings; the browser's types use enums with the same values.
        addRules: wanted as unknown as chrome.declarativeNetRequest.Rule[],
      });
    }
  } catch (e) {
    console.error("[Focus Mode] could not update blocking rules", e);
    error = RULE_ERROR_MESSAGE;
  }

  // A redirect rule is silently ignored if the browser withholds site access
  // (for example "Site access: on click" in the extension settings).
  let hostAccess = true;
  try {
    hostAccess = await chrome.permissions.contains({ origins: HOST_ORIGINS });
  } catch (e) {
    console.error("[Focus Mode] could not check site access", e);
  }

  const status: BlockingStatus = {
    active: ruleCount > 0 && error === null && hostAccess,
    ruleCount,
    hostAccess,
    error,
  };

  try {
    const previous = await getBlockingStatus();
    if (JSON.stringify(previous) !== JSON.stringify(status)) {
      await saveBlockingStatus(status);
    }
  } catch (e) {
    console.error("[Focus Mode] could not save blocking status", e);
  }
}

// Re-checks blocking using the saved timer state. Used when the worker starts and
// when the blocklist changes.
export function syncBlockingNow(): Promise<void> {
  return enqueue(async () => syncBlocking(await getTimerState()));
}
