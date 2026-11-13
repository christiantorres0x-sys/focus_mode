import { useEffect, useState } from "react";
import { getBlockingStatus, onBlockingStatusChanged } from "../services/storage";
import { DEFAULT_BLOCKING_STATUS, type BlockingStatus } from "../types/blocker";

// Follows the status the background worker writes after every blocking update.
export function useBlockingStatus(): { ready: boolean; status: BlockingStatus } {
  const [status, setStatus] = useState<BlockingStatus>(DEFAULT_BLOCKING_STATUS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getBlockingStatus()
      .then((saved) => active && setStatus(saved))
      .catch((e) => console.error("[Focus Mode] could not load blocking status", e))
      .finally(() => active && setReady(true));
    const unsubscribe = onBlockingStatusChanged((saved) => active && setStatus(saved));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { ready, status };
}
