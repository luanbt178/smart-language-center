// Ngày hiện tại theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD.
export function todayVN(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function addDaysVN(days: number): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000 + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
