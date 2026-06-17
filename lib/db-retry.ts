function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function prismaCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Prisma P1001 — host unreachable (common on remote Supabase + dev HMR). */
export function isPrismaConnectError(error: unknown): boolean {
  return prismaCode(error) === "P1001";
}

/** Pool checkout, idle socket drops, and remote pooler blips — safe to retry once. */
export function isTransientDbError(error: unknown): boolean {
  const code = prismaCode(error);
  if (code === "P1001" || code === "P2024" || code === "P1008" || code === "P1017") {
    return true;
  }
  const message = errorMessage(error);
  return /connection terminated|connection timeout|ECONNRESET|ETIMEDOUT|Unable to check out|Connection terminated unexpectedly|EMAXCONNSESSION|max clients reached/i.test(
    message,
  );
}

/** Retry once after a short pause when the database is momentarily unreachable. */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}
