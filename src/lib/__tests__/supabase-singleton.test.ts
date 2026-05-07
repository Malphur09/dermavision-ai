import { describe, it, expect, vi } from "vitest";

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(() => ({ id: Math.random() })),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createClient } from "@/lib/supabase/client";

describe("supabase browser client singleton", () => {
  it("returns the same instance across calls", () => {
    const a = createClient();
    const b = createClient();
    expect(a).toBe(b);
    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
  });
});
