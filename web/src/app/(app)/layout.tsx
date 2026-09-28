import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
