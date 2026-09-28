"use client";

import { useActionState } from "react";
import { checkLink, type CheckState } from "./actions";

const VERDICTS = {
  scam: { icon: "🔴", title: "OSZUSTWO", style: "border-down/60 bg-down/10 text-down" },
  suspicious: { icon: "🟡", title: "Podejrzana strona", style: "border-accent/60 bg-accent/10 text-accent" },
  trusted: { icon: "🟢", title: "Oficjalna domena", style: "border-up/50 bg-up/10 text-up" },
  unknown: { icon: "⚪", title: "Brak na liście CERT", style: "border-line-strong bg-white/[0.03] text-foreground" },
};

export function LinkChecker() {
  const [result, formAction, pending] = useActionState<CheckState, FormData>(checkLink, null);

  return (
    <section className="card card-hero p-5">
      <h2 className="font-semibold">Sprawdź link</h2>
      <p className="mt-1 text-sm text-muted">
        Wklej podejrzany adres — sprawdzimy go na liście {`ok. 130 tys.`} niebezpiecznych domen CERT Polska.
      </p>

      <form action={formAction} className="mt-4 flex gap-2">
        <input
          name="url"
          required
          inputMode="url"
          autoComplete="off"
          placeholder="np. zysk-orlen24.com"
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-background/60 px-3 py-2.5 text-[15px] outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-b from-[#f7dd9c] to-accent-deep px-4 font-semibold text-background disabled:opacity-60"
        >
          {pending ? "…" : "Sprawdź"}
        </button>
      </form>

      {result && "error" in result && <p className="mt-3 text-sm text-down">{result.error}</p>}

      {result && "verdict" in result && (
        <div className={`mt-4 rounded-xl border p-4 ${VERDICTS[result.verdict].style}`}>
          <div className="font-semibold">
            {VERDICTS[result.verdict].icon} {VERDICTS[result.verdict].title}
          </div>
          <div className="tabular mt-0.5 break-all text-xs opacity-80">{result.domain}</div>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground/90">
            {result.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
