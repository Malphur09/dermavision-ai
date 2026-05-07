import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const getUserMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { logPhiAccess } from "@/lib/audit";

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockClear();
  getUserMock.mockReset();
});

describe("logPhiAccess", () => {
  it("no-ops when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await logPhiAccess({
      resource_type: "case",
      resource_id: "c-1",
      action: "viewed",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("inserts a row with user_id, resource, action, and metadata", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1" } } });
    await logPhiAccess({
      resource_type: "case",
      resource_id: "c-1",
      action: "viewed",
      metadata: { foo: "bar" },
    });
    expect(fromMock).toHaveBeenCalledWith("audit_logs");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u-1",
      resource_type: "case",
      resource_id: "c-1",
      action: "viewed",
      metadata: { foo: "bar" },
    });
  });

  it("defaults metadata to null when omitted", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-1" } } });
    await logPhiAccess({
      resource_type: "patient",
      resource_id: "p-1",
      action: "viewed",
    });
    expect(insertMock.mock.calls[0][0].metadata).toBeNull();
  });
});
