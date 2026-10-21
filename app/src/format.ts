const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar date from the API, already YYYY-MM-DD. Don't parse it with Date or the day can shift. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Indian grouping: 150000 -> 1,50,000 */
export function formatRupees(amount: string): string {
  const negative = amount.startsWith('-');
  const [whole, frac = '00'] = amount.replace('-', '').split('.');
  const grouped = groupIndian(whole);
  return `${negative ? '-' : ''}₹${grouped}.${frac}`;
}

function groupIndian(whole: string): string {
  if (whole.length <= 3) return whole;
  const head = whole.slice(0, -3);
  const tail = whole.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

export function formatPhone(phone: string): string {
  const national = phone.replace(/\D/g, '').slice(-10);
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}
