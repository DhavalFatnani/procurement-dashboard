"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import {
  getWarehouseById as getWarehouseByIdQuery,
  getWarehouseOptions as getWarehouseOptionsQuery,
  getWarehouses as getWarehousesQuery,
} from "@/lib/queries/warehouses";
import { revalidateInboxCache, revalidateSerialGovernance } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { ALL_DASHBOARD_ROLES, OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";

function revalidateWarehouseSurfaces() {
  revalidateTag("warehouses");
  revalidateInboxCache();
  revalidatePath("/admin/warehouses");
  revalidatePath("/profile");
  revalidatePath("/purchase-requests/new");
  revalidateSerialGovernance();
  revalidatePath("/purchase-requests");
  revalidatePath("/purchase-orders");
  revalidatePath("/goods-receipt");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/admin/users");
}

export async function getWarehouses() {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  return getWarehousesQuery();
}

export async function getWarehouseOptions() {
  await requireRoles([...ALL_DASHBOARD_ROLES]);
  return getWarehouseOptionsQuery();
}

export async function getWarehouseById(id: string) {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  return getWarehouseByIdQuery(id);
}

export type WarehouseInput = {
  name: string;
  location: string;
};

function validate(input: WarehouseInput): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.location.trim()) return "Location is required.";
  if (input.name.trim().length > 80) return "Name is too long.";
  if (input.location.trim().length > 200) return "Location is too long.";
  return null;
}

export async function createWarehouse(input: WarehouseInput): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const err = validate(input);
  if (err) return { ok: false, message: err };

  await prisma.warehouse.create({
    data: { name: input.name.trim(), location: input.location.trim() },
  });
  revalidateWarehouseSurfaces();
  return { ok: true };
}

export async function updateWarehouse(
  id: string,
  input: WarehouseInput,
): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const err = validate(input);
  if (err) return { ok: false, message: err };

  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: "Warehouse not found." };

  await prisma.warehouse.update({
    where: { id },
    data: { name: input.name.trim(), location: input.location.trim() },
  });
  revalidateWarehouseSurfaces();
  return { ok: true };
}
