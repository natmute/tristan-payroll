// Money is always integer pence. Rates are always integer basis points (1% = 100).

/** amount (pence) x rate (basis points), rounded half-up to whole pence. Integer maths only. */
export function percentOf(amountPence: number, bps: number): number {
  // TODO(client): half-up rounding assumed; no sample figure falls on an exact half-penny.
  return Math.floor((amountPence * bps * 2 + 10000) / 20000);
}

/** Display helper only: 12345 -> "123.45". */
export function formatPounds(pence: number): string {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Parse "123.45" to 12345 pence without floats. */
export function parsePounds(text: string): number {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) throw new Error(`Invalid money amount: ${text}`);
  const pence = parseInt(m[2], 10) * 100 + parseInt((m[3] ?? '0').padEnd(2, '0'), 10);
  return m[1] ? -pence : pence;
}
