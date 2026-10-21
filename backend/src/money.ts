/** Keep money as a 2-decimal string so JSON never turns 0.10 into a float. */
export function formatMoney(value: string): string {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholeRaw, fracRaw = ''] = unsigned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  const frac = `${fracRaw}00`.slice(0, 2);
  return `${negative ? '-' : ''}${whole}.${frac}`;
}
