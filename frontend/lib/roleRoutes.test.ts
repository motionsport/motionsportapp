import { describe, expect, it } from "vitest";
import { parseRole, redirectFor } from "@/lib/roleRoutes";

describe("redirectFor (proxy.ts: each role to its own pages)", () => {
  it("signed out: a section's page → that section's login; sign-in pages and the landing stay", () => {
    expect(redirectFor("/admin", null)).toBe("/admin/login");
    expect(redirectFor("/admin/clients/abc", null)).toBe("/admin/login");
    expect(redirectFor("/owner/trainers", null)).toBe("/admin/login");
    expect(redirectFor("/purchases", null)).toBe("/login");
    expect(redirectFor("/prices", null)).toBe("/login");
    expect(redirectFor("/admin/login", null)).toBeNull();
    expect(redirectFor("/admin/join", null)).toBeNull();
    expect(redirectFor("/", null)).toBeNull();
    expect(redirectFor("/login", null)).toBeNull();
  });

  it("another role's page → the person's own home", () => {
    expect(redirectFor("/admin", "owner")).toBe("/owner");
    expect(redirectFor("/admin/password", "owner")).toBe("/owner");
    expect(redirectFor("/owner", "admin")).toBe("/admin");
    expect(redirectFor("/owner/prices", "member")).toBe("/");
    expect(redirectFor("/purchases", "admin")).toBe("/admin");
    expect(redirectFor("/prices", "owner")).toBe("/owner");
  });

  it("own pages stay; `/` sends only the team home", () => {
    expect(redirectFor("/admin/calendar", "admin")).toBeNull();
    expect(redirectFor("/owner/trainers", "owner")).toBeNull();
    expect(redirectFor("/purchases", "member")).toBeNull();
    expect(redirectFor("/", "member")).toBeNull();
    expect(redirectFor("/", "admin")).toBe("/admin");
    expect(redirectFor("/", "owner")).toBe("/owner");
  });

  it("a prefix is a whole segment; pages outside the sections and the LiqPay return are left alone", () => {
    expect(redirectFor("/administrator", null)).toBeNull();
    expect(redirectFor("/payment/return", null)).toBeNull();
    expect(redirectFor("/register", "member")).toBeNull();
  });
});

describe("parseRole", () => {
  it("only a known role", () => {
    expect(parseRole("owner")).toBe("owner");
    expect(parseRole("root")).toBeNull();
    expect(parseRole("toString")).toBeNull();
    expect(parseRole(undefined)).toBeNull();
  });
});
