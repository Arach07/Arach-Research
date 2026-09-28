// Czyści wartości wklejone w panelu Vercel (spacje, cudzysłowy, końcowy ukośnik).
function clean(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
}

export const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
export const supabaseKey = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
