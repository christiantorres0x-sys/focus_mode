// Pure blocking rules: decides WHEN blocking is on and WHICH rules it needs.
// No chrome.* calls here, so it is easy to test. The background worker applies
// the result (see background/blockingManager.ts).

import type { BlockedWebsite } from "../types/blocker";
import type { TimerState } from "../types/timer";

export const BLOCKED_PAGE_PATH = "/blocked.html";

// BR-01 / FR-13 / FR-14: blocking is on ONLY while the timer is running in focus
// mode. Breaks, idle and paused states never block.
export function isBlockingActive(timer: TimerState): boolean {
  return timer.status === "running" && timer.phase === "focus";
}

// The saved blocklist is never changed by this. It only decides what is active
// right now (BR-04, FR-16).
export function activeDomains(sites: readonly BlockedWebsite[], timer: TimerState): string[] {
  if (!isBlockingActive(timer)) return [];
  return [...new Set(sites.filter((site) => site.enabled).map((site) => site.domain))].sort();
}

// The shape we send to chrome.declarativeNetRequest. Kept as a plain type so this
// file does not depend on the browser's enums.
export interface BlockRule {
  id: number;
  priority: number;
  action: { type: "redirect"; redirect: { extensionPath: string } };
  condition: { requestDomains: string[]; resourceTypes: ["main_frame"] };
}

// One rule per domain. Rule ids are simply 1, 2, 3 ... in sorted-domain order, so
// two rules can never share an id (FR-17). "requestDomains" also matches every
// subdomain, and "main_frame" means top-level navigation only (FR-15).
export function buildRules(domains: readonly string[]): BlockRule[] {
  return domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: `${BLOCKED_PAGE_PATH}?site=${encodeURIComponent(domain)}` },
    },
    condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
  }));
}

interface RuleLike {
  id: number;
  condition: { requestDomains?: string[] };
  action: { redirect?: { extensionPath?: string } };
}

function ruleKey(rule: RuleLike): string {
  return `${rule.id}|${(rule.condition.requestDomains ?? []).join(",")}|${rule.action.redirect?.extensionPath ?? ""}`;
}

// Used to skip browser calls when nothing changed (NFR-06).
export function sameRules(a: readonly RuleLike[], b: readonly RuleLike[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(ruleKey).sort();
  const right = b.map(ruleKey).sort();
  return left.every((key, index) => key === right[index]);
}
