import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAuthClient: vi.fn(),
  getAdminUser: vi.fn(),
  isApprovedAdminEmail: vi.fn(),
  isFulfilmentStatus: vi.fn(),
  redirect: vi.fn(),
  requiresCourierAndTracking: vi.fn(),
  revalidatePath: vi.fn(),
  setOrderFulfilment: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/admin/fulfilment", () => ({
  setOrderFulfilment: mocks.setOrderFulfilment,
}));

vi.mock("@/lib/admin/fulfilment-rules", () => ({
  isFulfilmentStatus: mocks.isFulfilmentStatus,
  requiresCourierAndTracking: mocks.requiresCourierAndTracking,
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  createSupabaseAuthClient: mocks.createSupabaseAuthClient,
  getAdminUser: mocks.getAdminUser,
  isApprovedAdminEmail: mocks.isApprovedAdminEmail,
}));

import { updateOrderFulfilment } from "./actions";

describe("admin order actions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.isFulfilmentStatus.mockReturnValue(true);
    mocks.requiresCourierAndTracking.mockReturnValue(false);
    mocks.setOrderFulfilment.mockResolvedValue({ error: null });
  });

  it("revalidates the detail, Orders list, and Home after fulfilment changes", async () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", "processing");

    await expect(
      updateOrderFulfilment(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: null,
      success: "Order marked processing.",
    });

    expect(mocks.revalidatePath.mock.calls).toEqual([
      [`/admin/orders/${orderId}`],
      ["/admin/orders"],
      ["/admin"],
    ]);
  });
});
