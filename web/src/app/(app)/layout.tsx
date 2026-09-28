import { BottomNav } from "@/components/bottom-nav";
import { LiveQuotesProvider } from "@/components/live-quotes";
import { liveQuotes } from "@/lib/quotes";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Pierwsze kursy z serwera; potem przeglądarka sama dociąga je co 20 s z /api/kursy
  const initial = await liveQuotes();
  return (
    <LiveQuotesProvider initial={initial}>
      {/* min-h-[100dvh]: strona zawsze co najmniej na wysokość ekranu (także podczas ładowania),
          żeby telefon nie przesuwał swoich pasków i naszego dolnego menu przy zmianie zakładek */}
      <main className="mx-auto min-h-[100dvh] w-full max-w-2xl flex-1 px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </LiveQuotesProvider>
  );
}
