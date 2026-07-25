import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createSupabase: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin-auth", () => ({
  getAdminUser: mocks.getAdminUser,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: mocks.createSupabase,
}));

import { updateAdminCoupon } from "./coupons";

const COUPON_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_B = "33333333-3333-4333-8333-333333333333";
const INACTIVE_PRODUCT = "44444444-4444-4444-8444-444444444444";
const MISSING_PRODUCT = "55555555-5555-4555-8555-555555555555";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERCENT_PATTERN = /^[0-9]{1,3}(\.[0-9]{1,2})?$/;

type CouponRow = {
  id: string;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
};

type AssignmentRow = {
  product_id: string;
  discount_percent: string;
};

type DatabaseSnapshot = {
  coupon: CouponRow | null;
  assignments: AssignmentRow[];
};

type AssignmentInput = {
  product_id: unknown;
  discount_percent: unknown;
};

/**
 * A stand-in for `update_discount_code_with_assignments` that mirrors the
 * migration's rules, including the one that matters here: every write happens
 * against a draft copy, and the draft only replaces committed state if the
 * whole function reaches the end. A raise anywhere throws the draft away,
 * which is what the single-statement transaction does in Postgres.
 *
 * `failDuring` forces a write to blow up at a chosen point, which is how the
 * rollback tests below reproduce the original bug. Under the old code the
 * assignment upsert and delete were separate PostgREST requests, so a later
 * failure could not undo them; those tests fail against that implementation
 * and pass against this one.
 *
 * This proves the server code cannot produce a partial write and that the
 * transaction's contract is honoured end to end. It is not a substitute for
 * exercising the PL/pgSQL itself against a real Postgres.
 */
function createTransactionalFake(initial: {
  coupon?: CouponRow | null;
  assignments?: AssignmentRow[];
  products?: Record<string, boolean>;
}) {
  const products = new Map(
    Object.entries(
      initial.products ?? {
        [PRODUCT_A]: true,
        [PRODUCT_B]: true,
        [INACTIVE_PRODUCT]: false,
      },
    ),
  );

  let committed: DatabaseSnapshot = {
    coupon:
      initial.coupon === undefined
        ? {
            id: COUPON_ID,
            is_active: true,
            starts_at: null,
            expires_at: null,
          }
        : initial.coupon && { ...initial.coupon },
    assignments: (initial.assignments ?? []).map((row) => ({ ...row })),
  };

  let failDuring: "assignments" | "coupon" | null = null;

  function applyInTransaction(
    draft: DatabaseSnapshot,
    params: Record<string, unknown>,
  ) {
    const submitted = (params.p_assignments ?? []) as AssignmentInput[];
    const startsAt = (params.p_starts_at ?? null) as string | null;
    const expiresAt = (params.p_expires_at ?? null) as string | null;

    // Validation first, exactly as the RPC orders it. Nothing below this
    // block has written anything yet, so a refusal is inherently clean.
    const malformed = submitted.some(
      (assignment) =>
        typeof assignment?.product_id !== "string" ||
        !UUID_PATTERN.test(assignment.product_id) ||
        typeof assignment?.discount_percent !== "string" ||
        !PERCENT_PATTERN.test(assignment.discount_percent) ||
        Number(assignment.discount_percent) <= 0 ||
        Number(assignment.discount_percent) > 100,
    );

    if (malformed) {
      return { ok: false, reason: "invalid_assignments" };
    }

    const submittedIds = submitted.map(
      (assignment) => assignment.product_id as string,
    );

    if (new Set(submittedIds).size !== submittedIds.length) {
      return { ok: false, reason: "duplicate_product" };
    }

    if (
      startsAt &&
      expiresAt &&
      Date.parse(expiresAt) <= Date.parse(startsAt)
    ) {
      return { ok: false, reason: "invalid_date_range" };
    }

    if (!draft.coupon) {
      return { ok: false, reason: "not_found" };
    }

    // Only a genuinely new assignment has to point at an active product.
    const existingIds = new Set(
      draft.assignments.map((row) => row.product_id),
    );
    const addedIds = submittedIds.filter((id) => !existingIds.has(id));
    const unknownIds = addedIds.filter((id) => !products.has(id));

    if (unknownIds.length > 0) {
      return { ok: false, reason: "unknown_product", product_ids: unknownIds };
    }

    const inactiveIds = addedIds.filter((id) => products.get(id) === false);

    if (inactiveIds.length > 0) {
      return {
        ok: false,
        reason: "inactive_product",
        product_ids: inactiveIds,
      };
    }

    // Writes begin here.

    // Insert new rows, update changed ones. Keyed on
    // (discount_code_id, product_id), which is the table's primary key, so a
    // resubmitted save lands on the same row instead of duplicating it.
    for (const assignment of submitted) {
      const existing = draft.assignments.find(
        (row) => row.product_id === assignment.product_id,
      );

      if (existing) {
        existing.discount_percent = assignment.discount_percent as string;
      } else {
        draft.assignments.push({
          product_id: assignment.product_id as string,
          discount_percent: assignment.discount_percent as string,
        });
      }
    }

    // Deliberately placed between the two assignment writes, which is where
    // the original code was at its most exposed: the upsert had committed in
    // its own request and the delete had not run yet.
    if (failDuring === "assignments") {
      throw new Error("forced failure during assignment changes");
    }

    const removedCount = draft.assignments.length;

    draft.assignments = draft.assignments.filter((row) =>
      submittedIds.includes(row.product_id),
    );

    if (failDuring === "coupon") {
      throw new Error("forced failure during the coupon update");
    }

    draft.coupon = {
      ...draft.coupon,
      is_active: params.p_is_active as boolean,
      starts_at: startsAt,
      expires_at: expiresAt,
    };

    return {
      ok: true,
      coupon_id: draft.coupon.id,
      assigned_product_count: draft.assignments.length,
      removed_product_count: removedCount - draft.assignments.length,
    };
  }

  const client = {
    from: vi.fn(() => {
      throw new Error(
        "A coupon edit must not issue table requests alongside the RPC.",
      );
    }),
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => {
      if (name !== "update_discount_code_with_assignments") {
        throw new Error(`Unexpected RPC ${name}.`);
      }

      const draft: DatabaseSnapshot = {
        coupon: committed.coupon && { ...committed.coupon },
        assignments: committed.assignments.map((row) => ({ ...row })),
      };

      let result: ReturnType<typeof applyInTransaction>;

      try {
        result = applyInTransaction(draft, params);
      } catch (error) {
        // Rolled back: the draft is discarded and committed state is
        // untouched, however far through the writes the failure happened.
        return {
          data: null,
          error: { message: (error as Error).message, code: "XX000" },
        };
      }

      if (result.ok) {
        committed = draft;
      }

      return { data: result, error: null };
    }),
  };

  mocks.createSupabase.mockReturnValue(client);

  return {
    client,
    failDuring(stage: "assignments" | "coupon" | null) {
      failDuring = stage;
    },
    snapshot(): DatabaseSnapshot {
      return {
        coupon: committed.coupon && { ...committed.coupon },
        assignments: committed.assignments
          .map((row) => ({ ...row }))
          .sort((left, right) =>
            left.product_id.localeCompare(right.product_id),
          ),
      };
    },
  };
}

