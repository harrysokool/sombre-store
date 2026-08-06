import { afterEach, describe, expect, it, vi } from "vitest";

// vitest runs this file in a genuine server-side Node context, but its module
// resolution doesn't set Next.js's "react-server" bundler condition, so the
// real "server-only" package would otherwise throw on every import here. Stub
// it to a no-op so this file's own env-var validation logic is what's tested.
vi.mock("server-only", () => ({}));

async function importStripeServer(secretKey?: string) {
  vi.resetModules();

  if (secretKey === undefined) {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    vi.stubEnv("STRIPE_SECRET_KEY", secretKey);
  }

  return import("./server");
}

describe("Stripe server sandbox enforcement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects a missing Stripe secret key", async () => {
    await expect(importStripeServer()).rejects.toThrow(
      "Missing Stripe environment variable",
    );
  });

  it("accepts a test Stripe secret key", async () => {
    const stripeServer = await importStripeServer(
      "sk_test_sombrePrelaunchOnly",
    );

    expect(stripeServer.stripe).toBeDefined();
  });

  it("rejects a live Stripe secret key without exposing it", async () => {
    const liveSecretKey = "sk_live_sombreMustNeverCharge";

    await expect(importStripeServer(liveSecretKey)).rejects.toThrow(
      "Live Stripe secret keys are not permitted during prelaunch",
    );

    try {
      await importStripeServer(liveSecretKey);
    } catch (error) {
      expect(String(error)).not.toContain(liveSecretKey);
    }
  });

  it("rejects an invalid Stripe secret key", async () => {
    await expect(
      importStripeServer("not-a-stripe-secret-key"),
    ).rejects.toThrow("Invalid STRIPE_SECRET_KEY");
  });
});
