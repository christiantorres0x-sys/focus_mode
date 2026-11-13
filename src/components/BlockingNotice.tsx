import { ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useBlockingStatus } from "../hooks/useBlockingStatus";

// Shown under the timer while a focus session is running, so the user can see
// whether website blocking really is on (and why not, if it is not).
export default function BlockingNotice({ focusRunning }: { focusRunning: boolean }) {
  const { ready, status } = useBlockingStatus();
  if (!focusRunning || !ready) return null;

  let tone = "bg-brand-soft text-brand";
  let Icon = ShieldCheck;
  let text: string;
  let role: "alert" | "status" = "status";

  if (status.error) {
    tone = "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    Icon = ShieldAlert;
    text = `Website blocking isn't working. ${status.error}`;
    role = "alert";
  } else if (!status.hostAccess) {
    tone = "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    Icon = ShieldAlert;
    text =
      'Focus Mode can\'t access websites, so nothing is blocked. Open the extension\'s details in your browser and set "Site access" to "On all sites".';
    role = "alert";
  } else if (status.ruleCount === 0) {
    tone = "bg-app text-muted border border-line";
    Icon = ShieldOff;
    text = "No websites are being blocked. Add some in the dashboard under Blocklist.";
  } else {
    text = `Blocking ${status.ruleCount} ${status.ruleCount === 1 ? "website" : "websites"}`;
  }

  return (
    <p role={role} className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium ${tone}`}>
      <Icon size={16} className="mt-px shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
