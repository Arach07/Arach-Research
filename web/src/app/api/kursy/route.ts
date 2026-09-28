import { liveQuotes } from "@/lib/quotes";

// Same kursy na żywo (NBP, Yahoo, CoinGecko) — apka odpytuje to co 20 s.
// Nie dotyka bazy Supabase, więc nie zużywa jej limitu transferu.
export async function GET() {
  return Response.json(await liveQuotes());
}
