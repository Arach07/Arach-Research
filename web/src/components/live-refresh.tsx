"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Odświeża dane strony co minutę, gdy karta jest widoczna (kursy na żywo)
export function LiveRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);

  return null;
}

export function LiveBadge({ at }: { at: string }) {
  const time = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(at));
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
      </span>
      Kursy na żywo · {time}
    </span>
  );
}
