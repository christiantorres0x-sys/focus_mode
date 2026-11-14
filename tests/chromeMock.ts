// A small in-memory stand-in for the chrome.* APIs the background worker uses, so
// the worker can be tested in Node. It records what the worker asks the browser to do.

import { vi } from "vitest";

type Listener<A extends unknown[]> = (...args: A) => unknown;
type RuleLike = { id: number; condition: { requestDomains?: string[] }; action: { redirect?: { extensionPath?: string } } };

export interface Harness {
  store: Record<string, unknown>;
  alarms: Record<string, { when?: number }>;
  rules: RuleLike[];
  notifications: { id: string; title: string; message: string; type: string }[];
  chimes: unknown[];
  counts: { updateRules: number };
  fail: { rules: boolean; notify: boolean; offscreen: boolean };
  hostAccess: { value: boolean };
  now: { value: number };
  /** Send a message the way an extension page would. Resolves to the response, or "IGNORED". */
  send: (message: unknown, senderId?: string) => Promise<unknown>;
  command: (action: string, context?: unknown) => Promise<{ ok: boolean; state: Record<string, unknown> & { status: string; phase: string; endsAt: number | null; intent: { taskId: string | null; title: string | null; subject: string | null } } }>;
  fireAlarm: (name?: string) => Promise<void>;
  /** Pretend the browser restarted: the next import of the worker starts with the same storage. */
  resetListeners: () => void;
  listeners: { message: Listener<unknown[]>[]; alarm: Listener<unknown[]>[]; changed: Listener<unknown[]>[] };
}

export const PHASE_ALARM = "focusmode:phase-end";

export function installChrome(startNow = 1_800_000_000_000): Harness {
  const h = {
    store: {} as Record<string, unknown>,
    alarms: {} as Harness["alarms"],
    rules: [] as RuleLike[],
    notifications: [] as Harness["notifications"],
    chimes: [] as unknown[],
    counts: { updateRules: 0 },
    fail: { rules: false, notify: false, offscreen: false },
    hostAccess: { value: true },
    now: { value: startNow },
    listeners: { message: [] as Listener<unknown[]>[], alarm: [] as Listener<unknown[]>[], changed: [] as Listener<unknown[]>[] },
  };
  let offscreenOpen = false;
  vi.spyOn(Date, "now").mockImplementation(() => h.now.value);

  const chromeMock = {
    runtime: {
      id: "me",
      getURL: (p: string) => `chrome-extension://me/${p}`,
      getContexts: async () => (offscreenOpen ? [{}] : []),
      sendMessage: async (m: unknown) => { h.chimes.push(m); },
      onMessage: { addListener: (f: Listener<unknown[]>) => h.listeners.message.push(f) },
      onStartup: { addListener: () => undefined },
      onInstalled: { addListener: () => undefined },
    },
    storage: {
      local: {
        async get(keys: string | string[]) {
          const list = typeof keys === "string" ? [keys] : keys;
          const out: Record<string, unknown> = {};
          for (const k of list) if (k in h.store) out[k] = structuredClone(h.store[k]);
          return out;
        },
        async set(items: Record<string, unknown>) {
          await Promise.resolve();
          const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: h.store[k], newValue: structuredClone(v) };
            h.store[k] = structuredClone(v);
          }
          for (const l of h.listeners.changed) l(changes, "local");
        },
      },
      onChanged: {
        addListener: (f: Listener<unknown[]>) => h.listeners.changed.push(f),
        removeListener: (f: Listener<unknown[]>) => { h.listeners.changed = h.listeners.changed.filter((x) => x !== f); },
      },
    },
    alarms: {
      async create(name: string, info: { when?: number }) { h.alarms[name] = info; },
      async clear(name: string) { delete h.alarms[name]; return true; },
      onAlarm: { addListener: (f: Listener<unknown[]>) => h.listeners.alarm.push(f) },
    },
    declarativeNetRequest: {
      async getDynamicRules() { return structuredClone(h.rules); },
      async updateDynamicRules(o: { removeRuleIds?: number[]; addRules?: RuleLike[] }) {
        if (h.fail.rules) throw new Error("rule update failed");
        h.counts.updateRules++;
        const kept = h.rules.filter((r) => !(o.removeRuleIds ?? []).includes(r.id));
        h.rules.splice(0, h.rules.length, ...kept, ...structuredClone(o.addRules ?? []));
      },
    },
    permissions: { contains: async () => h.hostAccess.value },
    notifications: {
      async create(id: string, o: { title: string; message: string; type: string }) {
        if (h.fail.notify) throw new Error("notifications denied");
        h.notifications.push({ id, title: o.title, message: o.message, type: o.type });
        return id;
      },
    },
    offscreen: {
      async createDocument() {
        if (h.fail.offscreen) throw new Error("offscreen failed");
        offscreenOpen = true;
      },
    },
  };
  vi.stubGlobal("chrome", chromeMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined); // expected failures are logged by design

  const send: Harness["send"] = (message, senderId = "me") =>
    new Promise((resolve) => {
      const handled = h.listeners.message[0](message, { id: senderId }, resolve);
      if (handled === false) resolve("IGNORED");
    });
  return Object.assign(h, {
    send,
    command: ((action: string, context?: unknown) => send({ type: "timer", action, context })) as Harness["command"],
    // The worker's alarm handler does not return its promise (like the real event), so give it time to finish.
    fireAlarm: async (name = PHASE_ALARM) => {
      await h.listeners.alarm[0]({ name });
      await settle();
    },
    resetListeners: () => { h.listeners.message = []; h.listeners.alarm = []; h.listeners.changed = []; },
  }) as Harness;
}

export const settle = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));
