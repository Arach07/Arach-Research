"use client";

import { useState } from "react";

// Przełącznik widoków bez ładowania strony: wszystkie widoki są już w przeglądarce,
// kliknięcie tylko pokazuje inny. Adres (?widok=...) aktualizujemy, żeby "wstecz" i odświeżenie działały.
export function ViewTabs({
  views,
  initial,
  panels,
}: {
  views: readonly { id: string; label: string }[];
  initial: string;
  panels: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState(initial);

  const select = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === views[0].id) url.searchParams.delete("widok");
    else url.searchParams.set("widok", id);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <nav className="mb-5 flex rounded-xl border border-line bg-white/[0.03] p-1" role="tablist">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={v.id === active}
            onClick={() => select(v.id)}
            className={`flex-1 rounded-lg py-1.5 text-center text-[13px] transition-colors ${
              v.id === active ? "bg-accent/15 font-semibold text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
      {views.map((v) => (
        <div key={v.id} role="tabpanel" hidden={v.id !== active}>
          {panels[v.id]}
        </div>
      ))}
    </>
  );
}
