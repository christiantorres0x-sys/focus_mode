// Website blocker data model (SRS 6.3).

export interface BlockedWebsite {
  id: string;
  domain: string; // normalized, for example "youtube.com"
  category: string | null; // nullable fields are explicit (SRS 6.1)
  enabled: boolean;
}

// What the blocking manager reports after each sync, so the UI can tell the
// user whether blocking is really working (SRS 9.2: actionable error messages).
export interface BlockingStatus {
  active: boolean; // rules are installed AND the browser lets us use them
  ruleCount: number; // number of blocking rules that should be active right now
  hostAccess: boolean; // false if the browser withholds site access from the extension
  error: string | null; // set when the browser rejected a rule update
}

export const DEFAULT_BLOCKING_STATUS: BlockingStatus = {
  active: false,
  ruleCount: 0,
  hostAccess: true,
  error: null,
};

// A redirect rule only works if the extension has access to the site. Without it
// the browser accepts the rule but silently does nothing.
export const HOST_ORIGINS = ["http://*/*", "https://*/*"];

// FR-10: default suggested list. The user can edit it freely.
export const SUGGESTED_SITES: readonly { domain: string; category: string }[] = [
  { domain: "youtube.com", category: "Video" },
  { domain: "facebook.com", category: "Social" },
  { domain: "instagram.com", category: "Social" },
  { domain: "tiktok.com", category: "Social" },
  { domain: "x.com", category: "Social" },
  { domain: "twitter.com", category: "Social" },
  { domain: "reddit.com", category: "Social" },
  { domain: "twitch.tv", category: "Streaming" },
  { domain: "netflix.com", category: "Streaming" },
];
