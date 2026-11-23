import { describe, expect, it } from "vitest";
import { elsewhereFor, homeFor } from "@/lib/loginRedirect";

describe("homeFor (the team login sends each role home)", () => {
  it("a trainer to their panel, the owner to the gym stats, a member to the schedule", () => {
    expect(homeFor("admin")).toBe("/admin");
    expect(homeFor("owner")).toBe("/owner");
    expect(homeFor("member")).toBe("/");
  });
});

describe("elsewhereFor (a team page opened by another role)", () => {
  it("the page's own role stays; anyone else goes home", () => {
    expect(elsewhereFor("owner", "owner")).toBeNull();
    expect(elsewhereFor("admin", "owner")).toBe("/admin");
    expect(elsewhereFor("member", "admin")).toBe("/");
  });
});
