"use server";

import { revalidatePath } from "next/cache";
import {
  ExecutionType,
  POStatus,
  PRStatus,
  Role,
} from "@prisma/client";

import { getSessionUser } from "@/lib/auth";
import { dbSerial, paginatedQuery } from "@/lib/db-serial";
import { newPurchaseOrderId, newPurchaseRequestId } from "@/lib/ids";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { assertPRStatusTransition, evaluatePRStatus } from "@/lib/prStatus";
import { requireRoles } from "@/lib/server-action-guard";

export type PurchaseRequestListRow = {
  id: string;
  categoryName: string;
  subcategoryName: string;
  warehouseName: string;
  quantity: number;
  vendorName: string | null;
  executionType: ExecutionType;
  status: PRStatus;
  versionLabel: string;
  createdByName: string;
  createdAt: string;
};

export type CategoryOption = { id: string; name: string };
export type SubcategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  executionType: ExecutionType;
};
export type WarehouseOption = { id: string; name: string };
export type UserOption = { id: string; name: string };

export async function getFilterOptions(): Promise<{
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  warehouses: WarehouseOption[];
  creators: UserOption[];
}> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);

  const [categories, subcategories, warehouses, creators] = await dbSerial(
    () => prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    () =>
      prisma.subcategory.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, categoryId: true, executionType: true },
      }),
    () => prisma.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    () =>
      prisma.user.findMany({
        where: { role: { in: [Role.SM, Role.OPS_HEAD] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
  );

  return { categories, subcategories, warehouses, creators };
}

export type PurchaseRequestFilters = {
  statuses?: PRStatus[];
  categoryId?: string;
  subcategoryId?: string;
  executionType?: ExecutionType;
  warehouseId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getPurchaseRequests(
  filters: PurchaseRequestFilters & { page?: number; pageSize?: number },
): Promise<Paginated<PurchaseRequestListRow>> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

  const clauses: object[] = [];

  if (user.role === Role.SM) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { warehouseId: true },
    });
    if (dbUser?.warehouseId) {
      clauses.push({ warehouseId: dbUser.warehouseId });
    }
  } else if (filters.warehouseId) {
    clauses.push({ warehouseId: filters.warehouseId });
  }

  if (filters.statuses?.length) {
    clauses.push({ status: { in: filters.statuses } });
  }
  if (filters.categoryId) {
    clauses.push({ categoryId: filters.categoryId });
  }
  if (filters.subcategoryId) {
    clauses.push({ subcategoryId: filters.subcategoryId });
  }
  if (filters.executionType) {
    clauses.push({ executionType: filters.executionType });
  }
  if (filters.createdById) {
    clauses.push({ createdById: filters.createdById });
  }
  if (filters.dateFrom) {
    clauses.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    clauses.push({ createdAt: { lte: end } });
  }

  const where = clauses.length > 0 ? { AND: clauses } : {};
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const paginated = await paginatedQuery({
    page,
    pageSize,
    count: () => prisma.purchaseRequest.count({ where }),
    findMany: () =>
      prisma.purchaseRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          warehouse: { select: { name: true } },
          vendor: { select: { businessName: true } },
          createdBy: { select: { name: true } },
        },
      }),
  });

  return {
    ...paginated,
    items: paginated.items.map((pr) => ({
      id: pr.id,
      categoryName: pr.category.name,
      subcategoryName: pr.subcategory.name,
      warehouseName: pr.warehouse.name,
      quantity: pr.quantity,
      vendorName:
        pr.executionType === ExecutionType.INTERNAL_PRINT
          ? null
          : (pr.vendor?.businessName ?? null),
      executionType: pr.executionType,
      status: pr.status,
      versionLabel: `V${pr.currentVersion}`,
      createdByName: pr.createdBy.name,
      createdAt: pr.createdAt.toISOString(),
    })),
  };
}

export type PRFormData = {
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  vendorId?: string | null;
  vendorRequestId?: string | null;
};

