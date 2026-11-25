import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, statusOf } from "./api";
import { toAdminLogin } from "./adminAuth";

function answer(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("a failed call", () => {
  it("throws ApiError with the backend's message, the status and the body", async () => {
    answer(409, { message: "Price changed", amountUah: 900, updatedBy: "demo" });
    const err = await api.updateOwnerPrice("p1", 1000, 800).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect((err as ApiError).message).toBe("Price changed");
    expect(statusOf(err)).toBe(409);
    expect((err as ApiError).body).toEqual({ message: "Price changed", amountUah: 900, updatedBy: "demo" });
  });

  it("has the status text when the body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("oops", { status: 500, statusText: "Server Error" })),
    );
    const err = await api.getStats().catch((e: unknown) => e);
    expect((err as ApiError).message).toBe("Server Error");
    expect(statusOf(err)).toBe(500);
  });

  it("no status without an answer (no connection)", () => {
    expect(statusOf(new TypeError("Failed to fetch"))).toBeUndefined();
    expect(statusOf(null)).toBeUndefined();
  });
});

describe("toAdminLogin", () => {
  // A full page load (reloadTo): the node test environment has no window, so it gets a stub
  const assign = vi.fn();
  beforeEach(() => {
    assign.mockClear();
    vi.stubGlobal("window", { location: { assign } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends 401 (signed out) to the team login", () => {
    expect(toAdminLogin(new ApiError("x", 401, {}))).toBe(true);
    expect(assign).toHaveBeenCalledWith("/admin/login");
  });

  it.each([400, 403, 404, 409, 500])("leaves %i to the page", (status) => {
    expect(toAdminLogin(new ApiError("x", status, {}))).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("leaves a network failure to the page", () => {
    expect(toAdminLogin(new TypeError("Failed to fetch"))).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
