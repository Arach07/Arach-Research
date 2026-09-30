"use server";

import { createClient } from "@/lib/supabase/server";
import { pushSkonfigurowany, wyslij, type Subskrypcja } from "@/lib/push";

// Włączenie powiadomień na tym urządzeniu: zapis subskrypcji w bazie (RLS: tylko własne urządzenia)
export async function zapiszSubskrypcje(sub: Subskrypcja, urzadzenie: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, urzadzenie }, { onConflict: "endpoint" });
  return error ? `Nie udało się zapisać: ${error.message}` : null;
}

export async function usunSubskrypcje(endpoint: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? `Nie udało się usunąć: ${error.message}` : null;
}

// Próbne powiadomienie na wszystkie moje urządzenia — do sprawdzenia bez czekania na raport
export async function wyslijTest() {
  if (!pushSkonfigurowany()) return "Brak kluczy VAPID w ustawieniach Vercela.";
  const supabase = await createClient();
  const { data, error } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (error) return `Błąd bazy: ${error.message}`;
  if (!data?.length) return "Brak urządzeń z włączonymi powiadomieniami.";
  const wynik = await wyslij(data, {
    title: "🔔 Test powiadomień",
    body: "Działa! Tak będzie wyglądać informacja o nowym raporcie o 9:00, 14:00 i 20:00.",
    url: "/",
    tag: "test",
  });
  if (wynik.wygasle.length) await supabase.from("push_subscriptions").delete().in("endpoint", wynik.wygasle);
  if (wynik.bledy.length) return `Wysłano ${wynik.wyslane}, błędy: ${wynik.bledy.join("; ")}`;
  return null;
}
