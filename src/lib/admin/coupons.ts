import "server-only";

import {
  normalizeCouponCode,
  CouponPreviewError,
} from "@/lib/checkout/coupon-quote";
import { parsePercentageToBasisPoints } from "@/lib/checkout/money";
import { getAdminUser } from "@/lib/supabase/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HONG_KONG_OFFSET_HOURS = 8;

export type AdminCouponListItem = {
  id: string;
  code_normalized: string;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_product_count: number;
};

export type AdminCoupon = Omit<
  AdminCouponListItem,
  "assigned_product_count"
>;

export type AdminCouponProduct = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
};

export type AdminCouponAssignment = {
  product_id: string;
  discount_percent: number | string;
  product_name: string;
  product_slug: string;
  product_price: number | string;
  is_active: boolean;
};

export type AdminCouponEditorData = {
  coupon: AdminCoupon;
  assignments: AdminCouponAssignment[];
  products: AdminCouponProduct[];
};

export type AdminCouponAssignmentInput = {
  productId: unknown;
  discountPercent: unknown;
};

export type AdminCouponSubmission = {
  code?: unknown;
  isActive: boolean;
  startsAt: unknown;
  expiresAt: unknown;
  assignments: readonly AdminCouponAssignmentInput[];
};

type ValidatedCouponSubmission = {
  normalizedCode: string | null;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  assignments: {
    productId: string;
    discountPercent: string;
  }[];
};

export type AdminCouponMutationResult =
  | { ok: true; couponId: string }
  | { ok: false; error: string };

async function assertAdmin() {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    throw new Error("Admin coupon data requested without an approved session.");
  }
}

function formatBasisPointsForDatabase(basisPoints: number) {
  const wholePart = Math.floor(basisPoints / 100);
  const fractionalPart = String(basisPoints % 100).padStart(2, "0");

  return `${wholePart}.${fractionalPart}`;
}

function formatHongKongDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

export function formatCouponDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? formatHongKongDateParts(date) : "";
}

function parseOptionalAdminDate(
  value: unknown,
  label: string,
):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: `${label} is not valid.` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  const match = ADMIN_DATE_PATTERN.exec(trimmed);

  if (!match) {
    return { ok: false, error: `${label} is not valid.` };
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - HONG_KONG_OFFSET_HOURS,
    Number(minute),
    Number(second),
  );
  const date = new Date(timestamp);
  const normalizedInput = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  if (
    !Number.isFinite(timestamp) ||
    formatHongKongDateParts(date) !== normalizedInput
  ) {
    return { ok: false, error: `${label} is not valid.` };
  }

  return { ok: true, value: date.toISOString() };
}

export function validateAdminCouponSubmission(
  input: AdminCouponSubmission,
  options: { requireCode: boolean },
):
  | { ok: true; value: ValidatedCouponSubmission }
  | { ok: false; error: string } {
  let normalizedCode: string | null = null;

  if (options.requireCode) {
    try {
      normalizedCode = normalizeCouponCode(input.code);
    } catch (error) {
      if (error instanceof CouponPreviewError) {
        return {
          ok: false,
          error:
            "Use 3–32 letters, numbers, hyphens, or underscores for the code.",
        };
      }

      return { ok: false, error: "The coupon code is not valid." };
    }
  }

  const startsAt = parseOptionalAdminDate(input.startsAt, "Start date");
  const expiresAt = parseOptionalAdminDate(input.expiresAt, "Expiry date");

  if (!startsAt.ok) {
    return startsAt;
  }

  if (!expiresAt.ok) {
    return expiresAt;
  }

  if (
    startsAt.value !== null &&
    expiresAt.value !== null &&
    Date.parse(expiresAt.value) <= Date.parse(startsAt.value)
  ) {
    return {
      ok: false,
      error: "Expiry must be later than the start date.",
    };
  }

  const productIds = new Set<string>();
  const assignments: ValidatedCouponSubmission["assignments"] = [];

  for (const assignment of input.assignments) {
    const productId =
      typeof assignment.productId === "string"
        ? assignment.productId.trim()
        : "";

    if (!UUID_PATTERN.test(productId) || productIds.has(productId)) {
      return {
        ok: false,
        error: "One of the selected products is not valid.",
      };
    }

    let basisPoints: number;

    try {
      basisPoints = parsePercentageToBasisPoints(
        typeof assignment.discountPercent === "string"
          ? assignment.discountPercent.trim()
          : "",
      );
    } catch {
      return {
        ok: false,
        error:
          "Each discount must be greater than 0 and no more than 100, with at most two decimal places.",
      };
    }

    productIds.add(productId);
    assignments.push({
      productId,
      discountPercent: formatBasisPointsForDatabase(basisPoints),
    });
  }

  return {
    ok: true,
    value: {
      normalizedCode,
      isActive: input.isActive,
      startsAt: startsAt.value,
      expiresAt: expiresAt.value,
      assignments,
    },
  };
}

