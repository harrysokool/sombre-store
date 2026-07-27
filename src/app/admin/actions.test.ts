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
  retryUnsentOrderEmail: vi.fn(),
  sendShippingConfirmationEmail: vi.fn(),
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

vi.mock("@/lib/admin/operations", () => ({
  retryUnsentOrderEmail: mocks.retryUnsentOrderEmail,
}));

vi.mock("@/lib/email/order-emails", () => ({
  sendShippingConfirmationEmail: mocks.sendShippingConfirmationEmail,
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
  retryOrderEmailAction,
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
    mocks.retryUnsentOrderEmail.mockResolvedValue({
      status: "sent",
      orderId: "11111111-1111-4111-8111-111111111111",
    });
    mocks.sendShippingConfirmationEmail.mockResolvedValue(undefined);
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
    expect(mocks.sendShippingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("sends a shipping confirmation email after marking an order shipped", async () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    mocks.requiresCourierAndTracking.mockReturnValue(true);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", "shipped");
    formData.set("courier", "SF Express");
    formData.set("trackingNumber", "SF1234567890");

    await expect(
      updateOrderFulfilment({ error: null, success: null }, formData),
    ).resolves.toEqual({
      error: null,
      success: "Order marked shipped.",
    });

    expect(mocks.sendShippingConfirmationEmail).toHaveBeenCalledWith(
      orderId,
    );
    expect(mocks.sendShippingConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send a shipping confirmation email after marking an order delivered", async () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    mocks.requiresCourierAndTracking.mockReturnValue(true);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", "delivered");
    formData.set("courier", "SF Express");
    formData.set("trackingNumber", "SF1234567890");

    await expect(
      updateOrderFulfilment({ error: null, success: null }, formData),
    ).resolves.toEqual({
      error: null,
      success: "Order marked delivered.",
    });

    expect(mocks.sendShippingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("blocks marking an order shipped when the courier is empty", async () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    mocks.requiresCourierAndTracking.mockReturnValue(true);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", "shipped");
    formData.set("courier", "");
    formData.set("trackingNumber", "SF1234567890");

    await expect(
      updateOrderFulfilment({ error: null, success: null }, formData),
    ).resolves.toEqual({
      error: "Enter a courier before marking this order shipped.",
      success: null,
    });

    expect(mocks.setOrderFulfilment).not.toHaveBeenCalled();
    expect(mocks.sendShippingConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("blocks marking an order shipped when the tracking number is empty", async () => {
    const orderId = "11111111-1111-4111-8111-111111111111";
    mocks.requiresCourierAndTracking.mockReturnValue(true);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", "shipped");
    formData.set("courier", "SF Express");
    formData.set("trackingNumber", "");

    await expect(
      updateOrderFulfilment({ error: null, success: null }, formData),
    ).resolves.toEqual({
      error: "Enter a tracking number before marking this order shipped.",
      success: null,
    });

    expect(mocks.setOrderFulfilment).not.toHaveBeenCalled();
    expect(mocks.sendShippingConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the fulfilment update successful when the shipping email rejects unexpectedly", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const orderId = "11111111-1111-4111-8111-111111111111";
    mocks.requiresCourierAndTracking.mockReturnValue(true);
    mocks.sendShippingConfirmationEmail.mockRejectedValue(
      new Error("Unexpected rejection"),
    );
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("status", "shipped");
    formData.set("courier", "SF Express");
    formData.set("trackingNumber", "SF1234567890");

    await expect(
      updateOrderFulfilment({ error: null, success: null }, formData),
    ).resolves.toEqual({
      error: null,
      success: "Order marked shipped.",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Unexpected shipping confirmation email processing rejection",
      {
        orderId,
        errorName: "Error",
      },
    );
    consoleError.mockRestore();
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

  it("fails closed before retrying email without an admin session", async () => {
    mocks.getAdminUser.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    await expect(
      retryOrderEmailAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: "Your admin session has ended. Sign in again to retry email.",
      success: null,
    });

    expect(mocks.retryUnsentOrderEmail).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("retries a failed email and refreshes both operations summaries", async () => {
    const emailId = "22222222-2222-4222-8222-222222222222";
    const formData = new FormData();
    formData.set("emailId", emailId);

    await expect(
      retryOrderEmailAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: null,
      success: "Email sent successfully.",
    });

    expect(mocks.retryUnsentOrderEmail).toHaveBeenCalledWith(emailId);
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/admin/operations"],
      ["/admin"],
    ]);
  });

  it("reports an already-sent email without claiming it was sent again", async () => {
    mocks.retryUnsentOrderEmail.mockResolvedValue({
      status: "already_sent",
      orderId: "11111111-1111-4111-8111-111111111111",
    });
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    await expect(
      retryOrderEmailAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error: null,
      success: "This email was already sent and was not sent again.",
    });
  });

  it("keeps provider failures safe while allowing a later retry", async () => {
    mocks.retryUnsentOrderEmail.mockResolvedValue({
      status: "failed",
      orderId: "11111111-1111-4111-8111-111111111111",
    });
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    const result = await retryOrderEmailAction(
      { error: null, success: null },
      formData,
    );

    expect(result).toEqual({
      error:
        "Email delivery failed again. The attempt was recorded; refresh Operations to see whether another retry is safe.",
      success: null,
    });
    expect(JSON.stringify(result)).not.toContain("Resend");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/operations",
    );
  });

  it("does not send an email that no longer matches the order status", async () => {
    mocks.retryUnsentOrderEmail.mockResolvedValue({
      status: "not_applicable",
      orderId: "11111111-1111-4111-8111-111111111111",
    });
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    await expect(
      retryOrderEmailAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error:
        "This email no longer matches the order's current status and was not sent.",
      success: null,
    });
  });

  it("requires provider verification when delivery outcome is uncertain", async () => {
    mocks.retryUnsentOrderEmail.mockResolvedValue({
      status: "outcome_unknown",
      orderId: "11111111-1111-4111-8111-111111111111",
    });
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    await expect(
      retryOrderEmailAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error:
        "The provider outcome could not be confirmed. Refresh Operations and check the email provider before retrying.",
      success: null,
    });
  });

  it("requires provider verification for a quarantined historical failure", async () => {
    mocks.retryUnsentOrderEmail.mockResolvedValue({
      status: "requires_review",
      orderId: "11111111-1111-4111-8111-111111111111",
    });
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    await expect(
      retryOrderEmailAction(
        { error: null, success: null },
        formData,
      ),
    ).resolves.toEqual({
      error:
        "This delivery must be verified with the email provider before it can be retried.",
      success: null,
    });
  });

  it("does not expose an unexpected provider or database error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.retryUnsentOrderEmail.mockRejectedValue(
      new Error("Bearer re_super_secret_provider_key"),
    );
    const formData = new FormData();
    formData.set("emailId", "22222222-2222-4222-8222-222222222222");

    const result = await retryOrderEmailAction(
      { error: null, success: null },
      formData,
    );

    expect(result).toEqual({
      error:
        "The retry outcome could not be confirmed. Refresh Operations before trying again.",
      success: null,
    });
    expect(JSON.stringify(result)).not.toContain("re_super_secret");
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to confirm the transactional email retry outcome",
      {
        emailId: "22222222-2222-4222-8222-222222222222",
        errorName: "Error",
      },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
