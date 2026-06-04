import { PRStatus } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  PRStatusTransitionError,
  assertPRStatusTransition,
  canTransitionPRStatus,
  evaluatePRStatus,
} from "./prStatus";

const ALL = Object.values(PRStatus);

// The transition graph the implementation currently encodes.
const ALLOWED: Record<string, PRStatus[]> = {
  [PRStatus.DRAFT]: [
    PRStatus.PENDING_APPROVAL,
    PRStatus.CANCELLED,
    PRStatus.EXECUTED_PRINT,
  ],
  [PRStatus.PENDING_APPROVAL]: [
    PRStatus.APPROVED,
    PRStatus.REJECTED,
    PRStatus.REVISION_REQUIRED,
    PRStatus.CANCELLED,
  ],
  [PRStatus.REVISION_REQUIRED]: [
    PRStatus.PENDING_APPROVAL,
    PRStatus.FORCE_CANCELLED,
  ],
  [PRStatus.APPROVED]: [PRStatus.CONVERTED_TO_PO, PRStatus.PENDING_APPROVAL],
};

describe("canTransitionPRStatus", () => {
  it("always allows self-transitions", () => {
    for (const status of ALL) {
      expect(canTransitionPRStatus(status, status)).toBe(true);
    }
  });

  it("allows exactly the declared transitions and rejects all others", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        if (from === to) continue;
        const expected = (ALLOWED[from] ?? []).includes(to);
        expect(canTransitionPRStatus(from, to)).toBe(expected);
      }
    }
  });

  it("rejects transitions out of a terminal status", () => {
    expect(canTransitionPRStatus(PRStatus.CONVERTED_TO_PO, PRStatus.DRAFT)).toBe(
      false,
    );
    expect(canTransitionPRStatus(PRStatus.REJECTED, PRStatus.APPROVED)).toBe(
      false,
    );
  });
});

describe("assertPRStatusTransition", () => {
  it("does not throw for a valid transition", () => {
    expect(() =>
      assertPRStatusTransition(PRStatus.DRAFT, PRStatus.PENDING_APPROVAL),
    ).not.toThrow();
  });

  it("throws PRStatusTransitionError for an invalid transition", () => {
    expect(() =>
      assertPRStatusTransition(PRStatus.DRAFT, PRStatus.APPROVED),
    ).toThrow(PRStatusTransitionError);
  });
});

describe("evaluatePRStatus", () => {
  it("returns the next status when valid", () => {
    expect(
      evaluatePRStatus({ status: PRStatus.APPROVED }, PRStatus.CONVERTED_TO_PO),
    ).toBe(PRStatus.CONVERTED_TO_PO);
    expect(
      evaluatePRStatus({ status: PRStatus.APPROVED }, PRStatus.PENDING_APPROVAL),
    ).toBe(PRStatus.PENDING_APPROVAL);
    expect(evaluatePRStatus({ status: PRStatus.DRAFT }, PRStatus.CANCELLED)).toBe(
      PRStatus.CANCELLED,
    );
  });

  it("throws on an invalid transition", () => {
    expect(() =>
      evaluatePRStatus({ status: PRStatus.APPROVED }, PRStatus.DRAFT),
    ).toThrow(PRStatusTransitionError);
  });
});
