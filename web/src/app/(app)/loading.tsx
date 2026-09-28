// Szkielet ekranu pokazywany natychmiast po kliknięciu zakładki, zanim przyjdą dane
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Ładowanie">
      <div className="h-8 w-40 rounded-lg bg-white/[0.06]" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[76px] min-w-[7.5rem] rounded-2xl border border-line bg-white/[0.03]" />
        ))}
      </div>
      <div className="card card-hero h-32" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card h-28" />
      ))}
    </div>
  );
}
