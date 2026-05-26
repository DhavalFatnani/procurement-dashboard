import { describe, expect, it } from "vitest";

import { vendorCreateSchema, vendorUpdateSchema } from "./vendor";

const baseCreate = {
  businessName: "  Acme Corp  ",
  pocName: "  Jane  ",
  phone: "  99999  ",
  email: "  Jane@ACME.com ",
  address: "  1 Road  ",
  accountName: "  Acme  ",
  accountNumber: "  123  ",
  ifsc: "  hdfc0001  ",
  bankName: "  HDFC  ",
  gst: "  22aaaaa0000a1z5  ",
};

describe("vendorCreateSchema", () => {
  it("trims all text fields", () => {
    const out = vendorCreateSchema.parse(baseCreate);
    expect(out.businessName).toBe("Acme Corp");
    expect(out.pocName).toBe("Jane");
    expect(out.accountName).toBe("Acme");
    expect(out.bankName).toBe("HDFC");
    expect(out.address).toBe("1 Road");
  });

  it("lowercases email and uppercases ifsc and gst", () => {
    const out = vendorCreateSchema.parse(baseCreate);
    expect(out.email).toBe("jane@acme.com");
    expect(out.ifsc).toBe("HDFC0001");
    expect(out.gst).toBe("22AAAAA0000A1Z5");
  });

  it("normalizes blank or absent gst to an empty string", () => {
    expect(vendorCreateSchema.parse({ ...baseCreate, gst: "   " }).gst).toBe("");
    const { gst, ...withoutGst } = baseCreate;
    void gst;
    expect(vendorCreateSchema.parse(withoutGst).gst).toBe("");
  });

  it("passes similarVendorAckReason through untouched", () => {
    expect(
      vendorCreateSchema.parse({ ...baseCreate, similarVendorAckReason: " keep " })
        .similarVendorAckReason,
    ).toBe(" keep ");
  });
});

describe("vendorUpdateSchema", () => {
  it("normalizes the updatable fields and trims the reason", () => {
    const out = vendorUpdateSchema.parse({
      pocName: " John ",
      phone: " 12345 ",
      email: " A@B.COM ",
      address: " addr ",
      accountName: " acct ",
      accountNumber: " 1 ",
      ifsc: " icic0002 ",
      bankName: " ICICI ",
      reason: "  fixed phone  ",
    });
    expect(out.email).toBe("a@b.com");
    expect(out.ifsc).toBe("ICIC0002");
    expect(out.reason).toBe("fixed phone");
  });
});
