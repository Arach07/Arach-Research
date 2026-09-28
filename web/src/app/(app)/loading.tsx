// Kółeczko ładowania przy przełączaniu zakładek. Pojawia się dopiero po ~0,3 s,
// żeby przy szybkim ładowaniu nic nie migało na ułamek sekundy.
export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center opacity-0 [animation:fade-in_200ms_ease-out_300ms_forwards]"
      role="status"
      aria-label="Ładowanie"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
    </div>
  );
}
