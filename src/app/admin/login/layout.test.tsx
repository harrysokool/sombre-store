// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  signInAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/app/admin/actions", () => ({
  signInAdmin: mocks.signInAdmin,
}));

import AdminLoginLayout from "./layout";
import AdminLoginPage from "./page";

describe("admin login standalone layout", () => {
  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.getAdminUser.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("frames the sign-in card in a main landmark", () => {
    render(
      <AdminLoginLayout>
        <p>sign-in card</p>
      </AdminLoginLayout>,
    );

    expect(
      within(screen.getByRole("main")).getByText("sign-in card"),
    ).toBeInTheDocument();
  });

  it("renders neither storefront chrome nor the signed-in admin navigation", async () => {
    render(<AdminLoginLayout>{await AdminLoginPage()}</AdminLoginLayout>);

    expect(
      screen.getByRole("heading", { name: "Admin Sign In" }),
    ).toBeInTheDocument();

    // Public shell.
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sombre home" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).toBeNull();

    // Dashboard shell: nobody is signed in yet, so there is nothing to
    // navigate to and nothing to sign out of.
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Coupons" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull();
  });

  it("still offers the credential fields and submit control", async () => {
    render(<AdminLoginLayout>{await AdminLoginPage()}</AdminLoginLayout>);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });
});
