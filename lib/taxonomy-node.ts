export type TaxonomyNodeRef =
  | { type: "category"; id: string }
  | { type: "subcategory"; id: string }
  | { type: "item"; id: string };

export function formatNodeParam(ref: TaxonomyNodeRef): string {
  return `${ref.type}:${ref.id}`;
}

export function parseNodeParam(value: string | null): TaxonomyNodeRef | null {
  if (!value) return null;
  const [type, id] = value.split(":");
  if (!id) return null;
  if (type === "category" || type === "subcategory" || type === "item") {
    return { type, id };
  }
  return null;
}
