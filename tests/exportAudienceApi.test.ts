// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verifyIdToken: vi.fn(), userGet: vi.fn() }));
vi.mock("../api/_lib/firebaseAdmin.js", () => ({
  getFirebaseAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
  getAdminDb: () => ({
    collection: () => ({ doc: () => ({ get: mocks.userGet }) }),
  }),
}));
import handler, { requireExportAdmin } from "../api/export-research/[action].ts";

const req = (action: string, method = "GET", extra = {}) =>
  ({
    query: { action },
    method,
    headers: {},
    socket: { remoteAddress: "api-test" },
    ...extra,
  }) as any;
const res = () => {
  const response = {
    code: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.code = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as any;
};
describe("Export research API access boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyIdToken.mockResolvedValue({ uid: "admin-test" });
  });
  it("never exposes contacts without authentication", async () => {
    const response = res();
    await handler(req("leads"), response);
    expect(response.code).toBe(401);
    expect(mocks.userGet).not.toHaveBeenCalled();
    expect(response.headers["Cache-Control"]).toBe("private, no-store");
  });
  it.each([
    { role: "client", status: "active", tenantId: "intiba" },
    { role: "editor", status: "active", tenantId: "intiba" },
    { role: "account_manager", status: "active", tenantId: "intiba" },
    { role: "admin", status: "suspended", tenantId: "intiba" },
    { role: "admin", status: "active", tenantId: "someone-else" },
    undefined,
  ])(
    "denies unauthorized roles, tenants and suspended accounts",
    async (user) => {
      mocks.userGet.mockResolvedValue({ data: () => user });
      await expect(
        requireExportAdmin(
          req("leads", "GET", { headers: { authorization: "Bearer test" } }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it("allows an active admin from the owner tenant and checks revocation", async () => {
    mocks.userGet.mockResolvedValue({
      data: () => ({ role: "admin", status: "active", tenantId: "intiba" }),
    });
    await expect(
      requireExportAdmin(
        req("leads", "GET", {
          headers: { authorization: "Bearer valid-token" },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(mocks.verifyIdToken).toHaveBeenCalledWith("valid-token", true);
  });
  it("rejects a revoked token before reading users", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("revoked"));
    await expect(
      requireExportAdmin(
        req("leads", "GET", { headers: { authorization: "Bearer revoked" } }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.userGet).not.toHaveBeenCalled();
  });
  it("does not allow GET to submit a form", async () => {
    const response = res();
    await handler(req("request"), response);
    expect(response.code).toBe(405);
  });
  it("rejects foreign-origin writes", async () => {
    const response = res();
    await handler(
      req("request", "POST", {
        headers: {
          origin: "https://attacker.example",
          "content-type": "application/json",
        },
      }),
      response,
    );
    expect(response.code).toBe(403);
  });
  it("validates malformed requests without initializing the database", async () => {
    const response = res();
    await handler(
      req("request", "POST", {
        headers: { "content-type": "application/json" },
        body: { email: "broken" },
      }),
      response,
    );
    expect(response.code).toBe(400);
  });
  it("has no endpoint that sends a marketing campaign", async () => {
    const response = res();
    await handler(req("send-campaign", "POST"), response);
    expect(response.code).toBe(404);
  });
});
