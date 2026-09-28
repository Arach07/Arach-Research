"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6"
      >
        <div>
          <h1 className="text-xl font-semibold">Research</h1>
          <p className="text-sm text-muted">Zaloguj się, żeby zobaczyć raporty.</p>
        </div>

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="E-mail"
          className="w-full rounded-lg border border-line bg-background px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Hasło"
          className="w-full rounded-lg border border-line bg-background px-3 py-2"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Logowanie…" : "Zaloguj"}
        </button>
      </form>
    </main>
  );
}
