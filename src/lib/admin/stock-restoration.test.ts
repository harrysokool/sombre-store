import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import { restoreOrderItemStock } from "./stock-restoration";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const ORDER_ITEM_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const RESTORATION_ID = "55555555-5555-4555-8555-555555555555";

function input(
  overrides: Partial<Parameters<typeof restoreOrderItemStock>[0]> = {},
) {
  return {
    requestId: REQUEST_ID,
    orderId: ORDER_ID,
    orderItemId: ORDER_ITEM_ID,
    quantity: 2,
    reason: "Two sealed units passed inspection.",
    ...overrides,
  };
}

function supabaseWithRpc(data: unknown, error: unknown = null) {
  const client = {
    rpc: vi.fn(async () => ({ data, error })),
  };

  mocks.createSupabase.mockReturnValue(client);
  return client;
}

describe("administrator stock restoration", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: ADMIN_ID,
      email: "ADMIN@EXAMPLE.COM",
    });
  });

  it("fails closed before creating a service-role client", async () => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(restoreOrderItemStock(input())).rejects.toThrow(
      "without an approved session",
    );
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("restores an eligible partial quantity with the administrator identity and reason", async () => {
    const client = supabaseWithRpc({
      ok: true,
      already_applied: false,
      restoration_id: RESTORATION_ID,
      quantity_restored: 2,
      total_restored: 2,
      remaining_quantity: 1,
      new_stock_quantity: 12,
    });

    await expect(restoreOrderItemStock(input())).resolves.toEqual({
      restoration: {
        restorationId: RESTORATION_ID,
        quantityRestored: 2,
        totalRestored: 2,
        remainingQuantity: 1,
        newStockQuantity: 12,
        alreadyApplied: false,
      },
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "restore_order_item_sellable_stock",
      {
        p_request_id: REQUEST_ID,
        p_order_id: ORDER_ID,
        p_order_item_id: ORDER_ITEM_ID,
        p_quantity: 2,
        p_reason: "Two sealed units passed inspection.",
        p_administrator_user_id: ADMIN_ID,
        p_administrator_email: "admin@example.com",
      },
    );
  });

  it("rejects a missing reason before any stock RPC can run", async () => {
    const client = supabaseWithRpc(null);

    await expect(
      restoreOrderItemStock(input({ reason: "   " })),
    ).resolves.toEqual({
      error: "Enter a reason between 1 and 1000 characters.",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a non-positive or fractional quantity before the RPC", async () => {
    const client = supabaseWithRpc(null);

    for (const quantity of [0, -1, 1.5, "two"]) {
      await expect(
        restoreOrderItemStock(input({ quantity })),
      ).resolves.toEqual({
        error: "Enter a whole-number quantity greater than zero.",
      });
    }

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("reports the database remaining quantity when a request exceeds the purchase", async () => {
    supabaseWithRpc({
      ok: false,
      reason: "quantity_exceeds_purchased",
      purchased_quantity: 3,
      already_restored: 2,
      remaining_quantity: 1,
    });

    await expect(restoreOrderItemStock(input())).resolves.toEqual({
      error: "Only 1 unit(s) remain eligible for restoration.",
    });
  });

  it("treats an exact request replay as success without implying another increment", async () => {
    supabaseWithRpc({
      ok: true,
      already_applied: true,
      restoration_id: RESTORATION_ID,
      quantity_restored: 2,
    });

    await expect(restoreOrderItemStock(input())).resolves.toEqual({
      restoration: {
        restorationId: RESTORATION_ID,
        quantityRestored: 2,
        totalRestored: null,
        remainingQuantity: null,
        newStockQuantity: null,
        alreadyApplied: true,
      },
    });
  });

  it("surfaces an idempotency conflict without reporting a restoration", async () => {
    supabaseWithRpc({
      ok: false,
      reason: "idempotency_conflict",
    });

    await expect(restoreOrderItemStock(input())).resolves.toEqual({
      error:
        "That restoration request was already used with different details. Refresh the page and try again.",
    });
  });
});
