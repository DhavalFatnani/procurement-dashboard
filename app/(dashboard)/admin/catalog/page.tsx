import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function AdminCatalogRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();

  const itemId = str(sp.id) || str(sp.catalogItemId);
  const subcategoryId = str(sp.subcategoryId);

  if (itemId) {
    params.set("node", `item:${itemId}`);
  } else if (subcategoryId) {
    params.set("node", `subcategory:${subcategoryId}`);
  }

  for (const [key, value] of Object.entries(sp)) {
    if (key === "tab" || key === "id" || key === "catalogItemId" || key === "subcategoryId") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else if (value) {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  redirect(qs ? `/admin/taxonomy?${qs}` : "/admin/taxonomy");
}
