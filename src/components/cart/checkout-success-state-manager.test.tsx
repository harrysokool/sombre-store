// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileCartWithCheckoutSession: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/cart/cart", () => ({
  reconcileCartWithCheckoutSession: mocks.reconcileCartWithCheckoutSession,
}));

// A fresh object per call mirrors what matters for this test: each poll round
// is driven by a re-render, not by a value baked in at mount time.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { CheckoutSuccessStateManager } from "./checkout-success-state-manager";

const NO_REFRESH_TEXT =
  /Please do not refresh or close this page\. Your payment is being confirmed\./;
const PAUSED_TEXT = /Automatic updates have paused/;

describe("CheckoutSuccessStateManager pending-confirmation notice", () => {
  beforeEach(() => {
    mocks.reconcileCartWithCheckoutSession.mockReset();
    mocks.refresh.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the no-refresh notice while confirmation is pending and polling", () => {
    render(
      <CheckoutSuccessStateManager
        shouldCleanupCart={false}
        shouldRefresh={true}
        sessionId="cs_test_pending"
      />,
    );

    expect(screen.getByText(NO_REFRESH_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PAUSED_TEXT)).toBeNull();
  });

  it("keeps the existing polling call (router.refresh) unaffected while the notice is shown", () => {
    render(
      <CheckoutSuccessStateManager
        shouldCleanupCart={false}
        shouldRefresh={true}
        sessionId="cs_test_pending"
      />,
    );

    expect(mocks.refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(NO_REFRESH_TEXT)).toBeInTheDocument();
  });

  it("hides the notice once confirmation succeeds (cart cleanup, no more refreshing)", () => {
    render(
      <CheckoutSuccessStateManager
        shouldCleanupCart={true}
        shouldRefresh={false}
        sessionId="cs_test_success"
      />,
    );

    expect(screen.queryByText(NO_REFRESH_TEXT)).toBeNull();
    expect(screen.queryByText(PAUSED_TEXT)).toBeNull();
    expect(mocks.reconcileCartWithCheckoutSession).toHaveBeenCalledWith(
      "cs_test_success",
    );
  });

  it("hides the notice for a final, non-refreshing state (failure)", () => {
    render(
      <CheckoutSuccessStateManager
        shouldCleanupCart={false}
        shouldRefresh={false}
        sessionId="cs_test_failed"
      />,
    );

    expect(screen.queryByText(NO_REFRESH_TEXT)).toBeNull();
    expect(screen.queryByText(PAUSED_TEXT)).toBeNull();
  });

  it("replaces the no-refresh notice with the paused notice once the poll budget is spent (timeout)", () => {
    const { rerender } = render(
      <CheckoutSuccessStateManager
        shouldCleanupCart={false}
        shouldRefresh={true}
        sessionId="cs_test_timeout"
      />,
    );

    expect(screen.getByText(NO_REFRESH_TEXT)).toBeInTheDocument();

    // 8 attempts: 3s, 6s, 12s, 24s, then capped at 30s. Each round is driven by
    // a re-render, standing in for the fresh server round trip a real
    // router.refresh() would produce.
    const delays = [3000, 6000, 12000, 24000, 30000, 30000, 30000, 30000];

    for (const delay of delays) {
      act(() => {
        vi.advanceTimersByTime(delay);
      });
      rerender(
        <CheckoutSuccessStateManager
          shouldCleanupCart={false}
          shouldRefresh={true}
          sessionId="cs_test_timeout"
        />,
      );
    }

    expect(mocks.refresh).toHaveBeenCalledTimes(8);
    expect(screen.queryByText(NO_REFRESH_TEXT)).toBeNull();
    expect(screen.getByText(PAUSED_TEXT)).toBeInTheDocument();
  });
});
