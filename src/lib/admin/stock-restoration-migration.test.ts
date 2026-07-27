import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260727000000_add_manual_stock_restoration.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(migrationUrl, "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("manual stock restoration migration contract", () => {
  it("neutralizes the legacy refund RPC without changing product stock", async () => {
    const sql = await migrationSql();
    const compatibilityFunction = sql
      .split(
        "create or replace function public.restore_order_stock_after_refund(",
      )[1]
      ?.split(
        "create or replace function public.restore_order_item_sellable_stock(",
      )[0];

    expect(compatibilityFunction).toContain(
      "refund_status = 'succeeded'",
    );
    expect(compatibilityFunction).toContain("return false");
    expect(compatibilityFunction).not.toContain("update public.products");
    expect(compatibilityFunction).not.toContain("stock_quantity");
    expect(compatibilityFunction).not.toContain(
      "stock_restored_at =",
    );
  });

  it("records the required per-item audit fields and keeps the table private", async () => {
    const sql = await migrationSql();

    for (const field of [
      "request_id uuid not null",
      "order_id uuid not null",
      "order_item_id uuid not null",
      "product_id uuid not null",
      "quantity_restored integer not null",
      "reason text not null",
      "administrator_user_id uuid",
      "administrator_email text",
      "restored_at timestamptz not null",
    ]) {
      expect(sql).toContain(field);
    }

    expect(sql).toContain(
      "alter table public.order_item_stock_restorations enable row level security",
    );
    expect(sql).toContain(
      "grant select on table public.order_item_stock_restorations to service_role",
    );
    expect(sql).toContain(
      "grant execute on function public.restore_order_item_sellable_stock",
    );
  });

  it("serializes decisions and checks cumulative restored quantity before incrementing stock", async () => {
    const sql = await migrationSql();
    const manualFunction = sql.split(
      "create or replace function public.restore_order_item_sellable_stock(",
    )[1];

    expect(manualFunction).toBeDefined();
    expect(manualFunction).toContain(
      "from public.orders where id = p_order_id for update",
    );
    expect(manualFunction).toContain(
      "from public.order_items where id = p_order_item_id and order_id = p_order_id for update",
    );
    expect(manualFunction).toContain(
      "select coalesce(sum(quantity_restored), 0)::integer",
    );
    expect(manualFunction).toContain(
      "if p_quantity > v_remaining then",
    );
    expect(manualFunction).toContain(
      "from public.products where id = v_item.product_id for update",
    );
    expect(manualFunction).toContain(
      "on conflict (request_id) do nothing",
    );
    expect(manualFunction).toContain(
      "set stock_quantity = stock_quantity + p_quantity",
    );
  });

  it("blocks previously auto-restored orders and does not infer pre-dispatch safety", async () => {
    const sql = await migrationSql();
    const manualFunction = sql.split(
      "create or replace function public.restore_order_item_sellable_stock(",
    )[1];

    expect(sql).toContain("'legacy_automatic'");
    expect(sql).toContain(
      "where orders.stock_restored_at is not null",
    );
    expect(manualFunction).toContain(
      "if v_order.stock_restored_at is not null then",
    );
    expect(manualFunction).not.toContain("fulfilment_status");
    expect(manualFunction).not.toContain("shipped_at");
  });
});
