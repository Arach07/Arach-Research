import { latestReportAt } from "@/lib/reports";

// Tylko data najnowszego raportu (~100 bajtów) — apka pyta co minutę, czy n8n dodał coś nowego.
export async function GET() {
  return Response.json({ latest: await latestReportAt() });
}
