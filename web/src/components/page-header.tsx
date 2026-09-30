import { BackLink } from "./back-link";

export function PageHeader({
  title,
  subtitle,
  back,
  backLabel = "Wróć",
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <BackLink href={back} label={backLabel} className="mb-3" />}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card p-6 text-center text-sm text-muted">{children}</div>;
}