async function validateActiveProducts(
  productIds: readonly string[],
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
) {
  if (productIds.length === 0) {
    return true;
  }

  const { data, error } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .eq("is_active", true)
    .returns<{ id: string }[]>();

  if (error) {
    console.error("Failed to validate coupon products", error);
    return null;
  }

  return (
    data?.length === productIds.length &&
    data.every((product) => productIds.includes(product.id))
  );
}

export async function listAdminCoupons(): Promise<AdminCouponListItem[]> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const [couponsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("discount_codes")
      .select(
        "id, code_normalized, is_active, starts_at, expires_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .returns<AdminCoupon[]>(),
    supabase
      .from("discount_code_products")
      .select("discount_code_id")
      .returns<{ discount_code_id: string }[]>(),
  ]);

  if (couponsResult.error || assignmentsResult.error) {
    throw new Error("Admin coupons could not be loaded.");
  }

  const assignmentCounts = new Map<string, number>();

  for (const assignment of assignmentsResult.data ?? []) {
    assignmentCounts.set(
      assignment.discount_code_id,
      (assignmentCounts.get(assignment.discount_code_id) ?? 0) + 1,
    );
  }

  return (couponsResult.data ?? []).map((coupon) => ({
    ...coupon,
    assigned_product_count: assignmentCounts.get(coupon.id) ?? 0,
  }));
}

export async function listAdminCouponProducts(): Promise<
  AdminCouponProduct[]
> {
  await assertAdmin();

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, price")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<AdminCouponProduct[]>();

  if (error) {
    throw new Error("Active products could not be loaded.");
  }

  return data ?? [];
}

