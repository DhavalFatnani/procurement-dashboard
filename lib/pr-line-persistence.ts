import {
  CatalogItemStatus,
  ExecutionType,
  type Prisma,
} from "@prisma/client";

import {
  catalogItemAtomicityCategoryNames,
  usesCatalogItemAtomicity,
  usesSubcategoryAtomicity,
} from "@/lib/catalog-atomicity";
import {
  MAX_ITEMS_PER_PR,
  MAX_ITEMS_PER_PR_LINE,
  normalizeCatalogItemName,
} from "@/lib/catalog-items";
import { MAX_PR_LINES } from "@/lib/purchase-lines";
import { prisma } from "@/lib/prisma";

export type PRLineItemInput = {
  catalogItemId?: string;
  proposedName?: string;
  quantity: number;
};

export type PRLineInput = {
  categoryId: string;
  subcategoryId: string;
  notes?: string;
  /** Internal-print single line only */
  quantity?: number;
  items?: PRLineItemInput[];
};

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** PR create/update can run many line-item writes; default 5s tx timeout causes P2028. */
export const PR_LINE_MUTATION_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;

export function lineTotalQuantity(line: PRLineInput): number {
  if (line.items && line.items.length > 0) {
    return line.items.reduce((sum, item) => sum + item.quantity, 0);
  }
  return line.quantity ?? 0;
}

export async function validatePRLines(
  lines: PRLineInput[],
): Promise<
  | { ok: true; subs: { id: string; executionType: ExecutionType; categoryId: string }[] }
  | { ok: false; message: string }