export type PRDetail = {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  quantity: number;
  warehouseId: string;
  warehouseName: string;
  vendorId: string | null;
  vendorName: string | null;
  executionType: ExecutionType;
  status: PRStatus;
  currentVersion: number;
  revisionCount: number;
  vendorRequestId: string | null;
  vendorRequestStatus: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  versions: {
    id: string;
    versionNumber: number;
    changedByName: string;
    changedAt: string;
    revisionComment: string | null;
  }[];
  purchaseOrder: { id: string; status: POStatus; createdAt: string } | null;
  serialReservation: {
    id: string;
    series: string;
    rangeStart: string;
    rangeEnd: string;
    quantity: number;
    createdByName: string;
    createdAt: string;
  } | null;
  latestRevision: {
    comment: string;
    byName: string;
    at: string;
  } | null;
  progress: {
    prApproved: boolean;
    poCreated: boolean;
    grnRecorded: boolean;
    invoiceUploaded: boolean;
    paymentReceived: boolean;
  };
};

async function assertVendorReady(pr: {
  vendorId: string | null;
  vendorRequestId: string | null;
}) {
  if (pr.vendorRequestId) {
    const vr = await prisma.vendorRequest.findUnique({
      where: { id: pr.vendorRequestId },
      select: { status: true, businessName: true },
    });
    if (vr?.status === "PENDING") {
      throw new Error(
        `Vendor request for ${vr.businessName} is still pending Ops Head activation.`,
      );
    }
  }
  if (!pr.vendorId && !pr.vendorRequestId) {
    throw new Error("Select a vendor before submitting for approval.");
  }
}

export async function getPRById(id: string): Promise<PRDetail | null> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      category: true,
      subcategory: true,
      warehouse: true,
      vendor: true,
      vendorRequest: true,
      createdBy: true,
      versions: {
        orderBy: { changedAt: "desc" },
        include: { changedBy: { select: { name: true } } },
      },
      purchaseOrder: {
        include: {
          grns: true,
          invoices: true,
        },
      },
      serialReservation: { include: { createdBy: { select: { name: true } } } },
    },
  });

  if (!pr) {
    return null;
  }

  if (user.role === Role.SM && pr.createdById !== user.id) {
    return null;
  }

  const revisionVersion = pr.versions.find(
    (v) => v.revisionComment && pr.status === PRStatus.REVISION_REQUIRED,
  );

  const po = pr.purchaseOrder;
  const grnCount = po?.grns.length ?? 0;
  const invoiceCount = po?.invoices.length ?? 0;
  const paidCount =
    po?.invoices.filter((i) => i.paymentStatus === "PAID").length ?? 0;

  return {
    id: pr.id,
    categoryId: pr.categoryId,
    categoryName: pr.category.name,
    subcategoryId: pr.subcategoryId,
    subcategoryName: pr.subcategory.name,
    quantity: pr.quantity,
    warehouseId: pr.warehouseId,
    warehouseName: pr.warehouse.name,
    vendorId: pr.vendorId,
    vendorName: pr.vendor?.businessName ?? pr.vendorRequest?.businessName ?? null,
    executionType: pr.executionType,
    status: pr.status,
    currentVersion: pr.currentVersion,
    revisionCount: pr.revisionCount,
    vendorRequestId: pr.vendorRequestId,
    vendorRequestStatus: pr.vendorRequest?.status ?? null,
    createdById: pr.createdById,
    createdByName: pr.createdBy.name,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
    versions: pr.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      changedByName: v.changedBy.name,
      changedAt: v.changedAt.toISOString(),
      revisionComment: v.revisionComment,
    })),
    purchaseOrder: po
      ? { id: po.id, status: po.status, createdAt: po.createdAt.toISOString() }
      : null,
    serialReservation: pr.serialReservation
      ? {
          id: pr.serialReservation.id,
          series: pr.serialReservation.series,
          rangeStart: pr.serialReservation.rangeStart.toString(),
          rangeEnd: pr.serialReservation.rangeEnd.toString(),
          quantity: pr.serialReservation.quantity,
          createdByName: pr.serialReservation.createdBy.name,
          createdAt: pr.serialReservation.createdAt.toISOString(),
        }
      : null,
    latestRevision: revisionVersion
      ? {
          comment: revisionVersion.revisionComment ?? "",
          byName: revisionVersion.changedBy.name,
          at: revisionVersion.changedAt.toISOString(),
        }
      : null,
    progress: {
      prApproved:
        pr.status === PRStatus.APPROVED ||
        pr.status === PRStatus.CONVERTED_TO_PO ||
        pr.status === PRStatus.EXECUTED_PRINT,
      poCreated: !!po,
      grnRecorded: grnCount > 0,
      invoiceUploaded: invoiceCount > 0,
      paymentReceived: paidCount > 0 && paidCount === invoiceCount && invoiceCount > 0,
    },
  };
}