export async function getAdminCoupon(
  couponId: string,
): Promise<AdminCouponEditorData | null> {
  await assertAdmin();

  if (!UUID_PATTERN.test(couponId)) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: coupon, error: couponError } = await supabase
    .from("discount_codes")
    .select(
      "id, code_normalized, is_active, starts_at, expires_at, created_at, updated_at",
    )
    .eq("id", couponId)
    .maybeSingle<AdminCoupon>();

  if (couponError) {
    throw new Error("Coupon details could not be loaded.");
  }

  if (!coupon) {
    return null;
  }

  const { data: rawAssignments, error: rawAssignmentsError } = await supabase
    .from("discount_code_products")
    .select("product_id, discount_percent")
    .eq("discount_code_id", coupon.id)
    .returns<{ product_id: string; discount_percent: number | string }[]>();

  if (rawAssignmentsError) {
    throw new Error("Coupon details could not be loaded.");
  }

  const assignedProductIds = (rawAssignments ?? []).map(
    (assignment) => assignment.product_id,
  );

  type AssignedProductRow = AdminCouponProduct & { is_active: boolean };

  const [activeProductsResult, assignedProductsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, price")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<AdminCouponProduct[]>(),
    assignedProductIds.length > 0
      ? supabase
          .from("products")
          .select("id, name, slug, price, is_active")
          .in("id", assignedProductIds)
          .returns<AssignedProductRow[]>()
      : Promise.resolve({ data: [] as AssignedProductRow[], error: null }),
  ]);

  if (activeProductsResult.error || assignedProductsResult.error) {
    throw new Error("Coupon details could not be loaded.");
  }

  // Assigned products are looked up without the is_active filter so a
  // product that has since gone inactive still has a name, slug, and price
  // to show on the edit page instead of silently disappearing from view.
  const assignedProductMap = new Map(
    (assignedProductsResult.data ?? []).map((product) => [
      product.id,
      product,
    ]),
  );

  const assignments: AdminCouponAssignment[] = (rawAssignments ?? [])
    .map((assignment) => {
      const product = assignedProductMap.get(assignment.product_id);

      // A cascading delete removes the assignment row along with its
      // product, so this only guards against an unexpected inconsistency
      // rather than a state this app can otherwise produce.
      if (!product) {
        return null;
      }

      return {
        product_id: assignment.product_id,
        discount_percent: assignment.discount_percent,
        product_name: product.name,
        product_slug: product.slug,
        product_price: product.price,
        is_active: product.is_active,
      };
    })
    .filter((assignment): assignment is AdminCouponAssignment =>
      assignment !== null,
    );

  return {
    coupon,
    assignments,
    products: activeProductsResult.data ?? [],
  };
}

