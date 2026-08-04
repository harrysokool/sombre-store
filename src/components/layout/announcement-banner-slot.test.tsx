// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStorefrontAnnouncementBanner: vi.fn(),
}));

vi.mock("@/lib/storefront/announcements", () => ({
  getStorefrontAnnouncementBanner: mocks.getStorefrontAnnouncementBanner,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AnnouncementBannerSlot } from "./announcement-banner-slot";

const FIRST = {
  id: "11111111-1111-4111-8111-111111111111",
  prefix_text: "Use code",
  highlight_text: "HAPPY2026",
  suffix_text: "for up to 60% off selected products",
  link_label: "Shop Now",
  link_href: "/shop",
};

const SECOND = {
  id: "22222222-2222-4222-8222-222222222222",
  prefix_text: "Free shipping",
  highlight_text: "OVER500",
  suffix_text: "on Hong Kong orders",
  link_label: null,
  link_href: null,
};

describe("announcement banner slot", () => {
  beforeEach(() => {
    mocks.getStorefrontAnnouncementBanner.mockReset();
    mocks.getStorefrontAnnouncementBanner.mockResolvedValue({
      isEnabled: true,
      rotationIntervalSeconds: 10,
      announcements: [FIRST],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the enabled banner from the cached read", async () => {
    render(await AnnouncementBannerSlot());

    expect(screen.getByText("Use code")).toBeInTheDocument();
    expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
    expect(
      screen.getByText("for up to 60% off selected products"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop Now" })).toHaveAttribute(
      "href",
      "/shop",
    );
  });

  it("renders nothing when the banner is switched off", async () => {
    mocks.getStorefrontAnnouncementBanner.mockResolvedValue({
      isEnabled: false,
      rotationIntervalSeconds: 10,
      announcements: [FIRST],
    });

    // Even with active announcements available, the global switch wins.
    expect(await AnnouncementBannerSlot()).toBeNull();
  });

  it("renders nothing when no announcement is active", async () => {
    mocks.getStorefrontAnnouncementBanner.mockResolvedValue({
      isEnabled: true,
      rotationIntervalSeconds: 10,
      announcements: [],
    });

    expect(await AnnouncementBannerSlot()).toBeNull();
  });

  it("renders nothing when the settings row is missing", async () => {
    // A missing row reads as disabled from the data layer.
    mocks.getStorefrontAnnouncementBanner.mockResolvedValue({
      isEnabled: false,
      rotationIntervalSeconds: null,
      announcements: [FIRST],
    });

    expect(await AnnouncementBannerSlot()).toBeNull();
  });

  describe("failure", () => {
    it("renders nothing and logs when the read throws", async () => {
      mocks.getStorefrontAnnouncementBanner.mockRejectedValue(
        new Error("Announcements could not be read."),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // This sits in the shared layout, so an uncaught throw would break every
      // storefront page.
      expect(await AnnouncementBannerSlot()).toBeNull();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it("does not fall back to the previously hardcoded promotion", async () => {
      mocks.getStorefrontAnnouncementBanner.mockRejectedValue(
        new Error("Announcements could not be read."),
      );
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const rendered = await AnnouncementBannerSlot();

      // Showing a discount after an administrator switched the banner off
      // would advertise an offer meant to be inactive.
      expect(rendered).toBeNull();
      expect(JSON.stringify(rendered)).not.toContain("HAPPY2026");

      consoleError.mockRestore();
    });
  });

  describe("single announcement for this phase", () => {
    it("renders only the first announcement", async () => {
      mocks.getStorefrontAnnouncementBanner.mockResolvedValue({
        isEnabled: true,
        rotationIntervalSeconds: 10,
        announcements: [FIRST, SECOND],
      });

      render(await AnnouncementBannerSlot());

      expect(screen.getByText("HAPPY2026")).toBeInTheDocument();
      // No rotation yet: the second announcement is not rendered at all.
      expect(screen.queryByText("OVER500")).toBeNull();
      expect(screen.queryByText("Free shipping")).toBeNull();
    });

    it("adds no rotation or navigation controls", async () => {
      mocks.getStorefrontAnnouncementBanner.mockResolvedValue({
        isEnabled: true,
        rotationIntervalSeconds: 10,
        announcements: [FIRST, SECOND],
      });

      render(await AnnouncementBannerSlot());

      // Dismiss is the only button; previous/next arrive with the carousel.
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(
        screen.getByRole("button", { name: "Dismiss announcement" }),
      ).toBeInTheDocument();
    });
  });
});
