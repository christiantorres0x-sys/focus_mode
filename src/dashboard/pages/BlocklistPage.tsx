import { useState, type FormEvent } from "react";
import { Globe, Info, Plus, ShieldAlert, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import Switch from "../../components/ui/Switch";
import { useBlocklist } from "../../hooks/useBlocklist";
import { useBlockingStatus } from "../../hooks/useBlockingStatus";
import { SUGGESTED_SITES } from "../../types/blocker";

function StatusCard() {
  const { ready, status } = useBlockingStatus();
  if (!ready) return null;

  let Icon = ShieldOff;
  let tone = "border border-line bg-surface text-muted";
  let title = "Blocking is off right now";
  let text =
    "Blocking turns on automatically while a focus session is running. It stays off during breaks, when the timer is paused, and when no session is running.";

  if (status.error) {
    Icon = ShieldAlert;
    tone = "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    title = "Blocking isn't working";
    text = status.error;
  } else if (!status.hostAccess) {
    Icon = ShieldAlert;
    tone = "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    title = "Focus Mode can't access websites";
    text =
      'Websites can\'t be blocked until you allow access. Open this extension\'s details in your browser and set "Site access" to "On all sites".';
  } else if (status.active) {
    Icon = ShieldCheck;
    tone = "bg-brand-soft text-brand";
    title = `Blocking ${status.ruleCount} ${status.ruleCount === 1 ? "website" : "websites"} right now`;
    text = "A focus session is running. Blocked sites show the Focus Mode page instead.";
  }

  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${tone}`}>
      <Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-90">{text}</p>
      </div>
    </div>
  );
}

export default function BlocklistPage() {
  const { ready, sites, error, add, setEnabled, remove } = useBlocklist();
  const [input, setInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addSite = async (value: string, category: string | null) => {
    setBusy(true);
    setNotice(null);
    setFormError(null);
    const result = await add(value, category);
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      return false;
    }
    setNotice(
      result.droppedPath
        ? `Added ${result.site.domain}. The whole site is blocked, not just that page.`
        : `Added ${result.site.domain}.`,
    );
    return true;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (await addSite(input, null)) setInput("");
  };

  const sorted = [...sites].sort((a, b) => a.domain.localeCompare(b.domain));
  const enabledCount = sites.filter((site) => site.enabled).length;
  const listed = new Set(sites.map((site) => site.domain));
  const suggestions = SUGGESTED_SITES.filter((site) => !listed.has(site.domain));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Blocklist</h1>

      <StatusCard />

      <Card
        title="Add a website"
        icon={Plus}
        description="Enter a domain such as reddit.com. Its subdomains (like www.reddit.com) are blocked too."
      >
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="new-site" className="text-sm font-medium">
            Website
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              id="new-site"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="example.com"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={formError !== null}
              aria-describedby={formError ? "new-site-error" : undefined}
              className="min-w-0 flex-1 rounded-xl border border-line bg-app px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand aria-[invalid=true]:border-red-500"
            />
            <Button type="submit" icon={Plus} disabled={busy}>
              Add site
            </Button>
          </div>
          {formError && (
            <p id="new-site-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-2 text-sm text-brand">
              {notice}
            </p>
          )}
        </form>
      </Card>

      <Card
        title="Blocked websites"
        icon={Globe}
        description={
          sites.length > 0
            ? `${enabledCount} of ${sites.length} turned on. Turned-off sites stay in your list but are never blocked.`
            : undefined
        }
      >
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {!ready ? (
          <div className="h-24" aria-busy="true" />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="Your blocklist is empty"
            description="Add a website above, or pick from the suggestions below. Sites are only blocked while a focus session is running."
          />
        ) : (
          <ul className="divide-y divide-line">
            {sorted.map((site) => (
              <li key={site.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${site.enabled ? "" : "text-muted"}`}>{site.domain}</p>
                  {site.category && <p className="text-xs text-muted">{site.category}</p>}
                </div>
                <Switch
                  checked={site.enabled}
                  onChange={(checked) => setEnabled(site.id, checked)}
                  aria-label={`Block ${site.domain}`}
                />
                <Button
                  variant="ghost"
                  icon={Trash2}
                  aria-label={`Remove ${site.domain}`}
                  title={`Remove ${site.domain}`}
                  onClick={() => remove(site.id)}
                  className="!px-2.5"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ready && suggestions.length > 0 && (
        <Card title="Suggestions" description="Common distractions. Add the ones that tempt you.">
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((site) => (
              <li key={site.domain}>
                <Button
                  variant="secondary"
                  icon={Plus}
                  disabled={busy}
                  onClick={() => addSite(site.domain, site.category)}
                  className="!py-1.5"
                >
                  {site.domain}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Good to know" icon={Info}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Focus Mode is a productivity aid. You can get around it by disabling the extension or using another browser or device.</li>
          <li>Only top-level page visits are blocked. Videos or widgets embedded in other sites still load.</li>
          <li>
            To block in Incognito windows, allow Focus Mode in Incognito from the extension&apos;s details page in your
            browser.
          </li>
        </ul>
      </Card>
    </div>
  );
}
