import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetSignIn, rememberSignIn, rememberedRole, rememberedSignIn, teamHomeOnStart } from "@/lib/authFlag";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("the remembered sign-in (mg_authed + mg_role)", () => {
  it("a sign-in remembers the role, a sign-out forgets both", () => {
    rememberSignIn("owner");
    expect(rememberedSignIn()).toBe(true);
    expect(rememberedRole()).toBe("owner");
    forgetSignIn();
    expect(rememberedSignIn()).toBe(false);
    expect(rememberedRole()).toBeNull();
  });

  it("junk in storage is no role (signed in before roles were remembered)", () => {
    localStorage.setItem("mg_role", "root");
    expect(rememberedRole()).toBeNull();
  });

  it("no storage at all (private mode): no role, nothing thrown", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(rememberedRole()).toBeNull();
    expect(rememberedSignIn()).toBe(true); // can't tell: ask the API rather than show the landing
  });
});

describe("teamHomeOnStart (the schedule page: a trainer or the owner goes home without asking the API)", () => {
  it("trainer and owner go home, a member or an unknown role stays", () => {
    expect(teamHomeOnStart("admin")).toBe("/admin");
    expect(teamHomeOnStart("owner")).toBe("/owner");
    expect(teamHomeOnStart("member")).toBeNull();
    expect(teamHomeOnStart(null)).toBeNull();
  });
});
