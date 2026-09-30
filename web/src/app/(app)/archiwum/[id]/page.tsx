import { BackLink } from "@/components/back-link";
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
      <BackLink href="/archiwum" label="Archiwum" />
      <ReportView report={report} />
    </>
  );
}
