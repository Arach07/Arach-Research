// Analiza techniczna — te same wzory co w n8n (n8n/src/dane-i-tematy.js, "techniczne").

const pct = (now: number, before: number | null) => (before ? ((now - before) / before) * 100 : null);

export function sma(series: number[], n: number) {
  return series.length >= n ? series.slice(-n).reduce((s, x) => s + x, 0) / n : null;
}

// RSI (14 sesji, metoda Wildera): <30 = wyprzedana, >70 = wykupiona
export function rsi(series: number[], n = 14) {
  if (series.length <= n) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = series[i] - series[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export function technicals(series: number[]) {
  const price = series[series.length - 1];
  const sma50 = sma(series, 50);
  const sma200 = sma(series, 200);
  return { rsi: rsi(series), sma50, sma200, odSma50: pct(price, sma50), odSma200: pct(price, sma200) };
}

export type RsiLevel = "oversold" | "overbought" | "neutral";

export function rsiLevel(value: number | null | undefined): RsiLevel {
  if (value == null) return "neutral";
  if (value <= 30) return "oversold";
  if (value >= 70) return "overbought";
  return "neutral";
}
