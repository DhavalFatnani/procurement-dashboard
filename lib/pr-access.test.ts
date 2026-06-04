import { PRStatus, Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  canEditDraftPurchaseRequestAsOps,
  canEditOwnDraftPurchaseRequest,
  canRevisePurchaseRequest,
  canUpdatePurchaseRequestLines,
  canViewPurchaseRequest,
  prDetailNeedsFilterOptions,
} from "./pr-access";
import type { SessionUser } from "./session";

function session(partial: Partial<SessionUser> & Pick<SessionUser, "role">): SessionUser {
  return {
    id: partial.id ?? "user-1",
    email: partial.email ?? "u@test.com",
    user_metadata: partial.user_metadata ?? {},
    app_metadata: partial.app_metadata ?? {},
    warehouseId: partial.warehouseId ?? "w1",
    warehouseIds: partial.warehouseIds ?? (partial.warehouseId ? [partial.warehouseId] : ["w1"]),
    ...partial,
  };
}

const pr = {
  status: PRStatus.REVISION_REQUIRED,
  warehouseId: "w1",
  createdById: "ops-1",
};

describe("canViewPurchaseRequest", () => {
  it("allows SM to view own PRs in warehouse scope", () => {
    const user = session({ role: Role.SM, id: "sm-1", warehouseId: "w1" });
    expect(
      canViewPurchaseRequest(user, { ...pr, createdById: "sm-1", status: PRStatus.APPROVED }),
    ).toBe(true);
  });

  it("allows SM to view REVISION_REQUIRED PRs in warehouse scope even if not creator", () => {
    const user = session({ role: Role.SM, id: "sm-1", warehouseId: "w1" });
    expect(canViewPurchaseRequest(user, pr)).toBe(true);
  });

  it("denies SM viewing another user's non-revision PR", () => {
    const user = session({ role: Role.SM, id: "sm-1", warehouseId: "w1" });
    expect(
      canViewPurchaseRequest(user, { ...pr, status: PRStatus.APPROVED }),
    ).toBe(false);
  });

  it("allows Ops Head with warehouse access", () => {
    const user = session({ role: Role.OPS_HEAD, warehouseIds: ["w1", "w2"] });
    expect(canViewPurchaseRequest(user, pr)).toBe(true);
  });

  it("denies Ops Head outside warehouse scope", () => {
    const user = session({ role: Role.OPS_HEAD, warehouseIds: ["w2"] });
    expect(canViewPurchaseRequest(user, pr)).toBe(false);
  });
});

describe("canRevisePurchaseRequest", () => {
  it("allows SM and Ops in warehouse scope on REVISION_REQUIRED", () => {
    expect(canRevisePurchaseRequest(session({ role: Role.SM }), pr)).toBe(true);
    expect(canRevisePurchaseRequest(session({ role: Role.OPS_HEAD }), pr)).toBe(true);
  });

  it("denies when status is not REVISION_REQUIRED", () => {
    expect(
      canRevisePurchaseRequest(session({ role: Role.OPS_HEAD }), {
        ...pr,
        status: PRStatus.APPROVED,
      }),
    ).toBe(false);
  });

  it("denies when user is outside warehouse scope", () => {
    const user = session({ role: Role.SM, warehouseId: "w2" });
    expect(canRevisePurchaseRequest(user, pr)).toBe(false);
  });
});

describe("canUpdatePurchaseRequestLines", () => {
  it("allows SM own draft", () => {
    const user = session({ role: Role.SM, id: "sm-1" });
    expect(
      canUpdatePurchaseRequestLines(user, {
        status: PRStatus.DRAFT,
        warehouseId: "w1",
        createdById: "sm-1",
      }),
    ).toBe(true);
  });

  it("denies SM editing another user's draft", () => {
    const user = session({ role: Role.SM, id: "sm-1" });
    expect(
      canUpdatePurchaseRequestLines(user, {
        status: PRStatus.DRAFT,
        warehouseId: "w1",
        createdById: "sm-2",
      }),
    ).toBe(false);
  });

  it("allows Ops draft edit in scope", () => {
    expect(canEditDraftPurchaseRequestAsOps(session({ role: Role.OPS_HEAD }), {
      status: PRStatus.DRAFT,
      warehouseId: "w1",
      createdById: "ops-1",
    })).toBe(true);
  });

  it("allows revision update for warehouse SM not creator", () => {
    const user = session({ role: Role.SM, id: "sm-2" });
    expect(canUpdatePurchaseRequestLines(user, pr)).toBe(true);
  });
});

describe("canEditOwnDraftPurchaseRequest", () => {
  it("requires creator for SM draft", () => {
    const user = session({ role: Role.SM, id: "sm-1" });
    expect(
      canEditOwnDraftPurchaseRequest(user, {
        status: PRStatus.DRAFT,
        warehouseId: "w1",
        createdById: "sm-2",
      }),
    ).toBe(false);
  });
});

describe("prDetailNeedsFilterOptions", () => {
  it("loads catalog options for SM and Ops on draft or revision", () => {
    expect(prDetailNeedsFilterOptions(Role.SM, PRStatus.DRAFT)).toBe(true);
    expect(prDetailNeedsFilterOptions(Role.SM, PRStatus.REVISION_REQUIRED)).toBe(true);
    expect(prDetailNeedsFilterOptions(Role.OPS_HEAD, PRStatus.REVISION_REQUIRED)).toBe(true);
    expect(prDetailNeedsFilterOptions(Role.OPS_HEAD, PRStatus.DRAFT)).toBe(true);
  });

  it("skips catalog options for approved or finance roles", () => {
    expect(prDetailNeedsFilterOptions(Role.SM, PRStatus.APPROVED)).toBe(false);
    expect(prDetailNeedsFilterOptions(Role.OPS_HEAD, PRStatus.APPROVED)).toBe(false);
    expect(prDetailNeedsFilterOptions(Role.FINANCE, PRStatus.DRAFT)).toBe(false);
  });
});

describe("prDetailNeedsFilterOptions", () => {
  it("loads catalog options for SM and Ops on draft or revision", () => {
    expect(prDetailNeedsFilterOptions(Role.SM, PRStatus.DRAFT)).toBe(true);
    expect(prDetailNeedsFilterOptions(Role.SM, PRStatus.REVISION_REQUIRED)).toBe(true);
    expect(prDetailNeedsFilterOptions(Role.OPS_HEAD, PRStatus.REVISION_REQUIRED)).toBe(true);
    expect(prDetailNeedsFilterOptions(Role.OPS_HEAD, PRStatus.DRAFT)).toBe(true);
  });

  it("skips catalog options for approved or finance roles", () => {
    expect(prDetailNeedsFilterOptions(Role.SM, PRStatus.APPROVED)).toBe(false);
    expect(prDetailNeedsFilterOptions(Role.OPS_HEAD, PRStatus.APPROVED)).toBe(false);
    expect(prDetailNeedsFilterOptions(Role.FINANCE, PRStatus.DRAFT)).toBe(false);
  });
});