function submission(
  overrides: Partial<Parameters<typeof updateAdminCoupon>[1]> = {},
) {
  return {
    code: undefined,
    isActive: true,
    startsAt: "",
    expiresAt: "",
    assignments: [],
    ...overrides,
  };
}

const ACTIVE_COUPON: CouponRow = {
  id: COUPON_ID,
  is_active: true,
  starts_at: null,
  expires_at: null,
};

describe("atomic coupon updates", () => {
  // Several tests force a write to fail on purpose, which the data layer
  // logs. Silenced so a deliberate failure does not look like a broken run.
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.getAdminUser.mockReset();
    mocks.createSupabase.mockReset();
    mocks.getAdminUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
    });
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("commits coupon fields and assignment percentages together", async () => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: false,
          startsAt: "2026-08-01T09:00:00",
          expiresAt: "2026-08-02T09:00:00",
          assignments: [{ productId: PRODUCT_A, discountPercent: "35" }],
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    expect(database.snapshot()).toEqual({
      coupon: {
        id: COUPON_ID,
        is_active: false,
        starts_at: "2026-08-01T01:00:00.000Z",
        expires_at: "2026-08-02T01:00:00.000Z",
      },
      assignments: [{ product_id: PRODUCT_A, discount_percent: "35.00" }],
    });
    expect(database.client.rpc).toHaveBeenCalledTimes(1);
  });

  it("adds an assignment and updates the coupon in the same transaction", async () => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: false,
          assignments: [
            { productId: PRODUCT_A, discountPercent: "20.00" },
            { productId: PRODUCT_B, discountPercent: "5.25" },
          ],
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    expect(database.snapshot()).toEqual({
      coupon: { ...ACTIVE_COUPON, is_active: false },
      assignments: [
        { product_id: PRODUCT_A, discount_percent: "20.00" },
        { product_id: PRODUCT_B, discount_percent: "5.25" },
      ],
    });
    expect(database.client.rpc).toHaveBeenCalledTimes(1);
  });

  it("removes an assignment and updates the coupon in the same transaction", async () => {
    const database = createTransactionalFake({
      coupon: { ...ACTIVE_COUPON, is_active: false },
      assignments: [
        { product_id: PRODUCT_A, discount_percent: "20.00" },
        { product_id: PRODUCT_B, discount_percent: "5.25" },
      ],
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: true,
          // PRODUCT_B is simply omitted, which is how the form expresses a
          // removal.
          assignments: [{ productId: PRODUCT_A, discountPercent: "20.00" }],
        }),
      ),
    ).resolves.toEqual({ ok: true, couponId: COUPON_ID });

    expect(database.snapshot()).toEqual({
      coupon: { ...ACTIVE_COUPON, is_active: true },
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
  });

  it("leaves the coupon and its assignments untouched when the assignment write fails", async () => {
    const before: DatabaseSnapshot = {
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    };
    const database = createTransactionalFake(before);
    database.failDuring("assignments");

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: false,
          startsAt: "2026-08-01T09:00:00",
          assignments: [
            { productId: PRODUCT_A, discountPercent: "99.00" },
            { productId: PRODUCT_B, discountPercent: "5.25" },
          ],
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "Coupon could not be updated. No changes were saved. Try again.",
    });

    // The reported failure is now truthful: the coupon still has its original
    // active state and dates, and no percentage moved.
    expect(database.snapshot()).toEqual({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
  });

  it("leaves every assignment untouched when the coupon write fails", async () => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [
        { product_id: PRODUCT_A, discount_percent: "20.00" },
        { product_id: PRODUCT_B, discount_percent: "5.25" },
      ],
    });
    // The original bug in one test: assignment writes had already committed
    // by the time the coupon update ran, so a failure here changed live
    // discounts while telling the admin the save failed.
    database.failDuring("coupon");

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: false,
          assignments: [
            // A changed percentage, plus PRODUCT_B dropped entirely.
            { productId: PRODUCT_A, discountPercent: "40.00" },
          ],
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "Coupon could not be updated. No changes were saved. Try again.",
    });

    expect(database.snapshot()).toEqual({
      coupon: ACTIVE_COUPON,
      assignments: [
        { product_id: PRODUCT_A, discount_percent: "20.00" },
        { product_id: PRODUCT_B, discount_percent: "5.25" },
      ],
    });
  });

  it.each([
    ["a product that does not exist", MISSING_PRODUCT],
    ["a product that is no longer active", INACTIVE_PRODUCT],
    ["a value that is not a product id", "not-a-uuid"],
  ])("refuses %s without changing anything", async (_label, productId) => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });

    const result = await updateAdminCoupon(
      COUPON_ID,
      submission({
        isActive: false,
        assignments: [
          { productId: PRODUCT_A, discountPercent: "44.00" },
          { productId, discountPercent: "10.00" },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    // Refusals are raised before the first write, so the valid half of the
    // submission is not saved either.
    expect(database.snapshot()).toEqual({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
  });

  it("does not duplicate assignments when the same edit is submitted twice", async () => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
    const input = submission({
      isActive: false,
      assignments: [
        { productId: PRODUCT_A, discountPercent: "20.00" },
        { productId: PRODUCT_B, discountPercent: "5.25" },
      ],
    });

    await expect(updateAdminCoupon(COUPON_ID, input)).resolves.toEqual({
      ok: true,
      couponId: COUPON_ID,
    });

    const afterFirstSave = database.snapshot();

    await expect(updateAdminCoupon(COUPON_ID, input)).resolves.toEqual({
      ok: true,
      couponId: COUPON_ID,
    });

    // A retried save — a double submit, or an admin re-clicking after a
    // network hiccup — lands on the same two rows.
    expect(database.snapshot()).toEqual(afterFirstSave);
    expect(database.snapshot().assignments).toHaveLength(2);
  });

  it("rejects a duplicated product in a single submission before any write", async () => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: false,
          assignments: [
            { productId: PRODUCT_A, discountPercent: "20.00" },
            { productId: PRODUCT_A, discountPercent: "90.00" },
          ],
        }),
      ),
    ).resolves.toMatchObject({ ok: false });

    expect(database.snapshot()).toEqual({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
  });

  it("refuses a coupon that no longer exists without writing assignments", async () => {
    const database = createTransactionalFake({
      coupon: null,
      assignments: [],
    });

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          assignments: [{ productId: PRODUCT_A, discountPercent: "20.00" }],
        }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "That coupon no longer exists.",
    });

    expect(database.snapshot()).toEqual({ coupon: null, assignments: [] });
  });

  it("blocks a caller without an admin session before touching the database", async () => {
    const database = createTransactionalFake({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(
      updateAdminCoupon(
        COUPON_ID,
        submission({
          isActive: false,
          assignments: [{ productId: PRODUCT_A, discountPercent: "90.00" }],
        }),
      ),
    ).rejects.toThrow("without an approved session");

    // Fails closed: no service-role client is even created, so the RPC is
    // unreachable and nothing changed.
    expect(mocks.createSupabase).not.toHaveBeenCalled();
    expect(database.client.rpc).not.toHaveBeenCalled();
    expect(database.snapshot()).toEqual({
      coupon: ACTIVE_COUPON,
      assignments: [{ product_id: PRODUCT_A, discount_percent: "20.00" }],
    });
  });
});
