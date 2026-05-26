export function prVersionActionLabel(diffSnapshot: unknown): string {
  if (diffSnapshot == null || typeof diffSnapshot !== "object") {
    return "Updated";
  }
  const snap = diffSnapshot as Record<string, unknown>;
  if (typeof snap.action === "string") {
    return snap.action
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if ("categoryId" in snap || "subcategoryId" in snap || "quantity" in snap) {
    return "Field updates";
  }
  return "Updated";
}
