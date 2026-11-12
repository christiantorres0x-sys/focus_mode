import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface CardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

export default function Card({ title, description, icon: Icon, className = "", children }: CardProps) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      {title && (
        <header className="mb-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {Icon && <Icon size={18} className="text-brand" aria-hidden="true" />}
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
