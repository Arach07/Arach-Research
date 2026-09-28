import { BottomNav } from "@/components/bottom-nav";
import { LiveQuotesProvider } from "@/components/live-quotes";
import { liveQuotes } from "@/lib/quotes";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Pierwsze kursy z serwera; potem przeglądarka sama dociąga je co 20 s z /api/kursy
  const initial = await liveQuotes();
  return (
    <LiveQuotesProvider initial={initial}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </LiveQuotesProvider>
  );
}
