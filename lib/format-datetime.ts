/** Fixed locale + timezone so SSR (Vercel) and client hydration produce identical strings. */
const LOCALE = "en-IN";
/** Business timezone — avoids UTC-on-server vs IST-in-browser hydration mismatches. */
const TIME_ZONE = "Asia/Kolkata";

const dateMedium = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeZone: TIME_ZONE,
});
const dateTimeMedium = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
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
