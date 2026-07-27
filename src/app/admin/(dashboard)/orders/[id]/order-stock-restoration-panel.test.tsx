// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  restoreOrderItemStockAction: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({
  restoreOrderItemStockAction: mocks.restoreOrderItemStockAction,
}));

import {
  OrderStockRestorationPanel,
  type OrderStockRestorationPanelProps,
} from "./order-stock-restoration-panel";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";

function props(
  overrides: Partial<OrderStockRestorationPanelProps> = {},
): OrderStockRestorationPanelProps {
  return {
    orderId: ORDER_ID,
    lockedReason: null,
    items: [
      {
        id: ITEM_ID,
        productId: PRODUCT_ID,
        productName: "Sombre Eau de Parfum",
        purchasedQuantity: 3,
        restoredQuantity: 1,
        remainingQuantity: 2,
        requestId: REQUEST_ID,
      },
    ],
    history: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  mocks.restoreOrderItemStockAction.mockReset();
});

describe("order stock restoration panel", () => {
  it("lets an administrator choose a partial quantity and requires a reason", () => {
    render(<OrderStockRestorationPanel {...props()} />);

    const quantity = screen.getByRole("spinbutton", {
      name: "Safe quantity",
    });
    const reason = screen.getByRole("textbox", {
      name: "Inspection reason",
    });

    expect(quantity).toHaveAttribute("min", "1");
    expect(quantity).toHaveAttribute("max", "2");
    expect(quantity).toHaveValue(2);
    expect(quantity).toBeRequired();
    expect(reason).toBeRequired();
    expect(reason).toHaveAttribute("maxlength", "1000");
    expect(
      screen.getByRole("button", { name: "Restore inspected stock" }),
    ).toBeEnabled();
    expect(
      document.querySelector<HTMLInputElement>('input[name="requestId"]')
        ?.value,
    ).toBe(REQUEST_ID);
  });

  it("does not offer another restoration after every purchased unit is restored", () => {
    render(
      <OrderStockRestorationPanel
        {...props({
          items: [
            {
              ...props().items[0],
              restoredQuantity: 3,
              remainingQuantity: 0,
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText(
        "Every purchased unit on this line has already been restored.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore inspected stock" }),
    ).toBeNull();
  });

  it("locks legacy automatically restored orders and shows their audit history", () => {
    render(
      <OrderStockRestorationPanel
        {...props({
          lockedReason:
            "This older order already had its full stock quantity restored automatically.",
          history: [
            {
              id: "restoration-1",
              productName: "Sombre Eau de Parfum",
              productId: PRODUCT_ID,
              quantityRestored: 3,
              reason:
                "Legacy automatic full-refund stock restoration before manual review controls.",
              administratorIdentity: "Legacy system",
              restoredAtLabel: "24 July 2026 at 9:00 pm",
              isLegacy: true,
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByText(/already had its full stock quantity restored/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore inspected stock" }),
    ).toBeNull();
    expect(
      screen.getByText(/Legacy automatic full-refund stock restoration/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Legacy automatic record")).toBeInTheDocument();
  });
});
