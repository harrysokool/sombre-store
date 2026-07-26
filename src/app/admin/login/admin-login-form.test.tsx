// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInAdmin: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({
  signInAdmin: mocks.signInAdmin,
}));

import { AdminLoginForm } from "./admin-login-form";

function submit() {
  fireEvent.submit(document.querySelector("form")!);
}

describe("admin login form accessibility", () => {
  beforeEach(() => {
    mocks.signInAdmin.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the fields free of error wiring before any submission", () => {
    render(<AdminLoginForm />);

    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText("Password")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces a failed login and marks both fields invalid", async () => {
    mocks.signInAdmin.mockResolvedValue({
      error: "Invalid email or password.",
    });
    const user = userEvent.setup();

    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password.");
    expect(alert.id).toBeTruthy();

    const emailField = screen.getByLabelText("Email");
    const passwordField = screen.getByLabelText("Password");

    expect(emailField).toHaveAttribute("aria-invalid", "true");
    expect(passwordField).toHaveAttribute("aria-invalid", "true");
    expect(emailField).toHaveAttribute("aria-describedby", alert.id);
    expect(passwordField).toHaveAttribute("aria-describedby", alert.id);
  });

  it("clears the invalid state once a retry succeeds", async () => {
    mocks.signInAdmin
      .mockResolvedValueOnce({ error: "Invalid email or password." })
      .mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();

    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    submit();

    const alert = await screen.findByRole("alert");

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "correct-password");
    submit();

    await waitForElementToBeRemoved(alert);

    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText("Password")).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText("Email")).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByLabelText("Password")).not.toHaveAttribute(
      "aria-describedby",
    );
  });
});
