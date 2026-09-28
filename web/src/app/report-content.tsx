const URL_RE = /(https?:\/\/[^\s]+)/g;
// Linia źródła z n8n: "- bankier.pl https://..."
const SOURCE_LINE_RE = /^- (.+?) (https?:\/\/\S+)$/;

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

// Wyświetla treść raportu z klikalnymi linkami do źródeł.
export function ReportContent({ text }: { text: string }) {
  return (
    <div className="space-y-1 leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;

        const source = line.match(SOURCE_LINE_RE);
        if (source) {
          return (
            <p key={i} className="text-sm">
              - <Link href={source[2]}>{source[1]}</Link>
            </p>
          );
        }

        return (
          <p key={i}>
            {line.split(URL_RE).map((part, j) =>
              /^https?:///.test(part) ? (
                <Link key={j} href={part}>
                  {hostname(part)}
                </Link>
              ) : (
                part
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}
