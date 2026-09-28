// Lista niebezpiecznych domen CERT Polska (ok. 130 tys. wpisów, ~2,6 MB).
// Trzymamy ją w pamięci serwera przez godzinę, żeby nie pobierać przy każdym sprawdzeniu.
const CERT_URL = "https://hole.cert.pl/domains/v2/domains.txt";
const TTL_MS = 60 * 60 * 1000;

let cache: { domains: Set<string>; fetchedAt: number } | null = null;

async function certDomains() {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.domains;
  const response = await fetch(CERT_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`CERT: HTTP ${response.status}`);
  const text = await response.text();
  const domains = new Set(
    text
      .split("\n")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );
  cache = { domains, fetchedAt: Date.now() };
  return domains;
}

// Oficjalne domeny, pod które najczęściej podszywają się oszuści
const TRUSTED = [
  "bankier.pl", "money.pl", "pb.pl", "parkiet.com", "rp.pl", "businessinsider.com.pl",
  "gpw.pl", "knf.gov.pl", "nbp.pl", "gov.pl", "cert.pl", "policja.pl",
  "pkobp.pl", "ipko.pl", "pekao.com.pl", "mbank.pl", "ing.pl", "santander.pl", "millennium.pl",
  "aliorbank.pl", "credit-agricole.pl", "bnpparibas.pl", "xtb.com", "bossa.pl",
  "orlen.pl", "pzu.pl", "zus.pl", "podatki.gov.pl",
  "reuters.com", "bloomberg.com", "cnbc.com", "investing.com", "yahoo.com",
  "coindesk.com", "cointelegraph.com", "coingecko.com", "binance.com", "revolut.com",
];

const BRANDS = /pko|pekao|mbank|santander|millennium|alior|orlen|pzu|zus|knf|gpw|nbp|revolut|binance|xtb|lotos|pge|allegro|inpost|olx/;
const MONEY_WORDS = /invest|inwest|crypto|krypto|bitcoin|btc|trade|trading|zarob|zysk|profit|forex|broker|dochod|bonus|wyplat|platform|ai-?bot/;
const RISKY_TLDS = /\.(xyz|top|live|icu|sbs|cfd|online|site|click|shop|digital|pro|space|fun|buzz|rest|monster|quest|lat|bond)$/;

export type Verdict = "scam" | "suspicious" | "trusted" | "unknown";

export type CheckResult = {
  input: string;
  domain: string;
  verdict: Verdict;
  reasons: string[];
};

function parentDomains(domain: string) {
  const parts = domain.split(".");
  return parts.slice(0, -1).map((_, i) => parts.slice(i).join("."));
}

export function extractDomain(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export async function checkDomain(input: string): Promise<CheckResult | { error: string }> {
  const domain = extractDomain(input);
  if (!domain) return { error: "To nie wygląda na adres strony. Wklej np. https://przyklad.pl/strona" };

  const parents = parentDomains(domain);

  let domains: Set<string>;
  try {
    domains = await certDomains();
  } catch {
    return { error: "Nie udało się pobrać listy CERT Polska. Spróbuj za chwilę." };
  }

  const onCert = parents.find((d) => domains.has(d));
  if (onCert) {
    return {
      input,
      domain,
      verdict: "scam",
      reasons: [
        `Domena ${onCert} jest na liście ostrzeżeń CERT Polska — to potwierdzone oszustwo.`,
        "Nie podawaj tam żadnych danych, nie wpłacaj pieniędzy, nie instaluj aplikacji.",
      ],
    };
  }

  if (parents.some((d) => TRUSTED.includes(d))) {
    return {
      input,
      domain,
      verdict: "trusted",
      reasons: ["To oficjalna domena znanej instytucji lub portalu."],
    };
  }

  const reasons: string[] = [];
  if (BRANDS.test(domain)) {
    reasons.push("Nazwa zawiera markę banku/firmy, ale to NIE jest jej oficjalna domena — typowe podszywanie się.");
  }
  if (MONEY_WORDS.test(domain)) {
    reasons.push("Nazwa sugeruje inwestycje/zarobki (np. trade, invest, btc) — tak wyglądają domeny fałszywych platform.");
  }
  if (RISKY_TLDS.test(domain)) {
    reasons.push(`Końcówka .${domain.split(".").pop()} jest tania i często używana przez oszustów.`);
  }
  if (domain.startsWith("xn--") || domain.includes(".xn--")) {
    reasons.push("Domena zawiera znaki udające litery (punycode) — możliwa podróbka znanej nazwy.");
  }
  if ((domain.match(/-/g) ?? []).length >= 3 || /\d{3,}/.test(domain)) {
    reasons.push("Dużo myślników lub cyfr w nazwie — często spotykane w jednorazowych domenach oszustów.");
  }

  if (reasons.length) return { input, domain, verdict: "suspicious", reasons };

  return {
    input,
    domain,
    verdict: "unknown",
    reasons: [
      "Domeny nie ma na liście CERT Polska i nie widać typowych sygnałów oszustwa.",
      "To nie gwarancja bezpieczeństwa — nowe oszustwa trafiają na listę z opóźnieniem.",
    ],
  };
}
