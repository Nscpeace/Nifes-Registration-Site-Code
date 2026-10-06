export function normalizeNigerianPhone(input: string) {
  const digits = input.replace(/[\s()-]/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234[789][01]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\+234[789][01]\d{8}$/.test(digits)) return digits;
  return null;
}
