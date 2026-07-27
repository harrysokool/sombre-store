import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAuthClient: vi.fn(),
  getAdminUser: vi.fn(),
  isApprovedAdminEmail: vi.fn(),
  isFulfilmentStatus: vi.fn(),
  redirect: vi.fn(),
  requiresCourierAndTracking: vi.fn(),
  revalidatePath: vi.fn(),
  restoreOrderItemStock: vi.fn(),
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

vi.mock("@/lib/admin/stock-restoration", () => ({
  restoreOrderItemStock: mocks.restoreOrderItemStock,
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

import {
  restoreOrderItemStockAction,
  updateOrderFulfilment,
} from "./actions";

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
    mocks.restoreOrderItemStock.mockResolvedValue({
      restoration: {
        restorationId: "restoration-1",
        quantityRestored: 2,
        totalRestored: 2,
        remainingQuantity: 1,
        newStockQuantity: 12,
        alreadyApplied: false,
      },
    });
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

  it("restores an inspected partial quantity and revalidates stock views", async () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    const orderItemId = "22222222-2222-4222-8222-222222222222";
    const requestId = "33333333-3333-4333-8333-333333333333";
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("orderId", orderId);
    formData.set("orderItemId", orderItemId);
    formData.set("quantity", "2");
    formData.set("reason", " Two sealed units passed inspection. ");

    await expect(
      restoreOrderItemStockAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: null,
      success: "Restored 2 unit(s) to sellable stock.",
    });

    expect(mocks.restoreOrderItemStock).toHaveBeenCalledWith({
      requestId,
      orderId,
      orderItemId,
      quantity: "2",
      reason: "Two sealed units passed inspection.",
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([
      [`/admin/orders/${orderId}`],
      ["/admin/orders"],
      ["/admin/inventory"],
      ["/admin"],
    ]);
  });

  it("does not revalidate or report success when restoration is rejected", async () => {
    mocks.restoreOrderItemStock.mockResolvedValue({
      error: "Only 1 unit(s) remain eligible for restoration.",
    });
    const formData = new FormData();
    formData.set(
      "requestId",
      "33333333-3333-4333-8333-333333333333",
    );
    formData.set("orderId", "11111111-1111-4111-8111-111111111111");
    formData.set(
      "orderItemId",
      "22222222-2222-4222-8222-222222222222",
    );
    formData.set("quantity", "2");
    formData.set("reason", "Inspection complete.");

    await expect(
      restoreOrderItemStockAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: "Only 1 unit(s) remain eligible for restoration.",
      success: null,
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires an audit-history check when the restoration outcome is uncertain", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.restoreOrderItemStock.mockRejectedValue(
      new Error("Response was lost after the request was sent."),
    );
    const orderId = "11111111-1111-4111-8111-111111111111";
    const orderItemId = "22222222-2222-4222-8222-222222222222";
    const formData = new FormData();
    formData.set(
      "requestId",
      "33333333-3333-4333-8333-333333333333",
    );
    formData.set("orderId", orderId);
    formData.set("orderItemId", orderItemId);
    formData.set("quantity", "2");
    formData.set("reason", "Inspection complete.");

    await expect(
      restoreOrderItemStockAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error:
        "The restoration outcome could not be confirmed. Refresh this order and check the restoration audit history before trying again.",
      success: null,
    });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to confirm the stock restoration outcome",
      {
        orderId,
        orderItemId,
        errorName: "Error",
      },
    );
    consoleError.mockRestore();
  });

  it("confirms a committed restoration even when cache refresh fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.revalidatePath.mockImplementationOnce(() => {
      throw new Error("Cache unavailable.");
    });
    const formData = new FormData();
    formData.set(
      "requestId",
      "33333333-3333-4333-8333-333333333333",
    );
    formData.set("orderId", "11111111-1111-4111-8111-111111111111");
    formData.set(
      "orderItemId",
      "22222222-2222-4222-8222-222222222222",
    );
    formData.set("quantity", "2");
    formData.set("reason", "Inspection complete.");

    await expect(
      restoreOrderItemStockAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: null,
      success:
        "Restored 2 unit(s) to sellable stock. Refresh this order to update the displayed audit history.",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Stock restoration succeeded but cache refresh failed",
      {
        orderId: "11111111-1111-4111-8111-111111111111",
        orderItemId: "22222222-2222-4222-8222-222222222222",
        errorName: "Error",
      },
    );
    consoleError.mockRestore();
  });

  it("fails closed before attempting restoration without an admin session", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(
      restoreOrderItemStockAction(
        { error: null, success: null },
        new FormData(),
      ),
    ).resolves.toEqual({
      error: "Your admin session has ended. Sign in again to restore stock.",
      success: null,
    });

    expect(mocks.restoreOrderItemStock).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
