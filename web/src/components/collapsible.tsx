"use client";

import { useEffect, useRef, useState } from "react";

// Długi tekst zwinięty do ~pół ekranu z wygaszeniem na dole i przyciskiem "Rozwiń / Zwiń".
// Jeśli treść jest krótka, przycisk się nie pokazuje.
export function Collapsible({ children, collapsedHeight = "50vh" }: { children: React.ReactNode; collapsedHeight?: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    const box = boxRef.current;
    if (!content || !box) return;
    const check = () => setOverflows(content.scrollHeight > box.clientHeight + 8);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const collapsed = !open && overflows;

  return (
    <div>
      <div
        ref={boxRef}
        className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: open ? "none" : collapsedHeight }}
      >
        <div ref={contentRef}>{children}</div>
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f0e14] to-transparent" />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => {
            // Przy zwijaniu wracamy na górę karty, żeby nie zostać w pustym miejscu strony
            if (open) boxRef.current?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
            setOpen(!open);
          }}
          aria-expanded={open}
          className="mt-3 w-full rounded-xl border border-line-strong bg-white/[0.03] py-2 text-sm font-medium text-accent hover:bg-accent/10"
        >
          {open ? "Zwiń ▴" : "Rozwiń, żeby przeczytać całość ▾"}
        </button>
      )}
    </div>
  );
}
