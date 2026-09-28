"use server";

import { checkDomain, type CheckResult } from "@/lib/cert";
import { createClient } from "@/lib/supabase/server";

export type CheckState = CheckResult | { error: string } | null;

export async function checkLink(_prev: CheckState, formData: FormData): Promise<CheckState> {
  // Akcja serwerowa jest publicznym endpointem — sprawdzamy, czy to zalogowany użytkownik
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Zaloguj się ponownie." };

  return checkDomain(String(formData.get("url") ?? ""));
}
