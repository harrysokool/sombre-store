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
const REQUEST_A = "44444444-4444-4444-8444-444444444444";
const REQUEST_B = "55555555-5555-4555-8555-555555555555";

type AuditRow = {
  requestId: string;
  orderItemId: string;
  quantity: number;
  reason: string;
  administratorUserId: string;
  administratorEmail: string | null;
};

type DatabaseSnapshot = {
  productStock: number;
  purchasedQuantity: number;
  restorations: AuditRow[];
};

/**
 * Transactional stand-in for restore_order_item_sellable_stock.
 *
 * Each call waits on the same order lock, works against a draft, and commits the
 * audit row and stock increment together. This verifies the application/RPC
 * contract for replay, rollback, and competing requests. It is not a substitute
 * for exercising PostgreSQL row locks against a real Supabase database.
 */
function createTransactionalFake() {
  let committed: DatabaseSnapshot = {
    productStock: 10,
    purchasedQuantity: 3,
    restorations: [],
  };
  let orderLock = Promise.resolve();
  let failAfterAudit = false;

  const client = {
    rpc: vi.fn(
      async (name: string, params: Record<string, unknown>) => {
        if (name !== "restore_order_item_sellable_stock") {
          throw new Error(`Unexpected RPC ${name}.`);
        }

        let releaseOrderLock!: () => void;
        const previousOrderLock = orderLock;
        orderLock = new Promise<void>((resolve) => {
          releaseOrderLock = resolve;
        });
        await previousOrderLock;

        try {
          const draft: DatabaseSnapshot = {
            productStock: committed.productStock,
            purchasedQuantity: committed.purchasedQuantity,
            restorations: committed.restorations.map((row) => ({ ...row })),
          };
          const requestId = String(params.p_request_id);
          const quantity = Number(params.p_quantity);
          const reason = String(params.p_reason);
          const administratorUserId = String(
            params.p_administrator_user_id,
          );
          const administratorEmail =
            (params.p_administrator_email as string | null) ?? null;
          const existing = draft.restorations.find(
            (row) => row.requestId === requestId,
          );

          if (existing) {
            const isExactReplay =
              existing.orderItemId === params.p_order_item_id &&
              existing.quantity === quantity &&
              existing.reason === reason &&
              existing.administratorUserId === administratorUserId &&
              existing.administratorEmail === administratorEmail;

            return {
              data: isExactReplay
                ? {
                    ok: true,
                    already_applied: true,
                    restoration_id: existing.requestId,
                    quantity_restored: existing.quantity,
                  }
                : { ok: false, reason: "idempotency_conflict" },
              error: null,
            };
          }

          const alreadyRestored = draft.restorations.reduce(
            (total, row) => total + row.quantity,
            0,
          );
          const remaining = draft.purchasedQuantity - alreadyRestored;

          if (quantity > remaining) {
            return {
              data: {
                ok: false,
                reason: "quantity_exceeds_purchased",
                purchased_quantity: draft.purchasedQuantity,
                already_restored: alreadyRestored,
                remaining_quantity: remaining,
              },
              error: null,
            };
          }

          draft.restorations.push({
            requestId,
            orderItemId: String(params.p_order_item_id),
            quantity,
            reason,
            administratorUserId,
            administratorEmail,
          });

          if (failAfterAudit) {
            throw new Error("forced failure after audit insert");
          }

          draft.productStock += quantity;
          committed = draft;

          return {
            data: {
              ok: true,
              already_applied: false,
              restoration_id: requestId,
              quantity_restored: quantity,
              total_restored: alreadyRestored + quantity,
              remaining_quantity: remaining - quantity,
              new_stock_quantity: draft.productStock,
            },
            error: null,
          };
        } catch (error) {
          return {
            data: null,
            error: { message: (error as Error).message, code: "XX000" },
          };
        } finally {
          releaseOrderLock();
        }
      },
    ),
  };

  mocks.createSupabase.mockReturnValue(client);

  return {
    failAfterAudit(value: boolean) {
      failAfterAudit = value;
    },
    snapshot(): DatabaseSnapshot {
      return {
        productStock: committed.productStock,
        purchasedQuantity: committed.purchasedQuantity,
        restorations: committed.restorations.map((row) => ({ ...row })),
      };
    },
  };
}

function request(requestId: string, quantity: number) {
  return {
    requestId,
    orderId: ORDER_ID,
    orderItemId: ORDER_ITEM_ID,
    quantity,
    reason: "Sealed units passed inspection.",
  };
}

describe("atomic stock restoration contract", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: ADMIN_ID,
      email: "admin@example.com",
    });
  });

  it("restores only two of three purchased units", async () => {
    const database = createTransactionalFake();

    await expect(
      restoreOrderItemStock(request(REQUEST_A, 2)),
    ).resolves.toMatchObject({
      restoration: {
        quantityRestored: 2,
        totalRestored: 2,
        remainingQuantity: 1,
      },
    });
    expect(database.snapshot()).toMatchObject({
      productStock: 12,
      restorations: [{ requestId: REQUEST_A, quantity: 2 }],
    });
  });

  it("rejects more than the remaining purchased quantity without changing stock", async () => {
    const database = createTransactionalFake();
    await restoreOrderItemStock(request(REQUEST_A, 2));
    const beforeRejection = database.snapshot();

    await expect(
      restoreOrderItemStock(request(REQUEST_B, 2)),
    ).resolves.toEqual({
      error: "Only 1 unit(s) remain eligible for restoration.",
    });
    expect(database.snapshot()).toEqual(beforeRejection);
  });

  it("replays the same request without increasing stock twice", async () => {
    const database = createTransactionalFake();

    await restoreOrderItemStock(request(REQUEST_A, 2));
    await expect(
      restoreOrderItemStock(request(REQUEST_A, 2)),
    ).resolves.toMatchObject({
      restoration: {
        quantityRestored: 2,
        alreadyApplied: true,
      },
    });
    expect(database.snapshot()).toMatchObject({
      productStock: 12,
      restorations: [{ requestId: REQUEST_A, quantity: 2 }],
    });
  });

  it("serializes concurrent requests so they cannot over-restore", async () => {
    const database = createTransactionalFake();
    const results = await Promise.all([
      restoreOrderItemStock(request(REQUEST_A, 2)),
      restoreOrderItemStock(request(REQUEST_B, 2)),
    ]);

    expect(results.filter((result) => result.restoration)).toHaveLength(1);
    expect(results.filter((result) => result.error)).toEqual([
      { error: "Only 1 unit(s) remain eligible for restoration." },
    ]);
    expect(database.snapshot()).toMatchObject({
      productStock: 12,
      restorations: [expect.objectContaining({ quantity: 2 })],
    });
  });

  it("rolls back the audit record and stock when a transaction fails", async () => {
    const database = createTransactionalFake();
    database.failAfterAudit(true);

    await expect(
      restoreOrderItemStock(request(REQUEST_A, 2)),
    ).rejects.toMatchObject({
      message: "forced failure after audit insert",
    });
    expect(database.snapshot()).toEqual({
      productStock: 10,
      purchasedQuantity: 3,
      restorations: [],
    });
  });
});
