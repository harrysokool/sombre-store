// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setAnnouncementActiveAction: vi.fn(),
  deleteAnnouncementAction: vi.fn(),
  moveAnnouncementAction: vi.fn(),
}));

vi.mock("@/app/admin/announcements/actions", () => ({
  setAnnouncementActiveAction: mocks.setAnnouncementActiveAction,
  deleteAnnouncementAction: mocks.deleteAnnouncementAction,
  moveAnnouncementAction: mocks.moveAnnouncementAction,
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

function renderControls(
  isActive = true,
  { isFirst = false, isLast = false } = {},
) {
  return render(
    <AnnouncementRowControls
      announcementId={ANNOUNCEMENT_ID}
      isActive={isActive}
      description={DESCRIPTION}
      isFirst={isFirst}
      isLast={isLast}
    />,
  );
}

const upButton = () =>
  screen.getByRole("button", { name: /^Move announcement up/ });
const downButton = () =>
  screen.getByRole("button", { name: /^Move announcement down/ });

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
    mocks.moveAnnouncementAction.mockReset();
    mocks.moveAnnouncementAction.mockResolvedValue({
      error: null,
      success: "Moved up.",
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
    it("offers exactly the row actions before confirming", () => {
      renderControls();

      // Up, Down, Deactivate, Delete are buttons; Edit is a link.
      expect(screen.getAllByRole("button")).toHaveLength(4);
      expect(screen.getAllByRole("link")).toHaveLength(1);
    });

    it("uses no drag and drop affordance", () => {
      const { container } = renderControls();

      expect(container.querySelector("[draggable]")).toBeNull();
      expect(container.querySelector('[aria-grabbed]')).toBeNull();
    });
  });
});

describe("announcement move controls", () => {
  beforeEach(() => {
    mocks.setAnnouncementActiveAction.mockReset();
    mocks.deleteAnnouncementAction.mockReset();
    mocks.moveAnnouncementAction.mockReset();
    mocks.moveAnnouncementAction.mockResolvedValue({
      error: null,
      success: "Moved up.",
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("submitting", () => {
    it("submits the id and the up direction", async () => {
      const user = userEvent.setup();
      renderControls(true, { isFirst: false, isLast: false });

      await user.click(upButton());

      await waitFor(() => {
        expect(mocks.moveAnnouncementAction).toHaveBeenCalled();
      });
      const submitted = mocks.moveAnnouncementAction.mock.calls[0][1];
      expect(submitted.get("announcementId")).toBe(ANNOUNCEMENT_ID);
      expect(submitted.get("direction")).toBe("up");
      // Position is never sent from the browser.
      expect(submitted.get("sortOrder")).toBeNull();
      expect(submitted.get("sort_order")).toBeNull();
    });

    it("submits the id and the down direction", async () => {
      const user = userEvent.setup();
      renderControls();

      await user.click(downButton());

      await waitFor(() => {
        expect(mocks.moveAnnouncementAction).toHaveBeenCalled();
      });
      expect(
        mocks.moveAnnouncementAction.mock.calls[0][1].get("direction"),
      ).toBe("down");
    });
  });

  describe("boundaries", () => {
    it("disables Up for the first announcement", () => {
      renderControls(true, { isFirst: true });

      expect(upButton()).toBeDisabled();
      expect(downButton()).toBeEnabled();
    });

    it("disables Down for the last announcement", () => {
      renderControls(true, { isLast: true });

      expect(downButton()).toBeDisabled();
      expect(upButton()).toBeEnabled();
    });

    it("disables both for a lone announcement", () => {
      renderControls(true, { isFirst: true, isLast: true });

      expect(upButton()).toBeDisabled();
      expect(downButton()).toBeDisabled();
    });

    it("enables both in the middle of the list", () => {
      renderControls();

      expect(upButton()).toBeEnabled();
      expect(downButton()).toBeEnabled();
    });

    it("does not submit from a disabled control", async () => {
      const user = userEvent.setup();
      renderControls(true, { isFirst: true });

      await user.click(upButton());

      expect(mocks.moveAnnouncementAction).not.toHaveBeenCalled();
    });
  });

  describe("pending state", () => {
    it("names the pending state on the pressed direction only", async () => {
      const user = userEvent.setup();
      let resolveAction: (state: {
        error: string | null;
        success: string | null;
      }) => void = () => {};

      mocks.moveAnnouncementAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      renderControls();
      await user.click(upButton());

      await waitFor(() => {
        expect(upButton()).toHaveTextContent("Moving…");
      });
      // The other direction stays labelled, so it is clear which move is
      // in flight.
      expect(downButton()).toHaveTextContent("Down");
      expect(downButton()).toBeDisabled();

      resolveAction({ error: null, success: "Moved up." });

      await waitFor(() => {
        expect(upButton()).toHaveTextContent("Up");
      });
    });

    it("disables the other row actions while a move is in flight", async () => {
      const user = userEvent.setup();
      let resolveAction: (state: {
        error: string | null;
        success: string | null;
      }) => void = () => {};

      mocks.moveAnnouncementAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      renderControls();
      await user.click(upButton());

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Deactivate announcement/ }),
        ).toBeDisabled();
      });
      expect(
        screen.getByRole("button", { name: /^Delete announcement/ }),
      ).toBeDisabled();

      resolveAction({ error: null, success: "Moved up." });
      await screen.findByRole("status");
    });
  });

  describe("feedback", () => {
    it("reports a completed move", async () => {
      const user = userEvent.setup();
      renderControls();

      await user.click(upButton());

      expect(await screen.findByRole("status")).toHaveTextContent("Moved up.");
    });

    it("reports a refused move as an alert", async () => {
      const user = userEvent.setup();
      mocks.moveAnnouncementAction.mockResolvedValue({
        error: "Announcement could not be moved. Try again.",
        success: null,
      });

      renderControls();
      await user.click(downButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Announcement could not be moved. Try again.",
      );
    });
  });

  describe("accessible labels", () => {
    it("names the announcement each direction applies to", () => {
      renderControls();

      expect(
        screen.getByRole("button", {
          name: `Move announcement up: ${DESCRIPTION}`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: `Move announcement down: ${DESCRIPTION}`,
        }),
      ).toBeInTheDocument();
    });
  });
});
