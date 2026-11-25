import { describe, expect, it } from "vitest";
import { homeFor } from "@/lib/loginRedirect";

describe("homeFor (the team login sends each role home)", () => {
  it("a trainer to their panel, the owner to the gym stats, a member to the schedule", () => {
    expect(homeFor("admin")).toBe("/admin");
    expect(homeFor("owner")).toBe("/owner");
    expect(homeFor("member")).toBe("/");
  });
});