export async function createPR(data: PRFormData): Promise<{ ok: boolean; prId?: string; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const sub = await prisma.subcategory.findUnique({ where: { id: data.subcategoryId } });
  if (!sub) {
    return { ok: false, message: "Invalid subcategory." };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { warehouseId: true },
  });
  if (!dbUser) {
    return { ok: false, message: "User record not found." };
  }

  const prId = newPurchaseRequestId();
  await prisma.purchaseRequest.create({
    data: {
      id: prId,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
      quantity: data.quantity,
      warehouseId: dbUser.warehouseId,
      vendorId: data.vendorId || null,
      vendorRequestId: data.vendorRequestId || null,
      executionType: sub.executionType,
      status: PRStatus.DRAFT,
      createdById: user.id,
    },
  });

  revalidatePath("/purchase-requests");
  return { ok: true, prId };
}

export async function updatePR(
  prId: string,
  data: PRFormData,
): Promise<{ ok: boolean; message?: string }> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr || (pr.status !== PRStatus.DRAFT && pr.status !== PRStatus.REVISION_REQUIRED)) {
    return { ok: false, message: "PR cannot be edited in its current status." };
  }

  const sub = await prisma.subcategory.findUnique({ where: { id: data.subcategoryId } });
  if (!sub) {
    return { ok: false, message: "Invalid subcategory." };
  }

  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: {
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
      quantity: data.quantity,
      vendorId: data.vendorId || null,
      vendorRequestId: data.vendorRequestId || null,
      executionType: sub.executionType,
    },
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  return { ok: true };
}

export async function submitPR(prId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  try {
    evaluatePRStatus(pr, PRStatus.PENDING_APPROVAL);
    if (pr.executionType === ExecutionType.VENDOR_PURCHASE) {
      await assertVendorReady(pr);
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot submit." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.PENDING_APPROVAL },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: 1,
        changedById: user.id,
        revisionComment: "Submitted for approval",
        diffSnapshot: { action: "SUBMIT" },
      },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  return { ok: true };
}

export async function cancelPR(prId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  try {
    evaluatePRStatus(pr, PRStatus.CANCELLED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot cancel." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.CANCELLED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: "Cancelled",
        diffSnapshot: { action: "CANCELLED" },
      },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  return { ok: true };
}

export async function forceClosePR(
  prId: string,
  reason: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.FORCE_CANCELLED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: trimmed,
        diffSnapshot: { action: "FORCE_CLOSE", reason: trimmed },
      },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  return { ok: true };
}

export async function resubmitPR(
  prId: string,
  data: PRFormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr || pr.status !== PRStatus.REVISION_REQUIRED) {
    return { ok: false, message: "PR is not awaiting revision." };
  }

  if (pr.revisionCount >= 3) {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: PRStatus.FORCE_CANCELLED },
      });
      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: pr.currentVersion,
          changedById: user.id,
          revisionComment: "Force cancelled after 3 revision cycles",
          diffSnapshot: { action: "FORCE_CANCELLED_REVISION_CAP" },
        },
      });
    });
    revalidatePath("/purchase-requests");
    revalidatePath(`/purchase-requests/${prId}`);
    return { ok: false, message: "Maximum revision cycles reached. PR was force cancelled." };
  }

  const sub = await prisma.subcategory.findUnique({ where: { id: data.subcategoryId } });
  if (!sub) {
    return { ok: false, message: "Invalid subcategory." };
  }

  const diff = {
    categoryId: { from: pr.categoryId, to: data.categoryId },
    subcategoryId: { from: pr.subcategoryId, to: data.subcategoryId },
    quantity: { from: pr.quantity, to: data.quantity },
    vendorId: { from: pr.vendorId, to: data.vendorId ?? null },
  };

  try {
    evaluatePRStatus(pr, PRStatus.PENDING_APPROVAL);
    await assertVendorReady({
      vendorId: data.vendorId ?? null,
      vendorRequestId: data.vendorRequestId ?? pr.vendorRequestId,
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot resubmit." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: {
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        quantity: data.quantity,
        vendorId: data.vendorId || null,
        vendorRequestId: data.vendorRequestId ?? pr.vendorRequestId,
        executionType: sub.executionType,
        status: PRStatus.PENDING_APPROVAL,
        currentVersion: { increment: 1 },
      },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion + 1,
        changedById: user.id,
        revisionComment: "Resubmitted after revision",
        diffSnapshot: diff,
      },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  return { ok: true };
}

