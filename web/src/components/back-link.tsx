import Link from "next/link";

// Przycisk powrotu (z raportu do Rynków, ze spółki do listy itd.): złota strzałka w zaokrąglonej ramce,
// wysoki na 36 px, żeby łatwo trafić palcem
export function BackLink({ href, label, className = "mb-4" }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card pr-3.5 pl-2.5 text-sm font-medium text-foreground/90 transition-colors hover:border-line-strong hover:text-accent active:scale-[0.97] ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="h-4 w-4 text-accent transition-transform group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.5 4.5 7 10l5.5 5.5" />
      </svg>
      {label}
    </Link>
  );
}
