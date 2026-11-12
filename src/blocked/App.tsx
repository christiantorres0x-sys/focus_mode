import { ShieldAlert } from "lucide-react";

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto text-brand" size={40} aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">This site is blocked</h1>
        <p className="mt-2 text-sm text-muted">
          Focus Mode will block distracting sites during focus sessions starting in Phase 4.
        </p>
      </div>
    </main>
  );
}
