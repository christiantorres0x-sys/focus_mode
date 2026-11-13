// Blocklist operations used by the UI: add, enable/disable, remove (FR-11).
// Every function saves through the storage service and returns the new list.
// They throw if the browser cannot save, so the UI never shows unsaved changes
// as saved (SRS 9.3).

import { getBlocklist, saveBlocklist } from "./storage";
import { normalizeDomain } from "../utils/domain";
import type { BlockedWebsite } from "../types/blocker";

export type AddSiteResult =
  | { ok: true; site: BlockedWebsite; sites: BlockedWebsite[]; droppedPath: boolean }
  | { ok: false; error: string };

export async function addSite(input: string, category: string | null = null): Promise<AddSiteResult> {
  const parsed = normalizeDomain(input); // FR-12, SRS 9.1: invalid input never creates a rule
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const sites = await getBlocklist();
  const existing = sites.find((site) => site.domain === parsed.domain);
  if (existing) {
    return {
      ok: false,
      error: existing.enabled
        ? `${parsed.domain} is already in your blocklist.`
        : `${parsed.domain} is already in your blocklist, but turned off. Switch it on below.`,
    };
  }

  const site: BlockedWebsite = { id: crypto.randomUUID(), domain: parsed.domain, category, enabled: true };
  const next = [...sites, site];
  await saveBlocklist(next);
  return { ok: true, site, sites: next, droppedPath: parsed.droppedPath };
}

export async function setSiteEnabled(id: string, enabled: boolean): Promise<BlockedWebsite[]> {
  const sites = await getBlocklist();
  const next = sites.map((site) => (site.id === id ? { ...site, enabled } : site));
  await saveBlocklist(next);
  return next;
}

export async function removeSite(id: string): Promise<BlockedWebsite[]> {
  const sites = await getBlocklist();
  const next = sites.filter((site) => site.id !== id);
  await saveBlocklist(next);
  return next;
}
