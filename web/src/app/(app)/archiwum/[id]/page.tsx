import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report-view";
import { reportById } from "@/lib/reports";

export default async function ArchiveReportPage({ params }: PageProps<"/archiwum/[id]">) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const report = await reportById(numericId);
  if (!report) notFound();

  return (
    <>
      <Link href="/archiwum" className="mb-3 inline-block text-sm text-muted hover:text-accent">
        ‹ Archiwum
      </Link>
      <ReportView report={report} />
    </>
  );
}
