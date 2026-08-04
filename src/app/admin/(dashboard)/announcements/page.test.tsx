// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  getAdminAnnouncementSettings: vi.fn(),
  listAdminAnnouncements: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdminUser: mocks.requireAdminUser,
}));

vi.mock("@/lib/admin/announcements", () => ({
  getAdminAnnouncementSettings: mocks.getAdminAnnouncementSettings,
  listAdminAnnouncements: mocks.listAdminAnnouncements,
}));

import AdminAnnouncementsPage from "./page";

const ANNOUNCEMENT_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";

const SETTINGS = {
  id: 1,
  is_enabled: true,
  rotation_interval_seconds: 10,
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

const BASE_ANNOUNCEMENT = {
  id: ANNOUNCEMENT_ID,
  prefix_text: "Use code",
  highlight_text: "HAPPY2026",
  suffix_text: "for up to 60% off selected products",
  link_label: "Shop Now",
  link_href: "/shop",
  is_active: true,
  sort_order: 0,
  created_at: "2026-08-04T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
};

// Cards for small screens, the table from `lg` up. Assertions scope to one.
function mobileCards() {
  return within(screen.getByRole("list", { name: "Announcements" }));
}

function desktopTable() {
  return within(screen.getByRole("table", { name: "Announcements" }));
}

describe("admin announcements page", () => {
  beforeEach(() => {
    mocks.requireAdminUser.mockReset();
    mocks.getAdminAnnouncementSettings.mockReset();
    mocks.listAdminAnnouncements.mockReset();
    mocks.requireAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    mocks.getAdminAnnouncementSettings.mockResolvedValue(SETTINGS);
    mocks.listAdminAnnouncements.mockResolvedValue([BASE_ANNOUNCEMENT]);
  });

  afterEach(() => {
    cleanup();
  });

  describe("authorization", () => {
    it("checks admin authentication before reading any announcement data", async () => {
      mocks.requireAdminUser.mockRejectedValue(
        new Error("redirect to admin login"),
      );

      await expect(AdminAnnouncementsPage()).rejects.toThrow(
        "redirect to admin login",
      );
      expect(mocks.getAdminAnnouncementSettings).not.toHaveBeenCalled();
      expect(mocks.listAdminAnnouncements).not.toHaveBeenCalled();
    });

    it("lets a redirect propagate instead of rendering the error state", async () => {
      // requireAdminUser signals by throwing. The page's try/catch wraps only
      // the data reads, so the redirect must escape rather than be swallowed
      // and shown to a signed-out visitor as "could not be loaded".
      mocks.requireAdminUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

      await expect(AdminAnnouncementsPage()).rejects.toThrow("NEXT_REDIRECT");
    });
  });

  describe("banner settings", () => {
    it("renders the settings form seeded from the saved row", async () => {
      render(await AdminAnnouncementsPage());

      const form = within(
        screen.getByRole("form", { name: "Banner settings" }),
      );

      expect(
        form.getByRole("checkbox", { name: /show the announcement banner/i }),
      ).toBeChecked();
      expect(
        form.getByRole("spinbutton", { name: /rotation interval/i }),
      ).toHaveValue(10);
      expect(
        form.getByRole("button", { name: "Save settings" }),
      ).toBeInTheDocument();
    });

    it("seeds the form from a disabled row without inventing values", async () => {
      mocks.getAdminAnnouncementSettings.mockResolvedValue({
        ...SETTINGS,
        is_enabled: false,
        rotation_interval_seconds: 3,
      });

      render(await AdminAnnouncementsPage());

      const form = within(
        screen.getByRole("form", { name: "Banner settings" }),
      );

      expect(
        form.getByRole("checkbox", { name: /show the announcement banner/i }),
      ).not.toBeChecked();
      expect(
        form.getByRole("spinbutton", { name: /rotation interval/i }),
      ).toHaveValue(3);
    });

    it("reports a missing settings row instead of rendering a form", async () => {
      mocks.getAdminAnnouncementSettings.mockResolvedValue(null);

      render(await AdminAnnouncementsPage());

      expect(
        screen.getByText(/banner settings are missing/i),
      ).toBeInTheDocument();
      // No form with invented defaults: saving against a row that does not
      // exist would look like it worked and change nothing.
      expect(screen.queryByRole("form", { name: "Banner settings" })).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(screen.queryByRole("spinbutton")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Save settings" }),
      ).toBeNull();
    });
  });

  describe("announcement list", () => {
    it("shows every stored field in the desktop table", async () => {
      render(await AdminAnnouncementsPage());

      const table = desktopTable();

      for (const header of [
        "Order",
        "Prefix",
        "Highlight",
        "Suffix",
        "Link label",
        "Link href",
        "Status",
      ]) {
        expect(
          table.getByRole("columnheader", { name: header }),
        ).toBeInTheDocument();
      }

      const row = within(table.getAllByRole("row")[1]);
      expect(row.getByText("Use code")).toBeInTheDocument();
      expect(row.getByText("HAPPY2026")).toBeInTheDocument();
      expect(
        row.getByText("for up to 60% off selected products"),
      ).toBeInTheDocument();
      expect(row.getByText("Shop Now")).toBeInTheDocument();
      expect(row.getByText("/shop")).toBeInTheDocument();
      expect(row.getByText("0")).toBeInTheDocument();
      expect(row.getByText("Active")).toHaveAttribute("data-tone", "success");
    });

    it("preserves the order the data layer returned", async () => {
      mocks.listAdminAnnouncements.mockResolvedValue([
        { ...BASE_ANNOUNCEMENT, prefix_text: "First", sort_order: 0 },
        {
          ...BASE_ANNOUNCEMENT,
          id: SECOND_ID,
          prefix_text: "Second",
          sort_order: 1,
        },
      ]);

      render(await AdminAnnouncementsPage());

      const rows = desktopTable().getAllByRole("row").slice(1);

      expect(within(rows[0]).getByText("First")).toBeInTheDocument();
      expect(within(rows[1]).getByText("Second")).toBeInTheDocument();
    });

    it("stacks each announcement into a card with a preview for small screens", async () => {
      render(await AdminAnnouncementsPage());

      const card = within(mobileCards().getAllByRole("listitem")[0]);

      for (const label of [
        "Order",
        "Prefix",
        "Highlight",
        "Suffix",
        "Link label",
        "Link href",
      ]) {
        expect(card.getByText(label)).toBeInTheDocument();
      }

      // Each text fragment appears twice in a card: once in the sentence
      // preview at the top, once in its own labelled field below.
      expect(card.getAllByText("Use code")).toHaveLength(2);
      expect(card.getAllByText("HAPPY2026")).toHaveLength(2);
      expect(
        card.getAllByText("for up to 60% off selected products"),
      ).toHaveLength(2);
      expect(card.getByText("Shop Now")).toBeInTheDocument();
      expect(card.getByText("/shop")).toBeInTheDocument();
      expect(card.getByText("Active")).toHaveAttribute("data-tone", "success");
    });

    it("renders a missing optional field as an em dash in both presentations", async () => {
      mocks.listAdminAnnouncements.mockResolvedValue([
        {
          ...BASE_ANNOUNCEMENT,
          prefix_text: null,
          suffix_text: null,
          link_label: null,
          link_href: null,
        },
      ]);

      render(await AdminAnnouncementsPage());

      // Prefix, suffix, link label, and link href are all unset.
      expect(desktopTable().getAllByText("—")).toHaveLength(4);
      expect(mobileCards().getAllByText("—")).toHaveLength(4);
      // The highlight survives on its own, so the preview is not empty.
      expect(mobileCards().getAllByText("HAPPY2026")).toHaveLength(2);
    });

    it("tones active and inactive announcements while keeping the words readable", async () => {
      mocks.listAdminAnnouncements.mockResolvedValue([
        BASE_ANNOUNCEMENT,
        { ...BASE_ANNOUNCEMENT, id: SECOND_ID, is_active: false },
      ]);

      render(await AdminAnnouncementsPage());

      expect(desktopTable().getByText("Inactive")).toHaveAttribute(
        "data-tone",
        "neutral",
      );
      expect(mobileCards().getByText("Inactive")).toHaveAttribute(
        "data-tone",
        "neutral",
      );
    });
  });

  describe("responsive presentation", () => {
    it("hides the cards at desktop widths and the table below them", async () => {
      render(await AdminAnnouncementsPage());

      expect(screen.getByRole("list", { name: "Announcements" })).toHaveClass(
        "lg:hidden",
      );
      expect(
        screen.getByRole("table", { name: "Announcements" }).parentElement,
      ).toHaveClass("hidden", "lg:block");
    });

    it("lets the wide table scroll inside its own container", async () => {
      render(await AdminAnnouncementsPage());

      // Seven columns will not fit a narrow laptop; the container scrolls so
      // the admin page body never scrolls horizontally.
      expect(
        screen.getByRole("table", { name: "Announcements" }).parentElement,
      ).toHaveClass("overflow-x-auto");
    });

    it("wraps long copy instead of forcing horizontal scroll", async () => {
      const longSuffix =
        "for up to 60% off a deliberately long list of selected products";

      mocks.listAdminAnnouncements.mockResolvedValue([
        { ...BASE_ANNOUNCEMENT, suffix_text: longSuffix },
      ]);

      render(await AdminAnnouncementsPage());

      expect(
        desktopTable().getByText(longSuffix).closest("td"),
      ).toHaveClass("break-words", "[overflow-wrap:anywhere]");
    });

    it("keeps the field labels off the failing low-contrast class", async () => {
      render(await AdminAnnouncementsPage());

      const cardLabel = mobileCards().getByText("Prefix");
      expect(cardLabel.className).not.toContain("text-stone-500");
      expect(cardLabel.className).toContain("text-stone-400");

      const headerRow = desktopTable()
        .getByRole("columnheader", { name: "Status" })
        .closest("tr");
      expect(headerRow).not.toHaveClass("text-stone-500");
      expect(headerRow).toHaveClass("text-stone-400");
    });
  });

  describe("empty and error states", () => {
    it("renders neither presentation when there are no announcements", async () => {
      mocks.listAdminAnnouncements.mockResolvedValue([]);

      render(await AdminAnnouncementsPage());

      expect(screen.getByText("No announcements yet.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("list", { name: "Announcements" })).toBeNull();
    });

    it("still shows the banner settings when there are no announcements", async () => {
      mocks.listAdminAnnouncements.mockResolvedValue([]);

      render(await AdminAnnouncementsPage());

      expect(
        screen.getByRole("form", { name: "Banner settings" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Save settings" }),
      ).toBeInTheDocument();
    });

    it("reports a failed read without showing a misleading banner state", async () => {
      mocks.listAdminAnnouncements.mockRejectedValue(
        new Error("connection refused"),
      );
      vi.spyOn(console, "error").mockImplementation(() => {});

      render(await AdminAnnouncementsPage());

      expect(
        screen.getByText("Announcements could not be loaded. Please try again."),
      ).toBeInTheDocument();
      // Nothing was read successfully, so no settings claim is made at all.
      expect(screen.queryByRole("form", { name: "Banner settings" })).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("read-only scope", () => {
    it("keeps the announcement list read-only", async () => {
      mocks.listAdminAnnouncements.mockResolvedValue([
        BASE_ANNOUNCEMENT,
        { ...BASE_ANNOUNCEMENT, id: SECOND_ID, is_active: false },
      ]);

      render(await AdminAnnouncementsPage());

      // Editing, deleting, per-item toggles, and reordering all arrive in
      // later phases. The settings form above is the only thing that writes.
      for (const list of [mobileCards(), desktopTable()]) {
        expect(list.queryAllByRole("button")).toHaveLength(0);
        expect(list.queryAllByRole("link")).toHaveLength(0);
        expect(list.queryAllByRole("textbox")).toHaveLength(0);
        expect(list.queryAllByRole("checkbox")).toHaveLength(0);
        expect(list.queryAllByRole("spinbutton")).toHaveLength(0);
      }
    });

    it("adds no controls beyond the settings form itself", async () => {
      render(await AdminAnnouncementsPage());

      // Exactly one toggle, one interval field, and one save button on the
      // whole page.
      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
      expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryAllByRole("link")).toHaveLength(0);
    });
  });
});
