import {
  PrismaClient,
  Role,
  ExecutionType,
  SerialSeries,
} from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const PASSWORD =
  process.env.SEED_AUTH_PASSWORD ?? "KnotSeed!ChangeMe-2026";

type SeedUserDef = { email: string; name: string; role: Role };

const SEED_USERS: SeedUserDef[] = [
  {
    email: "sm@knot-procurement.local",
    name: "Store Manager",
    role: Role.SM,
  },
  {
    email: "ops@knot-procurement.local",
    name: "Ops Head",
    role: Role.OPS_HEAD,
  },
  {
    email: "finance@knot-procurement.local",
    name: "Finance",
    role: Role.FINANCE,
  },
];

const WAREHOUSES = [
  {
    id: "seed-wh-a",
    name: "Warehouse A",
    location: "Main campus — Zone A",
  },
  {
    id: "seed-wh-b",
    name: "Warehouse B",
    location: "Main campus — Zone B",
  },
  {
    id: "seed-wh-c",
    name: "Warehouse C",
    location: "Main campus — Zone C",
  },
] as const;

async function resolveSupabaseUserId(
  admin: SupabaseClient,
  seed: SeedUserDef,
): Promise<string> {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw error;
    }
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === seed.email.toLowerCase(),
    );
    if (found) {
      return found.id;
    }
    if (data.users.length < 200) {
      break;
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: seed.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: seed.role },
  });
  if (error) {
    throw error;
  }
  if (!data.user?.id) {
    throw new Error(`Auth user create returned no id for ${seed.email}`);
  }
  return data.user.id;
}

async function seedWarehouses() {
  for (const w of WAREHOUSES) {
    await prisma.warehouse.upsert({
      where: { id: w.id },
      update: { name: w.name, location: w.location },
      create: { ...w },
    });
  }
}

async function seedCategoriesAndSubcategories() {
  const packaging = await prisma.category.upsert({
    where: { id: "seed-cat-packaging" },
    update: { name: "Packaging" },
    create: { id: "seed-cat-packaging", name: "Packaging" },
  });

  const maintenance = await prisma.category.upsert({
    where: { id: "seed-cat-wh-maintenance" },
    update: { name: "Warehouse Maintenance" },
    create: { id: "seed-cat-wh-maintenance", name: "Warehouse Maintenance" },
  });

  const lockTags = await prisma.category.upsert({
    where: { id: "seed-cat-lock-tags" },
    update: { name: "Lock Tags" },
    create: { id: "seed-cat-lock-tags", name: "Lock Tags" },
  });

  const packagingRows: { name: string }[] = [
    { name: "Primary Packaging (Zip lock Bag)" },
    { name: "Secondary Packaging (Courier Bag)" },
    { name: "Tertiary Packaging (Paper Bag)" },
  ];

  for (let i = 0; i < packagingRows.length; i++) {
    const row = packagingRows[i]!;
    await prisma.subcategory.upsert({
      where: { id: `seed-sub-packaging-${i}` },
      update: {
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
      create: {
        id: `seed-sub-packaging-${i}`,
        categoryId: packaging.id,
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
    });
  }

  const maintRows: { name: string }[] = [
    { name: "Electrical items" },
    { name: "Racks - Slotted Angle" },
    { name: "Racks - HDR" },
    { name: "Cleaning supplies" },
    { name: "Tools" },
    { name: "Repairs" },
    { name: "Safety items" },
    { name: "Stationary items" },
  ];

  for (let i = 0; i < maintRows.length; i++) {
    const row = maintRows[i]!;
    await prisma.subcategory.upsert({
      where: { id: `seed-sub-maint-${i}` },
      update: {
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
      create: {
        id: `seed-sub-maint-${i}`,
        categoryId: maintenance.id,
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
    });
  }

  const lockTagRows: {
    name: string;
    series: SerialSeries;
    executionType: ExecutionType;
  }[] = [
    {
      name: "Apparel Lock Tags",
      series: SerialSeries.LOCK_TAGS,
      executionType: ExecutionType.VENDOR_PURCHASE,
    },
    {
      name: "Jewellery Barcodes",
      series: SerialSeries.JEWELLERY_BARCODES,
      executionType: ExecutionType.INTERNAL_PRINT,
    },
    {
      name: "Accessories & Apparel Barcodes",
      series: SerialSeries.APPAREL_BARCODES,
      executionType: ExecutionType.INTERNAL_PRINT,
    },
  ];

  for (let i = 0; i < lockTagRows.length; i++) {
    const row = lockTagRows[i]!;
    await prisma.subcategory.upsert({
      where: { id: `seed-sub-lock-${i}` },
      update: {
        name: row.name,
        series: row.series,
        executionType: row.executionType,
      },
      create: {
        id: `seed-sub-lock-${i}`,
        categoryId: lockTags.id,
        name: row.name,
        series: row.series,
        executionType: row.executionType,
      },
    });
  }
}

async function seedUsersAndSeriesConfig(warehouseIds: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    console.warn(
      "\n[seed] Skipping Users and SeriesConfig: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to provision Supabase Auth + DB users.\n",
    );
    return;
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userIds: string[] = [];

  for (let i = 0; i < SEED_USERS.length; i++) {
    const seed = SEED_USERS[i]!;
    const id = await resolveSupabaseUserId(admin, seed);
    await admin.auth.admin.updateUserById(id, {
      user_metadata: { role: seed.role },
    });

    const warehouseId = warehouseIds[i] ?? warehouseIds[0]!;
    await prisma.user.upsert({
      where: { id },
      update: {
        email: seed.email,
        name: seed.name,
        role: seed.role,
        warehouseId,
      },
      create: {
        id,
        email: seed.email,
        name: seed.name,
        role: seed.role,
        warehouseId,
      },
    });
    userIds.push(id);
  }

  const configuredById = userIds[0]!;
  const seriesRows: { series: SerialSeries; ceiling: bigint }[] = [
    { series: SerialSeries.LOCK_TAGS, ceiling: BigInt(9_000_000) },
    { series: SerialSeries.JEWELLERY_BARCODES, ceiling: BigInt(9_000_000) },
    { series: SerialSeries.APPAREL_BARCODES, ceiling: BigInt(9_000_000) },
  ];

  for (const row of seriesRows) {
    await prisma.seriesConfig.upsert({
      where: { series: row.series },
      update: {
        inactivityThresholdDays: 30,
        ceilingNumber: row.ceiling,
        ceilingAlertPct: 80,
        configuredById,
      },
      create: {
        id: `seed-sc-${row.series}`,
        series: row.series,
        inactivityThresholdDays: 30,
        ceilingNumber: row.ceiling,
        ceilingAlertPct: 80,
        configuredById,
      },
    });
  }

  console.log("\n[seed] Auth users (password from SEED_AUTH_PASSWORD or default):");
  for (const u of SEED_USERS) {
    console.log(`  • ${u.email} (${u.role})`);
  }
  console.log(`  Default password: ${PASSWORD}\n`);
}

async function main() {
  await seedWarehouses();
  await seedCategoriesAndSubcategories();
  await seedUsersAndSeriesConfig(WAREHOUSES.map((w) => w.id));

  console.log("[seed] Warehouses, categories, and subcategories are ready.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
