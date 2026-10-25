// Tính tiền bằng số nguyên "xu" (2 chữ số thập phân) để tránh sai số số thực.
export function toCents(text: string): bigint | null {
  const value = text.trim();

  if (!/^\d{1,13}(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [whole, fraction = ""] = value.split(".");

  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function fromCents(cents: bigint): string {
  const negative = cents < BigInt(0);
  const abs = negative ? -cents : cents;
  const whole = abs / BigInt(100);
  const fraction = (abs % BigInt(100)).toString().padStart(2, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}
