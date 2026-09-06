export function normalizePhone(p: string): string {
  let digits = String(p || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

export function displayPhone(p: string): string {
  const n = normalizePhone(p);
  return n ? "+" + n : "";
}
