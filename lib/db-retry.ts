/** Prisma P1001 — transient pooler / network blip (common on remote Supabase + dev HMR). */
export function isPrismaConnectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P1001"
  );
}

/** Retry once after a short pause when the database host is momentarily unreachable. */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isPrismaConnectError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return fn();
  }
}