export async function createAdminCoupon(
  input: AdminCouponSubmission,
): Promise<AdminCouponMutationResult> {
  await assertAdmin();

  const validated = validateAdminCouponSubmission(input, {
    requireCode: true,
  });

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const productIds = validated.value.assignments.map(
    (assignment) => assignment.productId,
  );
  const productsAreActive = await validateActiveProducts(productIds, supabase);

  if (productsAreActive === null) {
    return {
      ok: false,
      error: "Coupon products could not be validated. Try again.",
    };
  }

  if (!productsAreActive) {
    return {
      ok: false,
      error: "Only currently active products can be assigned to a coupon.",
    };
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("discount_codes")
    .select("id")
    .eq("code_normalized", validated.value.normalizedCode!)
    .maybeSingle<{ id: string }>();

  if (duplicateError) {
    console.error("Failed to check for a duplicate coupon", duplicateError);
    return {
      ok: false,
      error: "Coupon availability could not be checked. Try again.",
    };
  }

  if (duplicate) {
    return { ok: false, error: "A coupon with that code already exists." };
  }

  const { data: coupon, error: couponError } = await supabase
    .from("discount_codes")
    .insert({
      code_normalized: validated.value.normalizedCode!,
      is_active: validated.value.isActive,
      starts_at: validated.value.startsAt,
      expires_at: validated.value.expiresAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (couponError || !coupon) {
    if (couponError?.code === "23505") {
      return {
        ok: false,
        error: "A coupon with that code already exists.",
      };
    }

    console.error("Failed to create coupon", couponError);
    return {
      ok: false,
      error: "Coupon could not be created. Try again.",
    };
  }

  if (validated.value.assignments.length > 0) {
    const { error: assignmentsError } = await supabase
      .from("discount_code_products")
      .insert(
        validated.value.assignments.map((assignment) => ({
          discount_code_id: coupon.id,
          product_id: assignment.productId,
          discount_percent: assignment.discountPercent,
        })),
      )
      .select("product_id")
      .returns<{ product_id: string }[]>();

    if (assignmentsError) {
      console.error("Failed to create coupon assignments", assignmentsError);
      await supabase
        .from("discount_codes")
        .update({ is_active: false })
        .eq("id", coupon.id)
        .select("id")
        .maybeSingle<{ id: string }>();

      return {
        ok: false,
        error:
          "The coupon was saved inactive, but its products could not be assigned. Open it and try again.",
      };
    }
  }

  return { ok: true, couponId: coupon.id };
}

export async function updateAdminCoupon(
  couponId: string,
  input: AdminCouponSubmission,
): Promise<AdminCouponMutationResult> {
  await assertAdmin();

  if (!UUID_PATTERN.test(couponId)) {
    return { ok: false, error: "That coupon reference is not valid." };
  }

  const validated = validateAdminCouponSubmission(input, {
    requireCode: false,
  });

  if (!validated.ok) {
    return validated;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: coupon, error: couponLookupError } = await supabase
    .from("discount_codes")
    .select("id")
    .eq("id", couponId)
    .maybeSingle<{ id: string }>();

  if (couponLookupError) {
    console.error("Failed to load coupon before update", couponLookupError);
    return {
      ok: false,
      error: "Coupon could not be loaded. Try again.",
    };
  }

  if (!coupon) {
    return { ok: false, error: "That coupon no longer exists." };
  }

  const { data: existingAssignments, error: existingAssignmentsError } =
    await supabase
      .from("discount_code_products")
      .select("product_id")
      .eq("discount_code_id", couponId)
      .returns<{ product_id: string }[]>();

  if (existingAssignmentsError) {
    console.error(
      "Failed to load existing coupon assignments",
      existingAssignmentsError,
    );
    return {
      ok: false,
      error: "Coupon products could not be updated. Try again.",
    };
  }

  const existingProductIds = new Set(
    (existingAssignments ?? []).map((assignment) => assignment.product_id),
  );
  const productIds = validated.value.assignments.map(
    (assignment) => assignment.productId,
  );

  // An assignment that already existed is preserved even if its product has
  // since gone inactive, so saving an unrelated change (dates, active state)
  // never silently drops it. Only a genuinely new assignment has to point at
  // a currently active product.
  const newProductIds = productIds.filter(
    (productId) => !existingProductIds.has(productId),
  );
  const newProductsAreActive = await validateActiveProducts(
    newProductIds,
    supabase,
  );

  if (newProductsAreActive === null) {
    return {
      ok: false,
      error: "Coupon products could not be validated. Try again.",
    };
  }

  if (!newProductsAreActive) {
    return {
      ok: false,
      error: "Only currently active products can be assigned to a coupon.",
    };
  }

  if (validated.value.assignments.length > 0) {
    const { error: upsertError } = await supabase
      .from("discount_code_products")
      .upsert(
        validated.value.assignments.map((assignment) => ({
          discount_code_id: couponId,
          product_id: assignment.productId,
          discount_percent: assignment.discountPercent,
        })),
        { onConflict: "discount_code_id,product_id" },
      )
      .select("product_id")
      .returns<{ product_id: string }[]>();

    if (upsertError) {
      console.error("Failed to save coupon assignments", upsertError);
      return {
        ok: false,
        error: "Coupon products could not be updated. Try again.",
      };
    }
  }

  const removedProductIds = (existingAssignments ?? [])
    .map((assignment) => assignment.product_id)
    .filter((productId) => !productIds.includes(productId));

  if (removedProductIds.length > 0) {
    const { error: removeError } = await supabase
      .from("discount_code_products")
      .delete()
      .eq("discount_code_id", couponId)
      .in("product_id", removedProductIds)
      .select("product_id")
      .returns<{ product_id: string }[]>();

    if (removeError) {
      console.error("Failed to remove coupon assignments", removeError);
      return {
        ok: false,
        error: "Coupon products could not be updated. Try again.",
      };
    }
  }

  const { data: updatedCoupon, error: couponError } = await supabase
    .from("discount_codes")
    .update({
      is_active: validated.value.isActive,
      starts_at: validated.value.startsAt,
      expires_at: validated.value.expiresAt,
    })
    .eq("id", couponId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (couponError || !updatedCoupon) {
    console.error("Failed to update coupon", couponError);
    return {
      ok: false,
      error: "Coupon could not be updated. Try again.",
    };
  }

  return { ok: true, couponId };
}
