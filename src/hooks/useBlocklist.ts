import { useCallback, useEffect, useState } from "react";
import { getBlocklist, onBlocklistChanged } from "../services/storage";
import { addSite, removeSite, setSiteEnabled, type AddSiteResult } from "../services/blocklist";
import type { BlockedWebsite } from "../types/blocker";

const SAVE_ERROR = "Could not save your blocklist. Please try again.";

export interface UseBlocklistResult {
  ready: boolean;
  sites: BlockedWebsite[];
  error: string | null;
  add: (input: string, category?: string | null) => Promise<AddSiteResult>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useBlocklist(): UseBlocklistResult {
  const [sites, setSites] = useState<BlockedWebsite[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBlocklist()
      .then((saved) => active && setSites(saved))
      .catch((e) => {
        console.error("[Focus Mode] could not load blocklist", e);
        if (active) setError("Could not load your blocklist. Try reloading the extension.");
      })
      .finally(() => active && setReady(true));
    const unsubscribe = onBlocklistChanged((saved) => active && setSites(saved));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const add = useCallback(async (input: string, category: string | null = null): Promise<AddSiteResult> => {
    try {
      setError(null);
      const result = await addSite(input, category);
      if (result.ok) setSites(result.sites);
      return result;
    } catch (e) {
      console.error("[Focus Mode] could not add site", e);
      return { ok: false, error: SAVE_ERROR };
    }
  }, []);

  const setEnabled = useCallback(async (id: string, enabled: boolean) => {
    try {
      setError(null);
      setSites(await setSiteEnabled(id, enabled));
    } catch (e) {
      console.error("[Focus Mode] could not update site", e);
      setError(SAVE_ERROR);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setError(null);
      setSites(await removeSite(id));
    } catch (e) {
      console.error("[Focus Mode] could not remove site", e);
      setError(SAVE_ERROR);
    }
  }, []);

  return { ready, sites, error, add, setEnabled, remove };
}
