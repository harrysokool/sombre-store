// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateAnnouncementSettingsAction: vi.fn(),
}));

vi.mock("@/app/admin/announcements/actions", () => ({
  updateAnnouncementSettingsAction: mocks.updateAnnouncementSettingsAction,
}));

import { AnnouncementSettingsForm } from "./announcement-settings-form";

function toggle() {
  return screen.getByRole("checkbox", {
    name: /show the announcement banner/i,
  });
}

function intervalInput() {
  return screen.getByRole("spinbutton", { name: /rotation interval/i });
}

function saveButton() {
  return screen.getByRole("button", { name: /save settings|saving/i });
}

describe("announcement settings form", () => {
  beforeEach(() => {
    mocks.updateAnnouncementSettingsAction.mockReset();
    mocks.updateAnnouncementSettingsAction.mockResolvedValue({
      error: null,
      success: "Banner settings saved. The banner is off.",
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial values", () => {
    it("reflects an enabled banner and its saved interval", () => {
      render(
        <AnnouncementSettingsForm
          isEnabled
          rotationIntervalSeconds={10}
        />,
      );

      expect(toggle()).toBeChecked();
      expect(intervalInput()).toHaveValue(10);
      expect(saveButton()).toBeEnabled();
    });

    it("reflects a disabled banner and a different interval", () => {
      render(
        <AnnouncementSettingsForm
          isEnabled={false}
          rotationIntervalSeconds={45}
        />,
      );

      expect(toggle()).not.toBeChecked();
      expect(intervalInput()).toHaveValue(45);
    });

    it("publishes the supported range on the input itself", () => {
      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      // The browser blocks obvious mistakes before a round trip; the Server
      // Action and the database constraint remain the real authorities.
      expect(intervalInput()).toHaveAttribute("min", "3");
      expect(intervalInput()).toHaveAttribute("max", "60");
      expect(intervalInput()).toHaveAttribute("step", "1");
      expect(intervalInput()).toBeRequired();
    });

    it("states the interval range compactly and drops the explanations", () => {
      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      expect(screen.getByText("3–60 seconds")).toBeInTheDocument();

      for (const removed of [
        /seconds each announcement is shown/i,
        /only applies when more than one/i,
        /whatever the announcements below say/i,
      ]) {
        expect(screen.queryByText(removed)).toBeNull();
      }
    });

    it("shows no feedback before anything is submitted", () => {
      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("submitting", () => {
    it("disables the controls and names the pending state while saving", async () => {
      const user = userEvent.setup();
      let resolveAction: (state: {
        error: string | null;
        success: string | null;
      }) => void = () => {};

      mocks.updateAnnouncementSettingsAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      );

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);
      await user.click(saveButton());

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Saving…" }),
        ).toBeDisabled();
      });
      // Nothing may be edited mid-flight, so a save cannot race the values it
      // was submitted with.
      expect(toggle()).toBeDisabled();
      expect(intervalInput()).toBeDisabled();

      resolveAction({ error: null, success: "Banner settings saved." });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Save settings" }),
        ).toBeEnabled();
      });
      // The saved field values are the confirmation, not a status message.
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows no success message after a successful save", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementSettingsAction.mockResolvedValue({
        error: null,
        success:
          "Banner settings saved. The banner is on, rotating every 25 seconds.",
      });

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={25} />);
      await user.click(saveButton());

      await waitFor(() => {
        expect(saveButton()).toBeEnabled();
      });

      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByText(/banner settings saved/i)).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a validation refusal as an alert", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementSettingsAction.mockResolvedValue({
        error: "The rotation interval must be between 3 and 60 seconds.",
        success: null,
      });

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);
      await user.click(saveButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "The rotation interval must be between 3 and 60 seconds.",
      );
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows a database failure as a generic alert", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementSettingsAction.mockResolvedValue({
        error: "Banner settings could not be saved. Try again.",
        success: null,
      });

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);
      await user.click(saveButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "Banner settings could not be saved. Try again.",
      );
      // No driver detail is rendered, whatever went wrong underneath.
      expect(alert).not.toHaveTextContent(/relation|supabase|postgres/i);
    });

    it("shows the missing-row refusal rather than pretending the save worked", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementSettingsAction.mockResolvedValue({
        error:
          "The banner settings row is missing, so nothing was saved. Restore it before changing the banner.",
        success: null,
      });

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);
      await user.click(saveButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "banner settings row is missing",
      );
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("keeps edited values editable so a refused save can be corrected", async () => {
      const user = userEvent.setup();
      // A server-side refusal the browser cannot predict, so the submission
      // goes through and comes back rejected.
      mocks.updateAnnouncementSettingsAction.mockResolvedValue({
        error:
          "The banner settings row is missing, so nothing was saved. Restore it before changing the banner.",
        success: null,
      });

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      await user.clear(intervalInput());
      await user.type(intervalInput(), "45");
      await user.click(toggle());
      await user.click(saveButton());

      await screen.findByRole("alert");
      // The refusal must not discard what was typed, or the correction has to
      // be re-entered from scratch.
      expect(intervalInput()).toBeEnabled();
      expect(intervalInput()).toHaveValue(45);
      expect(toggle()).toBeEnabled();
      expect(toggle()).not.toBeChecked();
    });

    it("keeps the toggle showing what was actually saved", async () => {
      const user = userEvent.setup();
      mocks.updateAnnouncementSettingsAction.mockResolvedValue({
        error: null,
        success: "Banner settings saved. The banner is off.",
      });

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      await user.click(toggle());
      expect(toggle()).not.toBeChecked();

      await user.click(saveButton());
      await waitFor(() => {
        expect(toggle()).toBeEnabled();
      });

      // React resets the form element after an action completes, which moves
      // the checkbox DOM without moving React state. Left alone the toggle
      // would read "on" straight after saving the banner off — the displayed
      // state contradicting the stored one.
      expect(toggle()).not.toBeChecked();
    });

    it("lets the browser block an out-of-range value before any round trip", async () => {
      const user = userEvent.setup();

      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      await user.clear(intervalInput());
      await user.type(intervalInput(), "61");
      await user.click(saveButton());

      // max="60" fails constraint validation, so the form never submits. The
      // Server Action still revalidates independently for anything that does.
      expect(mocks.updateAnnouncementSettingsAction).not.toHaveBeenCalled();
    });
  });

  describe("scope", () => {
    it("offers only the two settings controls and a save button", async () => {
      render(<AnnouncementSettingsForm isEnabled rotationIntervalSeconds={10} />);

      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
      expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      // No announcement create, edit, delete, or reorder control in this phase.
      expect(screen.queryByRole("textbox")).toBeNull();
    });
  });
});
