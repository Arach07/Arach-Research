import { BottomNav } from "@/components/bottom-nav";
import { LiveQuotesProvider } from "@/components/live-quotes";
import { latestReportAt } from "@/lib/reports";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Kursy na żywo dociąga przeglądarka zaraz po otwarciu (i potem co 20 s) — strona nie czeka na nie.
  // Serwer podaje tylko datę najnowszego raportu (co minutę sprawdzamy, czy n8n dodał nowy).
  const latest = await latestReportAt();
  return (
    <LiveQuotesProvider latestReportAt={latest}>
      {/* min-h-[100dvh]: strona zawsze co najmniej na wysokość ekranu (także podczas ładowania),
          żeby telefon nie przesuwał swoich pasków i naszego dolnego menu przy zmianie zakładek */}
      {/* pt: na iPhonie apka z ekranu głównego zaczyna się pod paskiem z godziną i aparatem
          (black-translucent) — odsuwamy treść o jego wysokość, żeby "‹ Wróć" i nagłówki dało się kliknąć */}
      <main className="mx-auto min-h-[100dvh] w-full max-w-2xl flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-28">
        {children}
      </main>
      <BottomNav />
    </LiveQuotesProvider>
  );
}
