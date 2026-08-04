// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAnnouncementActiveAction: vi.fn(),
  deleteAnnouncementAction: vi.fn(),
}));

vi.mock("@/app/admin/announcements/actions", () => ({
  setAnnouncementActiveAction: mocks.setAnnouncementActiveAction,
  deleteAnnouncementAction: mocks.deleteAnnouncementAction,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AnnouncementRowControls } from "./announcement-row-controls";

const ANNOUNCEMENT_ID = "11111111-1111-4111-8111-111111111111";
const DESCRIPTION = "Use code HAPPY2026 for 60% off";

function renderControls(isActive = true) {
  return render(
    <AnnouncementRowControls
      announcementId={ANNOUNCEMENT_ID}
      isActive={isActive}
      description={DESCRIPTION}
    />,
  );
}

const deleteButton = () => screen.getByRole("button", { name: /^Delete announcement/ });
const confirmButton = () =>
  screen.getByRole("button", { name: /^Confirm delete announcement/ });

describe("announcement row controls", () => {
  beforeEach(() => {
    mocks.setAnnouncementActiveAction.mockReset();
    mocks.deleteAnnouncementAction.mockReset();
    mocks.setAnnouncementActiveAction.mockResolvedValue({
      error: null,
      success: "Announcement deactivated.",
    });
    mocks.deleteAnnouncementAction.mockResolvedValue({
      error: null,
      success: "Announcement deleted.",
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("edit", () => {
    it("links to this announcement's editor", () => {
      renderControls();

      expect(
        screen.getByRole("link", { name: /^Edit announcement/ }),
      ).toHaveAttribute("href", `/admin/announcements/${ANNOUNCEMENT_ID}`);
    });

    it("names the announcement so each row's controls are distinguishable", () => {
      renderControls();

      expect(
        screen.getByRole("link", {
          name: `Edit announcement: ${DESCRIPTION}`,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("active toggle", () => {
    it("offers Deactivate for an active announcement and submits false", async () => {
      const user = userEvent.setup();
      renderControls(true);

      const button = screen.getByRole("button", {
        name: /^Deactivate announcement/,
      });
      expect(button).toHaveTextContent("Deactivate");

      await user.click(button);

      await waitFor(() => {
        expect(mocks.setAnnouncementActiveAction).toHaveBeenCalled();
      });
      const submitted = mocks.setAnnouncementActiveAction.mock.calls[0][1];
      expect(submitted.get("announcementId")).toBe(ANNOUNCEMENT_ID);
      expect(submitted.get("isActive")).toBe("false");
    });

    it("offers Activate for an inactive announcement and submits true", async () => {
      const user = userEvent.setup();
      renderControls(false);

      await user.click(
        screen.getByRole("button", { name: /^Activate announcement/ }),
      );

      await waitFor(() => {
        expect(mocks.setAnnouncementActiveAction).toHaveBeenCalled();
      });
      expect(
        mocks.setAnnouncementActiveAction.mock.calls[0][1].get("isActive"),
      ).toBe("true");
    });

    it("names its pending state while saving", async () => {
      const user = userEvent.setup();
      let resolveAction: (state: {
        error: string | null;
        success: string | null;
      }) => void = () => {};

      mocks.setAnnouncementActiveAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      renderControls(true);
      await user.click(
        screen.getByRole("button", { name: /^Deactivate announcement/ }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Deactivate announcement/ }),
        ).toBeDisabled();
      });
      expect(
        screen.getByRole("button", { name: /^Deactivate announcement/ }),
      ).toHaveTextContent("Saving…");

      resolveAction({ error: null, success: "Announcement deactivated." });
      await screen.findByRole("status");
    });

    it("reports the result", async () => {
      const user = userEvent.setup();
      renderControls(true);

      await user.click(
        screen.getByRole("button", { name: /^Deactivate announcement/ }),
      );

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Announcement deactivated.",
      );
    });

    it("reports a refusal as an alert", async () => {
      const user = userEvent.setup();
      mocks.setAnnouncementActiveAction.mockResolvedValue({
        error: "That announcement no longer exists. Refresh the list.",
        success: null,
      });

      renderControls(true);
      await user.click(
        screen.getByRole("button", { name: /^Deactivate announcement/ }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "no longer exists",
      );
    });
  });

  describe("delete confirmation", () => {
    it("does not delete on the first press", async () => {
      const user = userEvent.setup();
      renderControls();

      await user.click(deleteButton());

      // The first press only asks. Deletion is irreversible and there is no
      // undo, so it must never happen on a single stray click.
      expect(mocks.deleteAnnouncementAction).not.toHaveBeenCalled();
      expect(
        screen.getByText(/delete this announcement\? this cannot be undone/i),
      ).toBeInTheDocument();
    });

    it("deletes only after the confirmation is pressed", async () => {
      const user = userEvent.setup();
      renderControls();

      await user.click(deleteButton());
      await user.click(confirmButton());

      await waitFor(() => {
        expect(mocks.deleteAnnouncementAction).toHaveBeenCalled();
      });
      expect(
        mocks.deleteAnnouncementAction.mock.calls[0][1].get("announcementId"),
      ).toBe(ANNOUNCEMENT_ID);
    });

    it("abandons the deletion when cancelled", async () => {
      const user = userEvent.setup();
      renderControls();

      await user.click(deleteButton());
      await user.click(screen.getByRole("button", { name: /^Keep announcement/ }));

      expect(mocks.deleteAnnouncementAction).not.toHaveBeenCalled();
      expect(
        screen.queryByText(/delete this announcement\?/i),
      ).toBeNull();
      // The ordinary Delete button is back, so the row is usable again.
      expect(deleteButton()).toBeInTheDocument();
    });

    it("names its pending state while deleting", async () => {
      const user = userEvent.setup();
      let resolveAction: (state: {
        error: string | null;
        success: string | null;
      }) => void = () => {};

      mocks.deleteAnnouncementAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      renderControls();
      await user.click(deleteButton());
      await user.click(confirmButton());

      await waitFor(() => {
        expect(confirmButton()).toBeDisabled();
      });
      expect(confirmButton()).toHaveTextContent("Deleting…");

      resolveAction({ error: null, success: "Announcement deleted." });
      await screen.findByRole("status");
    });

    it("reports a refused deletion as an alert", async () => {
      const user = userEvent.setup();
      mocks.deleteAnnouncementAction.mockResolvedValue({
        error: "Announcement could not be deleted. Try again.",
        success: null,
      });

      renderControls();
      await user.click(deleteButton());
      await user.click(confirmButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Announcement could not be deleted. Try again.",
      );
    });
  });

  describe("scope", () => {
    it("offers no ordering controls", () => {
      renderControls();

      for (const name of [/move/i, /up/i, /down/i, /reorder/i, /position/i]) {
        expect(screen.queryByRole("button", { name })).toBeNull();
        expect(screen.queryByRole("link", { name })).toBeNull();
      }
    });

    it("offers exactly the three row actions before confirming", () => {
      renderControls();

      // Deactivate and Delete are buttons; Edit is a link.
      expect(screen.getAllByRole("button")).toHaveLength(2);
      expect(screen.getAllByRole("link")).toHaveLength(1);
    });
  });
});
