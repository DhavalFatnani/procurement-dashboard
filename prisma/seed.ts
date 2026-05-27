import {
  PrismaClient,
  Role,
  ExecutionType,
  SerialSeries,
  PRStatus,
  VendorStatus,
  CatalogItemStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import { getSeriesStartNumber } from "../lib/serial-series";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_AUTH_PASSWORD;
if (!PASSWORD) {
  throw new Error(
    "SEED_AUTH_PASSWORD is required to seed auth users. Set it in .env.local before running the seed.",
  );
}

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
      // Do not overwrite name/location on re-seed — Ops may rename warehouses in Admin.
      update: {},
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

  const lastMile = await prisma.category.upsert({
    where: { id: "seed-cat-last-mile" },
    update: { name: "Last Mile" },
    create: { id: "seed-cat-last-mile", name: "Last Mile" },
  });

  const itHardware = await prisma.category.upsert({
    where: { id: "seed-cat-it-hardware" },
    update: { name: "IT and Hardware Assets" },
    create: { id: "seed-cat-it-hardware", name: "IT and Hardware Assets" },
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

  // Last Mile: subcategory-level qty (outbound delivery ops — not in-warehouse facility).
  const lastMileRows: { name: string }[] = [
    { name: "Fuel & conveyance" },
    { name: "Vehicle maintenance & spares" },
    { name: "Delivery partner equipment & uniforms" },
    { name: "Delivery bags & carriers (operational)" },
    { name: "Hub last-mile infrastructure" },
    { name: "Reverse logistics supplies" },
    { name: "GPS & telematics" },
  ];

  for (let i = 0; i < lastMileRows.length; i++) {
    const row = lastMileRows[i]!;
    await prisma.subcategory.upsert({
      where: { id: `seed-sub-lm-${i}` },
      update: {
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
      create: {
        id: `seed-sub-lm-${i}`,
        categoryId: lastMile.id,
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
    });
  }

  // IT and Hardware Assets: catalog-item level (capital / IT assets — not warehouse facility).
  const itHardwareRows: { name: string }[] = [
    { name: "Laptops & desktops" },
    { name: "Monitors & displays" },
    { name: "Mobile devices & tablets" },
    { name: "Networking equipment" },
    { name: "Printers & scanners" },
    { name: "Server & storage" },
    { name: "Peripherals & accessories" },
    { name: "Power backup & UPS" },
    { name: "Security & surveillance" },
    { name: "Software licenses & subscriptions" },
  ];

  for (let i = 0; i < itHardwareRows.length; i++) {
    const row = itHardwareRows[i]!;
    await prisma.subcategory.upsert({
      where: { id: `seed-sub-it-${i}` },
      update: {
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
      },
      create: {
        id: `seed-sub-it-${i}`,
        categoryId: itHardware.id,
        name: row.name,
        executionType: ExecutionType.VENDOR_PURCHASE,
        series: null,
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
    const warehouseId = warehouseIds[i] ?? warehouseIds[0]!;
    const assignedWarehouseIds =
      seed.role === Role.FINANCE
        ? warehouseIds
        : seed.role === Role.OPS_HEAD
          ? warehouseIds.slice(0, Math.min(2, warehouseIds.length))
          : [warehouseId];

    await admin.auth.admin.updateUserById(id, {
      user_metadata: { role: seed.role },
      app_metadata: {
        role: seed.role,
        ...(seed.role === Role.SM
          ? { warehouseId, warehouseIds: null }
          : {
              warehouseId: assignedWarehouseIds[0]!,
              warehouseIds: assignedWarehouseIds,
            }),
      },
    });

    await prisma.user.upsert({
      where: { id },
      update: {
        email: seed.email,
        name: seed.name,
        role: seed.role,
        warehouseId: assignedWarehouseIds[0]!,
      },
      create: {
        id,
        email: seed.email,
        name: seed.name,
        role: seed.role,
        warehouseId: assignedWarehouseIds[0]!,
      },
    });

    await prisma.userWarehouse.deleteMany({ where: { userId: id } });
    await prisma.userWarehouse.createMany({
      data: assignedWarehouseIds.map((whId) => ({ userId: id, warehouseId: whId })),
      skipDuplicates: true,
    });

    userIds.push(id);
  }

  const configuredById = userIds[0]!;
  const seriesRows: { series: SerialSeries; ceiling: bigint }[] = [
    { series: SerialSeries.LOCK_TAGS, ceiling: BigInt(9_999_999) },
    { series: SerialSeries.JEWELLERY_BARCODES, ceiling: BigInt(9_999_999_999) },
    { series: SerialSeries.APPAREL_BARCODES, ceiling: BigInt(9_999_999_999) },
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

async function seedCatalogItems(opsId: string) {
  const samples: { subcategoryId: string; name: string; sku?: string; unit: string }[] = [
    {
      subcategoryId: "seed-sub-packaging-0",
      name: "Zip lock bag — medium",
      sku: "PKG-ZIP-M",
      unit: "pcs",
    },
    {
      subcategoryId: "seed-sub-packaging-1",
      name: "Courier bag — standard",
      sku: "PKG-CRR-STD",
      unit: "pcs",
    },
    {
      subcategoryId: "seed-sub-maint-0",
      name: "LED tube 18W",
      sku: "ELEC-LED-18",
      unit: "pcs",
    },
    {
      subcategoryId: "seed-sub-lock-0",
      name: "Apparel lock tag — standard",
      sku: "LT-APP-STD",
      unit: "pcs",
    },
    {
      subcategoryId: "seed-sub-it-0",
      name: "Business laptop — 14\" standard",
      sku: "IT-LAP-14-STD",
      unit: "pcs",
    },
    {
      subcategoryId: "seed-sub-it-2",
      name: "Handheld scanner — warehouse",
      sku: "IT-SCN-HH",
      unit: "pcs",
    },
    {
      subcategoryId: "seed-sub-it-4",
      name: "Label printer — thermal 4\"",
      sku: "IT-PRT-4",
      unit: "pcs",
    },
  ];

  for (const row of samples) {
    await prisma.catalogItem.upsert({
      where: {
        subcategoryId_name: {
          subcategoryId: row.subcategoryId,
          name: row.name,
        },
      },
      update: {
        status: CatalogItemStatus.ACTIVE,
        sku: row.sku ?? null,
        unit: row.unit,
      },
      create: {
        subcategoryId: row.subcategoryId,
        name: row.name,
        sku: row.sku ?? null,
        unit: row.unit,
        status: CatalogItemStatus.ACTIVE,
        createdById: opsId,
        approvedById: opsId,
        approvedAt: new Date(),
      },
    });
  }

  console.log("[seed] Sample catalog items ready.");
}

async function seedSampleVendorsAndPRs() {
  const sm = await prisma.user.findFirst({
    where: { email: "sm@knot-procurement.local" },
  });
  const ops = await prisma.user.findFirst({
    where: { email: "ops@knot-procurement.local" },
  });
  if (!sm || !ops) {
    console.warn("[seed] Skipping sample vendors/PRs — seed users first.");
    return;
  }

  const packagingSub = await prisma.subcategory.findFirst({
    where: { id: "seed-sub-packaging-0" },
  });
  const lockVendorSub = await prisma.subcategory.findFirst({
    where: { id: "seed-sub-lock-0" },
  });
  const printSub = await prisma.subcategory.findFirst({
    where: { id: "seed-sub-lock-1" },
  });
  if (!packagingSub || !lockVendorSub || !printSub || !printSub.series) {
    return;
  }
  const printSeries = printSub.series;

  await seedCatalogItems(ops.id);

  const zipBag = await prisma.catalogItem.findFirst({
    where: { subcategoryId: packagingSub.id, status: CatalogItemStatus.ACTIVE },
  });
  const lockTagItem = await prisma.catalogItem.findFirst({
    where: { subcategoryId: lockVendorSub.id, status: CatalogItemStatus.ACTIVE },
  });

  await prisma.vendor.upsert({
    where: { id: "seed-vendor-alpha" },
    update: {},
    create: {
      id: "seed-vendor-alpha",
      businessName: "Alpha Packaging Co",
      pocName: "Ravi Kumar",
      phone: "9876500001",
      email: "alpha@example.com",
      accountName: "Alpha Packaging Co",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
      status: VendorStatus.ACTIVE,
      createdById: ops.id,
    },
  });

  await prisma.vendor.upsert({
    where: { id: "seed-vendor-beta" },
    update: {},
    create: {
      id: "seed-vendor-beta",
      businessName: "Beta Supplies Ltd",
      pocName: "Meera Shah",
      phone: "9876500002",
      email: "beta@example.com",
      accountName: "Beta Supplies Ltd",
      accountNumber: "987654321098",
      ifsc: "ICIC0009876",
      bankName: "ICICI Bank",
      status: VendorStatus.ACTIVE,
      createdById: ops.id,
    },
  });

  const prDraftId = "PR-seed-draft-001";
  await prisma.purchaseRequest.upsert({
    where: { id: prDraftId },
    update: {},
    create: {
      id: prDraftId,
      categoryId: packagingSub.categoryId,
      subcategoryId: packagingSub.id,
      quantity: 500,
      warehouseId: sm.warehouseId,
      vendorId: "seed-vendor-alpha",
      executionType: ExecutionType.VENDOR_PURCHASE,
      status: PRStatus.DRAFT,
      createdById: sm.id,
      lines: zipBag
        ? {
            create: {
              lineNumber: 1,
              categoryId: packagingSub.categoryId,
              subcategoryId: packagingSub.id,
              quantity: 500,
              items: {
                create: {
                  lineItemNumber: 1,
                  catalogItemId: zipBag.id,
                  quantity: 500,
                },
              },
            },
          }
        : {
            create: {
              lineNumber: 1,
              categoryId: packagingSub.categoryId,
              subcategoryId: packagingSub.id,
              quantity: 500,
            },
          },
    },
  });

  const prMultiId = "PR-seed-multi-001";
  await prisma.purchaseRequest.upsert({
    where: { id: prMultiId },
    update: {},
    create: {
      id: prMultiId,
      categoryId: lockVendorSub.categoryId,
      subcategoryId: lockVendorSub.id,
      quantity: 1500,
      warehouseId: sm.warehouseId,
      vendorId: "seed-vendor-beta",
      executionType: ExecutionType.VENDOR_PURCHASE,
      status: PRStatus.DRAFT,
      createdById: sm.id,
      lines: {
        create: [
          {
            lineNumber: 1,
            categoryId: lockVendorSub.categoryId,
            subcategoryId: lockVendorSub.id,
            quantity: 1000,
          },
          {
            lineNumber: 2,
            categoryId: packagingSub.categoryId,
            subcategoryId: packagingSub.id,
            quantity: 500,
          },
        ],
      },
    },
  });

  const prPendingId = "PR-seed-pending-001";
  await prisma.purchaseRequest.upsert({
    where: { id: prPendingId },
    update: {},
    create: {
      id: prPendingId,
      categoryId: lockVendorSub.categoryId,
      subcategoryId: lockVendorSub.id,
      quantity: 1000,
      warehouseId: sm.warehouseId,
      vendorId: "seed-vendor-beta",
      executionType: ExecutionType.VENDOR_PURCHASE,
      status: PRStatus.PENDING_APPROVAL,
      currentVersion: 1,
      createdById: sm.id,
      lines: {
        create: {
          lineNumber: 1,
          categoryId: lockVendorSub.categoryId,
          subcategoryId: lockVendorSub.id,
          quantity: 1000,
        },
      },
      versions: {
        create: {
          versionNumber: 1,
          changedById: sm.id,
          revisionComment: "Initial submission",
        },
      },
    },
  });

  const prPrintId = `PR-${randomUUID()}`;
  const existingPrint = await prisma.purchaseRequest.findFirst({
    where: { status: PRStatus.EXECUTED_PRINT },
  });
  if (!existingPrint) {
    await prisma.purchaseRequest.create({
      data: {
        id: prPrintId,
        categoryId: printSub.categoryId,
        subcategoryId: printSub.id,
        quantity: 50,
        warehouseId: sm.warehouseId,
        executionType: ExecutionType.INTERNAL_PRINT,
        status: PRStatus.EXECUTED_PRINT,
        createdById: sm.id,
        lines: {
          create: {
            lineNumber: 1,
            categoryId: printSub.categoryId,
            subcategoryId: printSub.id,
            quantity: 50,
          },
        },
        serialReservation: {
          create: {
            id: `seed-res-${printSeries}`,
            series: printSeries,
            rangeStart: getSeriesStartNumber(printSeries),
            rangeEnd: getSeriesStartNumber(printSeries) + BigInt(49),
            quantity: 50,
            warehouseId: sm.warehouseId,
            createdById: sm.id,
            idempotencyKey: `seed-${printSeries}-1`,
          },
        },
      },
    });
  }

  console.log("[seed] Sample vendors and purchase requests ready.");
}

async function main() {
  await seedWarehouses();
  await seedCategoriesAndSubcategories();

  const opsForCatalog = await prisma.user.findFirst({
    where: { email: "ops@knot-procurement.local" },
  });
  if (opsForCatalog) {
    await seedCatalogItems(opsForCatalog.id);
  }

  const warehouseIds = (
    await prisma.warehouse.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
  ).map((w) => w.id);

  await seedUsersAndSeriesConfig(warehouseIds);

  if (process.env.SEED_SKIP_SAMPLES !== "1") {
    await seedSampleVendorsAndPRs();
  } else {
    console.log("[seed] Skipping sample vendors and purchase requests (SEED_SKIP_SAMPLES=1).");
  }

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
