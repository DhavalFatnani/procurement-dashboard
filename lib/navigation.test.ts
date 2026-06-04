import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  defaultLandingFor,
  getNavGroupsForRole,
  getNavItemsForRole,
} from "@/lib/navigation";

describe("defaultLandingFor", () => {
  it("sends every role to /dashboard", () => {
    expect(defaultLandingFor(Role.SM)).toBe("/dashboard");
    expect(defaultLandingFor(Role.OPS_HEAD)).toBe("/dashboard");
    expect(defaultLandingFor(Role.FINANCE)).toBe("/dashboard");
  });
});

describe("getNavGroupsForRole", () => {
  it("returns Insights + Work + Governance for SM, and adds Admin for Ops Head", () => {
    const sm = getNavGroupsForRole(Role.SM).map((g) => g.id);
    expect(sm).toEqual(["insights", "work", "governance"]);
    const ops = getNavGroupsForRole(Role.OPS_HEAD).map((g) => g.id);
    expect(ops).toEqual(["insights", "work", "governance", "admin"]);
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
    expect(groups).toEqual(["insights", "work"]);
  });

  it("includes Inbox at the top of Work for every role", () => {
    for (const role of [Role.SM, Role.OPS_HEAD, Role.FINANCE]) {
      const work = getNavGroupsForRole(role).find((g) => g.id === "work")!;
      expect(work.items[0]?.href).toBe("/inbox");
    }
  });

  it("opens with Dashboard at the top of Insights", () => {
    for (const role of [Role.SM, Role.OPS_HEAD, Role.FINANCE]) {
      const groups = getNavGroupsForRole(role);
      expect(groups[0]?.id).toBe("insights");
      expect(groups[0]?.items[0]?.href).toBe("/dashboard");
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
      "/payments",
    ]);
  });

  it("labels the work group Procurement", () => {
    const work = getNavGroupsForRole(Role.OPS_HEAD).find((g) => g.id === "work")!;
    expect(work.label).toBe("Procurement");
  });

  it("keeps Finance fulfillment under PO as invoices & payments only", () => {
    const work = getNavGroupsForRole(Role.FINANCE).find((g) => g.id === "work")!;
    expect(work.items.map((i) => i.href)).toEqual(["/inbox", "/purchase-orders"]);
    const po = work.items.find((i) => i.href === "/purchase-orders");
    expect(po?.children?.map((c) => c.href)).toEqual(["/payments"]);
    expect(po?.children?.[0]?.label).toBe("Invoices & payments");
  });
});

describe("Finance merged Invoices & payments entry", () => {
  it("omits a standalone Invoices nav item for Finance", () => {
    const hrefs = getNavItemsForRole(Role.FINANCE).map((i) => i.href);
    expect(hrefs).not.toContain("/invoices");
  });

  it("exposes a single /payments entry labelled 'Invoices & payments' under PO", () => {
    const work = getNavGroupsForRole(Role.FINANCE).find((g) => g.id === "work")!;
    const po = work.items.find((i) => i.href === "/purchase-orders");
    const item = po?.children?.find((i) => i.href === "/payments");
    expect(item).toBeDefined();
    expect(item?.label).toBe("Invoices & payments");
  });

  it("keeps Ops Head's separate Invoices and Payments entries under PO", () => {
    const hrefs = getNavItemsForRole(Role.OPS_HEAD).map((i) => i.href);
    expect(hrefs).toContain("/purchase-orders");
    expect(hrefs).toContain("/purchase-orders/configure");
    expect(hrefs).toContain("/invoices");
    expect(hrefs).toContain("/payments");
  });

  it("keeps SM's Invoices entry under PO", () => {
    const hrefs = getNavItemsForRole(Role.SM).map((i) => i.href);
    expect(hrefs).toContain("/invoices");
    expect(hrefs).not.toContain("/payments");
  });
});
