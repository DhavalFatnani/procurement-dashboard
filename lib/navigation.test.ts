import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import { FINANCE_ROUTES } from "@/lib/finance-routes";
import {
  defaultLandingFor,
  getNavGroupsForRole,
  getNavItemsForRole,
} from "@/lib/navigation";

describe("defaultLandingFor", () => {
  it("sends SM and Ops Head to /dashboard", () => {
    expect(defaultLandingFor(Role.SM)).toBe("/dashboard");
    expect(defaultLandingFor(Role.OPS_HEAD)).toBe("/dashboard");
  });

  it("sends Finance to invoice settlement", () => {
    expect(defaultLandingFor(Role.FINANCE)).toBe(FINANCE_ROUTES.invoiceSettlement);
  });
});

describe("getNavGroupsForRole", () => {
  it("returns Insights + Work + Governance for SM, and adds Admin for Ops Head", () => {
    const sm = getNavGroupsForRole(Role.SM).map((g) => g.id);
    expect(sm).toEqual(["insights", "work", "governance"]);
    const ops = getNavGroupsForRole(Role.OPS_HEAD).map((g) => g.id);
    expect(ops).toEqual(["insights", "work", "governance", "admin"]);
  });

  it("returns Payables + Insights + Work for Finance", () => {
    const groups = getNavGroupsForRole(Role.FINANCE).map((g) => g.id);
    expect(groups).toEqual(["payables", "insights", "work"]);
  });

  it("scopes Admin to Ops Head only", () => {
    expect(
      getNavGroupsForRole(Role.SM).find((g) => g.id === "admin"),
    ).toBeUndefined();
    expect(
      getNavGroupsForRole(Role.FINANCE).find((g) => g.id === "admin"),
    ).toBeUndefined();
    const admin = getNavGroupsForRole(Role.OPS_HEAD).find(
      (g) => g.id === "admin",
    );
    expect(admin?.items.map((i) => i.href)).toEqual([
      "/admin/users",
      "/admin/warehouses",
      "/admin/catalog",
    ]);
  });

  it("omits Governance for Finance (vendors + serial-governance not accessible)", () => {
    const groups = getNavGroupsForRole(Role.FINANCE).map((g) => g.id);
    expect(groups).not.toContain("governance");
  });

  it("includes Inbox at the top of Work for SM and Ops Head", () => {
    for (const role of [Role.SM, Role.OPS_HEAD]) {
      const work = getNavGroupsForRole(role).find((g) => g.id === "work")!;
      expect(work.items[0]?.href).toBe("/inbox");
    }
  });

  it("includes Inbox at the top of Payables for Finance", () => {
    const payables = getNavGroupsForRole(Role.FINANCE).find((g) => g.id === "payables")!;
    expect(payables.items[0]?.href).toBe("/inbox");
  });

  it("opens with Dashboard at the top of Insights", () => {
    for (const role of [Role.SM, Role.OPS_HEAD, Role.FINANCE]) {
      const groups = getNavGroupsForRole(role);
      const insights = groups.find((g) => g.id === "insights")!;
      expect(insights.items[0]?.href).toBe("/dashboard");
    }
  });
});

describe("getNavItemsForRole (flat)", () => {
  it("equals the flattened group items including PO fulfillment children", () => {
    const flat = getNavItemsForRole(Role.OPS_HEAD).map((i) => i.href);
    const grouped = getNavGroupsForRole(Role.OPS_HEAD).flatMap((g) =>
      g.items.flatMap((i) =>
        i.children ? [i.href, ...i.children.map((c) => c.href)] : [i.href],
      ),
    );
    expect(flat).toEqual(grouped);
  });
});

describe("PO-centric procurement nav", () => {
  it("includes Configure PO between PR and PO for Ops Head", () => {
    const work = getNavGroupsForRole(Role.OPS_HEAD).find((g) => g.id === "work")!;
    expect(work.items.map((i) => i.href)).toEqual([
      "/inbox",
      "/purchase-requests",
      "/purchase-orders/configure",
      "/purchase-orders",
    ]);
  });

  it("omits Configure PO for SM and Finance", () => {
    for (const role of [Role.SM, Role.FINANCE]) {
      const work = getNavGroupsForRole(role).find((g) => g.id === "work")!;
      expect(work.items.map((i) => i.href)).not.toContain("/purchase-orders/configure");
    }
  });

  it("nests GRN, invoices, and payments under Purchase Orders for Ops Head", () => {
    const work = getNavGroupsForRole(Role.OPS_HEAD).find((g) => g.id === "work")!;
    const po = work.items.find((i) => i.href === "/purchase-orders");
    expect(po?.children?.map((c) => c.href)).toEqual([
      "/goods-receipt",
      "/invoices",
      FINANCE_ROUTES.invoiceSettlement,
    ]);
  });

  it("labels the work group Procurement", () => {
    const work = getNavGroupsForRole(Role.OPS_HEAD).find((g) => g.id === "work")!;
    expect(work.label).toBe("Procurement");
  });

  it("keeps Finance PO hub without nested fulfillment children", () => {
    const work = getNavGroupsForRole(Role.FINANCE).find((g) => g.id === "work")!;
    expect(work.items.map((i) => i.href)).toEqual(["/purchase-orders"]);
    const po = work.items.find((i) => i.href === "/purchase-orders");
    expect(po?.children).toBeUndefined();
  });
});

describe("Finance payables IA", () => {
  it("exposes payables routes for Finance", () => {
    const payables = getNavGroupsForRole(Role.FINANCE).find((g) => g.id === "payables")!;
    expect(payables.label).toBe("Payables");
    expect(payables.items.map((i) => i.href)).toEqual([
      "/inbox",
      FINANCE_ROUTES.invoiceSettlement,
      FINANCE_ROUTES.vendorAdvances,
      FINANCE_ROUTES.paymentRegister,
    ]);
  });

  it("omits a standalone Invoices nav item for Finance", () => {
    const hrefs = getNavItemsForRole(Role.FINANCE).map((i) => i.href);
    expect(hrefs).not.toContain("/invoices");
    expect(hrefs).not.toContain("/payments");
  });

  it("keeps Ops Head's separate Invoices and invoice settlement under PO", () => {
    const hrefs = getNavItemsForRole(Role.OPS_HEAD).map((i) => i.href);
    expect(hrefs).toContain("/purchase-orders");
    expect(hrefs).toContain("/purchase-orders/configure");
    expect(hrefs).toContain("/invoices");
    expect(hrefs).toContain(FINANCE_ROUTES.invoiceSettlement);
  });

  it("keeps SM's Invoices entry under PO", () => {
    const hrefs = getNavItemsForRole(Role.SM).map((i) => i.href);
    expect(hrefs).toContain("/invoices");
    expect(hrefs).not.toContain(FINANCE_ROUTES.invoiceSettlement);
  });
});
