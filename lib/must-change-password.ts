export const MUST_CHANGE_PASSWORD_KEY = "must_change_password";

export function mustChangePassword(metadata: Record<string, unknown>): boolean {
  return metadata[MUST_CHANGE_PASSWORD_KEY] === true;
}
