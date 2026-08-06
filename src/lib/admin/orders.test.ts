import { beforeEach, describe, expect, it, vi } from "vitest";

// vitest runs this file in a genuine server-side Node context, but its module
// resolution doesn't set Next.js's "react-server" bundler condition, so the
// real "server-only" package would otherwise throw on every import here.
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient:
    mocks.createSupabaseServiceRoleClient,
}));

import { getAdminOrder } from "./orders";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("getAdminOrder refund state", () => {
  beforeEach(() => {
    mocks.createSupabaseServiceRoleClient.mockReset();
    mocks.getAdminUser.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.com",
    });
  });

  it("reads the current refund fields from the order row", async () => {
    let selectedOrderColumns = "";
    const order = {
      id: ORDER_ID,
      created_at: "2026-07-27T02:52:00.000Z",
      customer_name: "Sombre Customer",
      customer_email: "customer@example.com",
      total: "1238.00",
      currency: "hkd",
      payment_status: "paid",
      order_status: "refunded",
      fulfilment_status: "unfulfilled",
      customer_phone: null,
      address_line_1: "1 Fragrance Road",
      address_line_2: null,
      district: "Central",
      city: "Hong Kong",
      postal_code: null,
      country: "Hong Kong",
      coupon_code: null,
      original_subtotal: "1188.00",
      discount_total: "0.00",
      subtotal: "1188.00",
      shipping_fee: "50.00",
      refund_status: "succeeded",
      refund_id: "re_dashboard_full_refund",
      refunded_at: "2026-07-27T02:53:12.000Z",
      stock_reduced_at: "2026-07-27T02:52:05.000Z",
      stock_restored_at: null,
      courier: null,
      tracking_number: null,
      shipped_at: null,
      delivered_at: null,
      fulfilment_updated_at: null,
    };

    const from = vi.fn((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn((columns: string) => {
            selectedOrderColumns = columns;

            return {
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: order,
                  error: null,
                })),
              })),
            };
          }),
        };
      }

      if (table === "order_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "webhook_failures") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                like: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === "order_item_stock_restorations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                returns: vi.fn(async () => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}.`);
    });

    mocks.createSupabaseServiceRoleClient.mockReturnValue({ from });

    const result = await getAdminOrder(ORDER_ID);

    expect(selectedOrderColumns).toContain("refund_status");
    expect(selectedOrderColumns).toContain("refund_id");
    expect(selectedOrderColumns).toContain("refunded_at");
    expect(result?.order).toMatchObject({
      id: ORDER_ID,
      order_status: "refunded",
      refund_status: "succeeded",
      refund_id: "re_dashboard_full_refund",
      refunded_at: "2026-07-27T02:53:12.000Z",
    });
    expect(from).toHaveBeenCalledWith("orders");
  });
});