export async function createVendorRequest(
  data: { businessName: string; pocName: string; phone: string; email: string },
  prId?: string,
): Promise<{ ok: boolean; requestId?: string; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

  const request = await prisma.vendorRequest.create({
    data: {
      businessName: data.businessName.trim(),
      pocName: data.pocName.trim(),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      requestedById: user.id,
      linkedPRId: prId ?? null,
      status: "PENDING",
    },
  });

  if (prId) {
    await prisma.purchaseRequest.update({
      where: { id: prId },
      data: { vendorRequestId: request.id, vendorId: null },
    });
    revalidatePath(`/purchase-requests/${prId}`);
  }

  revalidatePath("/vendors");
  revalidatePath("/purchase-requests");
  return { ok: true, requestId: request.id };
}

export async function createPOFromPR(prId: string): Promise<{ ok: boolean; poId?: string; message?: string }> {
  await requireRoles([Role.OPS_HEAD]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { purchaseOrder: true },
  });

  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }
  if (pr.purchaseOrder) {
    return { ok: false, message: "A purchase order already exists for this PR." };
  }
  if (!pr.vendorId) {
    return { ok: false, message: "Vendor is required to create a PO." };
  }

  assertPRStatusTransition(pr.status, PRStatus.CONVERTED_TO_PO);

  const poId = newPurchaseOrderId();

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.create({
      data: {
        id: poId,
        prId: pr.id,
        vendorId: pr.vendorId!,
        orderedQty: pr.quantity,
        status: POStatus.OPEN,
      },
    });
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.CONVERTED_TO_PO },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/purchase-orders");
  return { ok: true, poId };
}

export async function approvePR(prId: string): Promise<{ ok: boolean; message?: string }> {
  await requireRoles([Role.OPS_HEAD]);

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.APPROVED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.APPROVED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: "Approved",
        diffSnapshot: { action: "APPROVED" },
      },
    });
  });

  const poResult = await createPOFromPR(prId);
  if (!poResult.ok) {
    return { ok: false, message: poResult.message ?? "Failed to create PO." };
  }

  return { ok: true };
}

export async function rejectPR(
  prId: string,
  reason: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.REJECTED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.REJECTED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: trimmed,
        diffSnapshot: { action: "REJECTED", reason: trimmed },
      },
    });
  });

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${prId}`);
  return { ok: true };
}

export async function sendForRevision(
  prId: string,
  revisionComment: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const comment = revisionComment.trim();
  if (!comment) {
    return { ok: false, message: "Revision comment is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.REVISION_REQUIRED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: {
        status: PRStatus.REVISION_REQUIRED,
        revisionCount: { increment: 1 },
      },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: comment,
        diffSnapshot: { action: "REVISION_REQUIRED", revisionComment: comment },
      },
    });
  });

  revalidatePath("/purchase-requests");
  return { ok: true };
}
