/**
 * Standard result shape returned by mutation server actions that don't carry a
 * payload. Centralizing the type keeps the action signatures consistent without
 * changing any runtime shape: `{ ok: true }` on success, `{ ok: false, message }`
 * with a user-facing message on failure.
 */
export type MutationResult = { ok: boolean; message?: string };
