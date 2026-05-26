/** Fixed locale so SSR and client hydration produce identical date strings. */
const LOCALE = "en-IN";

const dateMedium = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });
const dateTimeMedium = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
});

function parseIso(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateMedium(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = parseIso(iso);
  return d ? dateMedium.format(d) : iso;
}

export function formatDateTimeMedium(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = parseIso(iso);
  return d ? dateTimeMedium.format(d) : iso;
}

export function formatInr(amount: string | number | null | undefined): string {
  if (amount == null) {
    return "—";
  }
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) {
    return String(amount);
  }
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "INR" }).format(n);
}
