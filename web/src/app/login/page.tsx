"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        action={formAction}
        className="card card-hero w-full max-w-sm space-y-4 p-6"
      >
        <div>
          <h1 className="text-2xl font-semibold"><span className="gold">Research</span></h1>
          <p className="text-sm text-muted">Zaloguj się, żeby zobaczyć raporty.</p>
        </div>

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="E-mail"
          className="w-full rounded-lg border border-line-strong bg-background/60 px-3 py-2.5 outline-none focus:border-accent"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Hasło"
          className="w-full rounded-lg border border-line-strong bg-background/60 px-3 py-2.5 outline-none focus:border-accent"
        />

        {error && <p className="text-sm text-down">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-gradient-to-b from-[#f7dd9c] to-accent-deep px-3 py-2.5 font-semibold text-background disabled:opacity-60"
        >
          {pending ? "Logowanie…" : "Zaloguj"}
        </button>
      </form>
    </main>
  );
}