> {
  if (lines.length < 1) {
    return { ok: false, message: "Add at least one line item." };
  }
  if (lines.length > MAX_PR_LINES) {
    return { ok: false, message: `Maximum ${MAX_PR_LINES} line items allowed.` };
  }

  const subcategoryIds = [...new Set(lines.map((line) => line.subcategoryId))];
  const subRows = await prisma.subcategory.findMany({
    where: { id: { in: subcategoryIds } },
    include: { category: { select: { name: true } } },
  });
  const subById = new Map(subRows.map((sub) => [sub.id, sub]));

  const catalogIds = [
    ...new Set(
      lines.flatMap((line) =>
        (line.items ?? [])
          .map((item) => item.catalogItemId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const catalogRows =
    catalogIds.length > 0
      ? await prisma.catalogItem.findMany({ where: { id: { in: catalogIds } } })
      : [];
  const catalogById = new Map(catalogRows.map((row) => [row.id, row]));

  const subs = [];
  let totalItems = 0;

  for (const line of lines) {
    const sub = subById.get(line.subcategoryId);
    if (!sub || sub.categoryId !== line.categoryId) {
      return { ok: false, message: "Invalid category or subcategory on a line." };
    }
    subs.push(sub);

    if (sub.executionType === ExecutionType.VENDOR_PURCHASE) {
      const categoryName = sub.category.name;

      if (usesSubcategoryAtomicity(categoryName)) {
        const qty = line.quantity ?? lineTotalQuantity(line);
        if (qty < 1) {
          return { ok: false, message: "Quantity must be at least 1." };
        }
        if (line.items && line.items.length > 0) {
          return {
            ok: false,
            message:
              "Packaging and Lock Tags use subcategory quantity only — do not add catalog items.",
          };
        }
        totalItems += 1;
      } else if (usesCatalogItemAtomicity(categoryName)) {
        const items = line.items ?? [];
        if (items.length < 1) {
          return {
            ok: false,
            message: "Each warehouse maintenance line must include at least one catalog item.",
          };
        }
        if (items.length > MAX_ITEMS_PER_PR_LINE) {
          return {
            ok: false,
            message: `Maximum ${MAX_ITEMS_PER_PR_LINE} items per line.`,
          };
        }
        totalItems += items.length;
        for (const item of items) {
          if (item.quantity < 1) {
            return { ok: false, message: "Each item quantity must be at least 1." };
          }
          const hasCatalog = Boolean(item.catalogItemId?.trim());
          const hasProposal = Boolean(item.proposedName?.trim());
          if (hasCatalog === hasProposal) {
            return {
              ok: false,
              message: "Each item must use an existing catalog item or propose a new name.",
            };
          }
          if (hasCatalog) {
            const catalog = catalogById.get(item.catalogItemId!);
            if (
              !catalog ||
              catalog.subcategoryId !== line.subcategoryId ||
              catalog.status !== CatalogItemStatus.ACTIVE
            ) {
              return { ok: false, message: "Invalid or inactive catalog item on a line." };
            }
          } else {
            const name = normalizeCatalogItemName(item.proposedName!);
            if (name.length < 2) {
              return { ok: false, message: "Proposed item names must be at least 2 characters." };
            }
          }
        }
      } else {
        return {
          ok: false,
          message: "Unsupported vendor category for purchase requests.",
        };
      }
    } else {
      const qty = line.quantity ?? 0;
      if (qty < 1) {
        return { ok: false, message: "Quantity must be at least 1." };
      }
      if (line.items && line.items.length > 0) {
        return { ok: false, message: "Internal print lines cannot include catalog items." };
      }
    }
  }

  if (totalItems > MAX_ITEMS_PER_PR) {
    return { ok: false, message: `Maximum ${MAX_ITEMS_PER_PR} catalog items per request.` };
  }

  const executionTypes = new Set(subs.map((s) => s.executionType));
  if (executionTypes.size > 1) {
    return { ok: false, message: "All lines must share the same execution type." };
  }
  if (subs[0]!.executionType === ExecutionType.INTERNAL_PRINT && lines.length > 1) {
    return { ok: false, message: "Internal print requests support a single line only." };
  }
  if (subs[0]!.executionType === ExecutionType.VENDOR_PURCHASE) {
    for (const sub of subs) {
      if (sub.executionType !== ExecutionType.VENDOR_PURCHASE) {
        return { ok: false, message: "Multi-line requests must use vendor-purchase subcategories." };
      }
    }
  }

  return { ok: true, subs };
}

export function headerFromFirstLine(
  lines: PRLineInput[],
  subs: { executionType: ExecutionType }[],
) {
  const first = lines[0]!;
  return {
    categoryId: first.categoryId,
    subcategoryId: first.subcategoryId,
    quantity: lineTotalQuantity(first),
    executionType: subs[0]!.executionType,
  };
}

async function resolveCatalogItemId(
  tx: Tx,
  subcategoryId: string,
  item: PRLineItemInput,
  createdById: string,
): Promise<string> {
  if (item.catalogItemId) {
    return item.catalogItemId;
  }

  const name = normalizeCatalogItemName(item.proposedName!);
  const existing = await tx.catalogItem.findUnique({
    where: { subcategoryId_name: { subcategoryId, name } },
  });
  if (existing) {
    if (existing.status === CatalogItemStatus.REJECTED) {
      const updated = await tx.catalogItem.update({
        where: { id: existing.id },
        data: {
          status: CatalogItemStatus.PENDING_APPROVAL,
          createdById,
          approvedById: null,
          approvedAt: null,
          rejectedReason: null,
        },
      });
      return updated.id;
    }
    return existing.id;
  }

  const created = await tx.catalogItem.create({
    data: {
      subcategoryId,
      name,
      status: CatalogItemStatus.PENDING_APPROVAL,
      createdById,
    },
  });
  return created.id;
}

/** One ACTIVE catalog row per subcategory name (Packaging / Lock Tags billing). */
async function ensureSubcategoryCatalogItem(
  tx: Tx,
  subcategoryId: string,
  subcategoryName: string,
  createdById: string,
): Promise<string> {
  const name = normalizeCatalogItemName(subcategoryName);
  const existing = await tx.catalogItem.findUnique({
    where: { subcategoryId_name: { subcategoryId, name } },
  });
  if (existing) {
    if (existing.status === CatalogItemStatus.ACTIVE) {
      return existing.id;
    }
    if (existing.status === CatalogItemStatus.INACTIVE) {
      const updated = await tx.catalogItem.update({
        where: { id: existing.id },
        data: { status: CatalogItemStatus.ACTIVE },
      });
      return updated.id;
    }
    const revived = await tx.catalogItem.update({
      where: { id: existing.id },
      data: {
        status: CatalogItemStatus.ACTIVE,
        approvedById: createdById,
        approvedAt: new Date(),
        rejectedReason: null,
      },
    });
    return revived.id;
  }

  const now = new Date();
  const created = await tx.catalogItem.create({
    data: {
      subcategoryId,
      name,
      status: CatalogItemStatus.ACTIVE,
      createdById,
      approvedById: createdById,
      approvedAt: now,
    },
  });
  return created.id;
}

export async function replacePRLines(
  tx: Tx,
  prId: string,
  lines: PRLineInput[],
  createdById: string,
  executionType: ExecutionType,
) {
  await tx.purchaseRequestLine.deleteMany({ where: { prId } });

  if (executionType !== ExecutionType.VENDOR_PURCHASE) {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      const lineQty = line.quantity ?? lineTotalQuantity(line);
      await tx.purchaseRequestLine.create({
        data: {
          prId,
          lineNumber: index + 1,
          categoryId: line.categoryId,
          subcategoryId: line.subcategoryId,
          quantity: lineQty > 0 ? lineQty : null,
          notes: line.notes?.trim() || null,
        },
      });
    }
    return;
  }

  const categoryIds = [...new Set(lines.map((line) => line.categoryId))];
  const categories = await tx.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const subcategoryIds = [...new Set(lines.map((line) => line.subcategoryId))];
  const subcategories = await tx.subcategory.findMany({
    where: { id: { in: subcategoryIds } },
    select: { id: true, name: true },
  });
  const subcategoryNameById = new Map(subcategories.map((s) => [s.id, s.name]));

  const subcategoryCatalogItemCache = new Map<string, string>();

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const lineQty = lineTotalQuantity(line);

    const prLine = await tx.purchaseRequestLine.create({
      data: {
        prId,
        lineNumber: index + 1,
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        quantity: lineQty > 0 ? lineQty : null,
        notes: line.notes?.trim() || null,
      },
    });

    const categoryName = categoryNameById.get(line.categoryId) ?? "";

    if (usesSubcategoryAtomicity(categoryName)) {
      const subName = subcategoryNameById.get(line.subcategoryId);
      if (!subName) {
        continue;
      }
      let catalogItemId = subcategoryCatalogItemCache.get(line.subcategoryId);
      if (!catalogItemId) {
        catalogItemId = await ensureSubcategoryCatalogItem(
          tx,
          line.subcategoryId,
          subName,
          createdById,
        );
        subcategoryCatalogItemCache.set(line.subcategoryId, catalogItemId);
      }
      await tx.purchaseRequestLineItem.create({
        data: {
          prLineId: prLine.id,
          catalogItemId,
          lineItemNumber: 1,
          quantity: lineQty,
        },
      });
      continue;
    }

    if (usesCatalogItemAtomicity(categoryName) && line.items) {
      let lineItemNumber = 0;
      for (const item of line.items) {
        lineItemNumber += 1;
        const catalogItemId = await resolveCatalogItemId(
          tx,
          line.subcategoryId,
          item,
          createdById,
        );
        await tx.purchaseRequestLineItem.create({
          data: {
            prLineId: prLine.id,
            catalogItemId,
            lineItemNumber,
            quantity: item.quantity,
          },
        });
      }
    }
  }
}

export async function listPendingCatalogItemsForPR(prId: string) {
  return prisma.catalogItem.findMany({
    where: {
      status: CatalogItemStatus.PENDING_APPROVAL,
      prLineItems: {
        some: {
          prLine: {
            prId,
            category: { name: { in: [...catalogItemAtomicityCategoryNames()] } },
          },
        },
      },
    },
    orderBy: [{ subcategoryId: "asc" }, { name: "asc" }],
    include: {
      subcategory: { select: { name: true, category: { select: { name: true } } } },
    },
  });
}

export async function approvePendingCatalogItems(
  tx: Tx,
  prId: string,
  input: { approvedCatalogItemIds: string[]; rejected: { id: string; reason: string }[] },
  approvedById: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const pending = await tx.catalogItem.findMany({
    where: {
      status: CatalogItemStatus.PENDING_APPROVAL,
      prLineItems: {
        some: {
          prLine: {
            prId,
            category: { name: { in: [...catalogItemAtomicityCategoryNames()] } },
          },
        },
      },
    },
    select: { id: true },
  });
  const pendingIds = new Set(pending.map((p) => p.id));
  const approvedSet = new Set(input.approvedCatalogItemIds);

  for (const id of input.approvedCatalogItemIds) {
    if (!pendingIds.has(id)) {
      return { ok: false, message: "Invalid catalog item in approval list." };
    }
  }

  for (const row of input.rejected) {
    if (!pendingIds.has(row.id)) {
      return { ok: false, message: "Invalid catalog item in rejection list." };
    }
    if (!row.reason.trim()) {
      return { ok: false, message: "Rejection reason is required for each rejected item." };
    }
  }

  const decided = new Set([
    ...input.approvedCatalogItemIds,
    ...input.rejected.map((r) => r.id),
  ]);
  if (decided.size !== pendingIds.size) {
    return {
      ok: false,
      message: "Approve or reject every proposed catalog item before approving the PR.",
    };
  }

  const now = new Date();
  if (input.approvedCatalogItemIds.length > 0) {
    await tx.catalogItem.updateMany({
      where: { id: { in: input.approvedCatalogItemIds } },
      data: {
        status: CatalogItemStatus.ACTIVE,
        approvedById,
        approvedAt: now,
        rejectedReason: null,
      },
    });
  }

  for (const row of input.rejected) {
    await tx.catalogItem.update({
      where: { id: row.id },
      data: {
        status: CatalogItemStatus.REJECTED,
        rejectedReason: row.reason.trim(),
        approvedById: null,
        approvedAt: null,
      },
    });
    await tx.purchaseRequestLineItem.deleteMany({
      where: { catalogItemId: row.id, prLine: { prId } },
    });
  }

  const remainingItems = await tx.purchaseRequestLineItem.count({
    where: { prLine: { prId } },
  });
  const remainingLines = await tx.purchaseRequestLine.count({
    where: { prId },
  });
  if (remainingItems === 0 && remainingLines > 0) {
    return {
      ok: false,
      message: "PR has no line content after rejections. Send for revision.",
    };
  }

  return { ok: true };
}
