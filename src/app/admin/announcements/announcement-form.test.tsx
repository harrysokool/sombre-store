// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAnnouncementAction: vi.fn(),
  updateAnnouncementAction: vi.fn(),
}));

vi.mock("@/app/admin/announcements/actions", () => ({
  createAnnouncementAction: mocks.createAnnouncementAction,
  updateAnnouncementAction: mocks.updateAnnouncementAction,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AnnouncementForm } from "./announcement-form";

const ANNOUNCEMENT_ID = "11111111-1111-4111-8111-111111111111";

const SAVED = {
  mode: "edit" as const,
  announcementId: ANNOUNCEMENT_ID,
  prefixText: "Use code",
  highlightText: "HAPPY2026",
  suffixText: "for up to 60% off selected products",
  linkLabel: "Shop Now",
  linkHref: "/shop",
  isActive: true,
};

const field = {
  prefix: () => screen.getByRole("textbox", { name: /^prefix/i }),
  highlight: () => screen.getByRole("textbox", { name: /^highlight/i }),
  suffix: () => screen.getByRole("textbox", { name: /^suffix/i }),
  linkLabel: () => screen.getByRole("textbox", { name: /link label/i }),
  linkHref: () => screen.getByRole("textbox", { name: /link path/i }),
  active: () => screen.getByRole("checkbox", { name: /active/i }),
};

function preview() {
  return within(screen.getByRole("region", { name: "Announcement preview" }));
}

function submitButton() {
  return screen.getByRole("button", { name: /create announcement|save changes|saving/i });
}

describe("announcement form", () => {
  beforeEach(() => {
    mocks.createAnnouncementAction.mockReset();
    mocks.updateAnnouncementAction.mockReset();
    mocks.createAnnouncementAction.mockResolvedValue({
      error: null,
      success: "Announcement created.",
      announcementId: ANNOUNCEMENT_ID,
    });
    mocks.updateAnnouncementAction.mockResolvedValue({
      error: null,
      success: "Announcement saved.",
      announcementId: ANNOUNCEMENT_ID,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("create mode", () => {
    it("starts empty, inactive, and with no hidden reference", async () => {
      const { container } = render(<AnnouncementForm mode="create" />);

      expect(field.prefix()).toHaveValue("");
      expect(field.highlight()).toHaveValue("");
      expect(field.suffix()).toHaveValue("");
      expect(field.linkLabel()).toHaveValue("");
      expect(field.linkHref()).toHaveValue("");
      expect(field.active()).not.toBeChecked();
      expect(
        container.querySelector('input[name="announcementId"]'),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Create announcement" }),
      ).toBeInTheDocument();
    });

    it("submits to the create action, never the update action", async () => {
      const user = userEvent.setup();
      render(<AnnouncementForm mode="create" />);

      await user.type(field.prefix(), "Free shipping");
      await user.click(submitButton());

      await waitFor(() => {
        expect(mocks.createAnnouncementAction).toHaveBeenCalled();
      });
      expect(mocks.updateAnnouncementAction).not.toHaveBeenCalled();
    });

    it("offers no position control, so order is never chosen here", async () => {
      render(<AnnouncementForm mode="create" />);

      expect(screen.queryByRole("spinbutton")).toBeNull();
      expect(screen.queryByRole("textbox", { name: /order|position/i })).toBeNull();
    });
  });

  describe("edit mode", () => {
    it("seeds every field from the saved announcement", () => {
      render(<AnnouncementForm {...SAVED} />);

      expect(field.prefix()).toHaveValue("Use code");
      expect(field.highlight()).toHaveValue("HAPPY2026");
      expect(field.suffix()).toHaveValue(
        "for up to 60% off selected products",
      );
      expect(field.linkLabel()).toHaveValue("Shop Now");
      expect(field.linkHref()).toHaveValue("/shop");
      expect(field.active()).toBeChecked();
    });

    it("carries the announcement reference in a hidden field", () => {
      const { container } = render(<AnnouncementForm {...SAVED} />);

      expect(
        container.querySelector('input[name="announcementId"]'),
      ).toHaveValue(ANNOUNCEMENT_ID);
    });

    it("submits to the update action", async () => {
      const user = userEvent.setup();
      render(<AnnouncementForm {...SAVED} />);

      await user.click(submitButton());

      await waitFor(() => {
        expect(mocks.updateAnnouncementAction).toHaveBeenCalled();
      });
      expect(mocks.createAnnouncementAction).not.toHaveBeenCalled();
    });
  });

  describe("preview", () => {
    it("renders the highlight in a pill between prefix and suffix", () => {
      render(<AnnouncementForm {...SAVED} />);

      const pill = preview().getByText("HAPPY2026");
      expect(pill).toBeInTheDocument();
      // The same rounded pill treatment the storefront gives the highlight.
      expect(pill.className).toContain("rounded-full");
      expect(preview().getByText("Use code")).toBeInTheDocument();
      expect(
        preview().getByText("for up to 60% off selected products"),
      ).toBeInTheDocument();
    });

    it("updates as the fields are typed", async () => {
      const user = userEvent.setup();
      render(<AnnouncementForm mode="create" />);

      await user.type(field.highlight(), "SUMMER");

      expect(preview().getByText("SUMMER")).toBeInTheDocument();
    });

    it("shows guidance rather than an empty bar when nothing is entered", () => {
      render(<AnnouncementForm mode="create" />);

      expect(
        preview().getByText(/enter prefix, highlight, or suffix text/i),
      ).toBeInTheDocument();
    });

    it("omits absent parts so a leading pill is visible", () => {
      render(
        <AnnouncementForm
          mode="edit"
          announcementId={ANNOUNCEMENT_ID}
          highlightText="HAPPY2026"
          suffixText="ends Sunday"
        />,
      );

      expect(preview().getByText("HAPPY2026")).toBeInTheDocument();
      expect(preview().getByText("ends Sunday")).toBeInTheDocument();
      expect(preview().queryByText("Use code")).toBeNull();
    });
  });

  describe("length limits", () => {
    it("caps each field at the length the database allows", () => {
      render(<AnnouncementForm {...SAVED} />);

      expect(field.prefix()).toHaveAttribute("maxLength", "80");
      expect(field.highlight()).toHaveAttribute("maxLength", "32");
      expect(field.suffix()).toHaveAttribute("maxLength", "120");
      expect(field.linkLabel()).toHaveAttribute("maxLength", "32");
      expect(field.linkHref()).toHaveAttribute("maxLength", "200");
    });
  });

  describe("feedback", () => {
    it("disables the controls and names the pending state while saving", async () => {
      const user = userEvent.setup();
      let resolveAction: (state: {
        error: string | null;
        success: string | null;
        announcementId: string | null;
      }) => void = () => {};

      mocks.updateAnnouncementAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      render(<AnnouncementForm {...SAVED} />);
      await user.click(submitButton());

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
      });
      expect(field.prefix()).toBeDisabled();
      expect(field.active()).toBeDisabled();

      resolveAction({
        error: null,
        success: "Announcement saved.",
        announcementId: ANNOUNCEMENT_ID,
      });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Save changes" }),
        ).toBeEnabled();
      });
    });

    it("shows no success state, because a saved form redirects away", async () => {
      const user = userEvent.setup();
      render(<AnnouncementForm {...SAVED} />);

      await user.click(submitButton());

      await waitFor(() => {
        expect(mocks.updateAnnouncementAction).toHaveBeenCalled();
      });
      // The list is the confirmation; the form never reports success itself.
      expect(screen.queryByRole("status")).toBeNull();
      expect(
        screen.queryByRole("link", { name: "Back to announcements" }),
      ).toBeNull();
    });

    it("shows a validation refusal as an alert", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementAction.mockResolvedValue({
        error: "Enter at least one of prefix, highlight, or suffix text.",
        success: null,
        announcementId: null,
      });

      render(<AnnouncementForm {...SAVED} />);
      await user.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Enter at least one of prefix, highlight, or suffix text.",
      );
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows a database failure as a generic alert", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementAction.mockResolvedValue({
        error: "Announcement could not be saved. Try again.",
        success: null,
        announcementId: null,
      });

      render(<AnnouncementForm {...SAVED} />);
      await user.click(submitButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Announcement could not be saved.");
      expect(alert).not.toHaveTextContent(/relation|supabase|postgres/i);
    });

    it("keeps edited values after a refused save", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementAction.mockResolvedValue({
        error: "That announcement no longer exists. Refresh the list.",
        success: null,
        announcementId: null,
      });

      render(<AnnouncementForm {...SAVED} />);

      await user.clear(field.suffix());
      await user.type(field.suffix(), "ends Sunday");
      await user.click(field.active());
      await user.click(submitButton());

      await screen.findByRole("alert");
      // React resets the form element after an action completes; the
      // correction must survive it or it has to be retyped.
      expect(field.suffix()).toHaveValue("ends Sunday");
      expect(field.active()).not.toBeChecked();
    });
  });
});
