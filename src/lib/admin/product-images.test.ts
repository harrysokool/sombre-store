import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({
    supabaseUrl: "https://abcdefghijklmnop.supabase.co",
    supabaseAnonKey: "anon-key",
  }),
}));

import {
  isSombreStorageImageUrl,
  isValidStorageObjectPath,
  MAX_PRODUCT_IMAGE_BYTES,
} from "./product-image-storage";
import {
  addAdminProductImage,
  listAdminProductImages,
  moveAdminProductImage,
  removeAdminProductImage,
  setAdminPrimaryProductImage,
  updateAdminProductImageAltText,
  uploadAdminProductImage,
} from "./product-images";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const IMAGE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IMAGE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IMAGE_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

/**
 * One PostgREST query builder.
 *
 * The builder is thenable because the data layer awaits several statements
 * directly — an update or delete that selects nothing back is finished at the
 * last `.eq()`, with no `.maybeSingle()` to await.
 */
function query(result: QueryResult = {}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {};

  for (const method of [
    "select",
    "eq",
    "neq",
    "order",
    "insert",
    "update",
    "delete",
  ]) {
    builder[method] = vi.fn(() => builder);
  }

  builder.returns = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);
  builder.then = (
    onFulfilled?: (value: typeof resolved) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled, onRejected);

  return builder;
}

/**
 * Hands out one builder per query in call order, which is how an operation's
 * sequence of statements is asserted.
 */
/** How the Storage side of the mocked client should behave. */
type StorageBehavior = {
  upload?: { error?: unknown };
  remove?: { error?: unknown; throws?: boolean };
};

function supabaseWith(results: QueryResult[], storage: StorageBehavior = {}) {
  const builders = results.map(query);
  let index = 0;

  const upload = vi.fn(async (
    _objectPath: string,
    _body: Uint8Array,
    _options: { contentType: string; upsert: boolean },
  ) => ({
    data: storage.upload?.error ? null : { path: "uploaded" },
    error: storage.upload?.error ?? null,
  }));

  const remove = vi.fn(async (_objectPaths: string[]) => {
    if (storage.remove?.throws) {
      throw new Error("Storage is unreachable.");
    }

    return { data: null, error: storage.remove?.error ?? null };
  });

  const storageFrom = vi.fn(() => ({ upload, remove }));

  const client = {
    from: vi.fn((table: string) => {
      const next = builders[index++];

      if (!next) {
        throw new Error(
          `Unexpected Supabase query #${index} on "${table}".`,
        );
      }

      return next;
    }),
    storage: { from: storageFrom },
  };

  mocks.createSupabase.mockReturnValue(client);

  return { client, builders, upload, remove, storageFrom };
}

/** n queries that all succeed and return nothing. */
function successes(count: number): QueryResult[] {
  return Array.from({ length: count }, () => ({}));
}

/** Every update issued, paired with the filters that targeted it. */
function updates(builders: ReturnType<typeof query>[]) {
  return builders
    .filter((builder) => builder.update.mock.calls.length > 0)
    .map((builder) => ({
      values: builder.update.mock.calls[0][0] as Record<string, unknown>,
      filters: Object.fromEntries(
        builder.eq.mock.calls as [string, unknown][],
      ),
    }));
}

function row(
  id: string,
  sortOrder: number,
  isPrimary = false,
  imageUrl = `/images/products/${id}.jpg`,
) {
  return {
    id,
    image_url: imageUrl,
    alt_text: null,
    sort_order: sortOrder,
    is_primary: isPrimary,
  };
}

// Deliberately out of sort order, so any test relying on the list order is
// relying on the sorting rather than on the row order the database returned.
const THREE_IMAGES = [
  row(IMAGE_C, 2),
  row(IMAGE_A, 0, true),
  row(IMAGE_B, 1),
];

beforeEach(() => {
  mocks.getAdminUser.mockReset();
  mocks.createSupabase.mockReset();
  mocks.getAdminUser.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
  });
  // Re-spying on an already-spied method reuses the existing spy without
  // clearing it, so a message logged by one test would otherwise still be
  // visible to the next.
  vi.spyOn(console, "error").mockImplementation(() => {}).mockClear();
});

describe("authorization", () => {
  const operations: [string, () => Promise<unknown>][] = [
    ["listAdminProductImages", () => listAdminProductImages(PRODUCT_ID)],
    [
      "addAdminProductImage",
      () =>
        addAdminProductImage(PRODUCT_ID, {
          imageUrl: "/images/products/a.jpg",
          altText: "",
        }),
    ],
    [
      "updateAdminProductImageAltText",
      () => updateAdminProductImageAltText(PRODUCT_ID, IMAGE_A, "Alt"),
    ],
    [
      "setAdminPrimaryProductImage",
      () => setAdminPrimaryProductImage(PRODUCT_ID, IMAGE_A),
    ],
    [
      "moveAdminProductImage",
      () => moveAdminProductImage(PRODUCT_ID, IMAGE_A, "up"),
    ],
    [
      "removeAdminProductImage",
      () => removeAdminProductImage(PRODUCT_ID, IMAGE_A),
    ],
    [
      "uploadAdminProductImage",
      () =>
        uploadAdminProductImage(PRODUCT_ID, {
          file: new File([JPEG_BYTES], "photo.jpg", { type: "image/jpeg" }),
          altText: "",
        }),
    ],
  ];

  it.each(operations)("refuses %s without an approved session", async (
    _name,
    run,
  ) => {
    mocks.getAdminUser.mockResolvedValue(null);

    await expect(run()).rejects.toThrow(
      "Admin product image data requested without an approved session.",
    );
    // The gate is checked before any client is built, so an unapproved caller
    // never reaches the service-role key at all.
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });
});

describe("listAdminProductImages", () => {
  it("returns the images in storefront display order", async () => {
    const { builders } = supabaseWith([{ data: THREE_IMAGES }]);

    await expect(listAdminProductImages(PRODUCT_ID)).resolves.toEqual([
      {
        id: IMAGE_A,
        imageUrl: `/images/products/${IMAGE_A}.jpg`,
        altText: "",
        sortOrder: 0,
        isPrimary: true,
      },
      {
        id: IMAGE_B,
        imageUrl: `/images/products/${IMAGE_B}.jpg`,
        altText: "",
        sortOrder: 1,
        isPrimary: false,
      },
      {
        id: IMAGE_C,
        imageUrl: `/images/products/${IMAGE_C}.jpg`,
        altText: "",
        sortOrder: 2,
        isPrimary: false,
      },
    ]);
    // Scoped to the product, which is what keeps another product's images out.
    expect(builders[0].eq).toHaveBeenCalledWith("product_id", PRODUCT_ID);
  });

  it("returns nothing for a malformed product reference", async () => {
    supabaseWith([]);

    await expect(listAdminProductImages("not-a-uuid")).resolves.toEqual([]);
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("throws when the images cannot be read", async () => {
    supabaseWith([{ error: { message: "boom" } }]);

    await expect(listAdminProductImages(PRODUCT_ID)).rejects.toThrow(
      "Product images could not be loaded.",
    );
  });
});

describe("addAdminProductImage", () => {
  it("appends after the highest existing position", async () => {
    const { builders } = supabaseWith([{ data: THREE_IMAGES }, {}]);

    await expect(
      addAdminProductImage(PRODUCT_ID, {
        imageUrl: "/images/products/d.jpg",
        altText: "A bottle",
      }),
    ).resolves.toEqual({ ok: true });

    expect(builders[1].insert).toHaveBeenCalledWith({
      product_id: PRODUCT_ID,
      image_url: "/images/products/d.jpg",
      alt_text: "A bottle",
      sort_order: 3,
      is_primary: false,
    });
  });

  it("makes the first image of a product its primary", async () => {
    // Otherwise a product could have images but nothing to lead with.
    const { builders } = supabaseWith([{ data: [] }, {}]);

    await addAdminProductImage(PRODUCT_ID, {
      imageUrl: "/images/products/a.jpg",
      altText: "",
    });

    expect(builders[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0, is_primary: true }),
    );
  });

  it("leaves a gap in a legacy sequence alone rather than colliding", async () => {
    const { builders } = supabaseWith([
      { data: [row(IMAGE_A, 0, true), row(IMAGE_B, 5)] },
      {},
    ]);

    await addAdminProductImage(PRODUCT_ID, {
      imageUrl: "/images/products/c.jpg",
      altText: "",
    });

    expect(builders[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 6 }),
    );
  });

  it("refuses an empty path without touching the database", async () => {
    supabaseWith([]);

    await expect(
      addAdminProductImage(PRODUCT_ID, { imageUrl: "  ", altText: "" }),
    ).resolves.toEqual({ ok: false, error: "Enter an image path." });
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("refuses a remote URL", async () => {
    supabaseWith([]);

    const result = await addAdminProductImage(PRODUCT_ID, {
      imageUrl: "https://cdn.example.com/x.jpg",
      altText: "",
    });

    expect(result).toMatchObject({ ok: false });
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("reports a conflict when the position was taken meanwhile", async () => {
    supabaseWith([
      { data: THREE_IMAGES },
      { error: { code: "23505" } },
    ]);

    await expect(
      addAdminProductImage(PRODUCT_ID, {
        imageUrl: "/images/products/d.jpg",
        altText: "",
      }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("hides database detail behind one generic message", async () => {
    supabaseWith([
      { data: THREE_IMAGES },
      { error: { code: "42501", message: "permission denied" } },
    ]);

    const result = await addAdminProductImage(PRODUCT_ID, {
      imageUrl: "/images/products/d.jpg",
      altText: "",
    });

    expect(result).toEqual({
      ok: false,
      error: "Image could not be added. Try again.",
    });
    if (result.ok) {
      throw new Error("Expected the add to fail.");
    }
    expect(result.error).not.toContain("permission denied");
    expect(console.error).toHaveBeenCalledWith(
      "Failed to add product image",
      expect.objectContaining({ code: "42501" }),
    );
  });
});

describe("updateAdminProductImageAltText", () => {
  it("saves trimmed alt text scoped to both ids", async () => {
    const { builders } = supabaseWith([{ data: { id: IMAGE_A } }]);

    await expect(
      updateAdminProductImageAltText(PRODUCT_ID, IMAGE_A, "  A bottle  "),
    ).resolves.toEqual({ ok: true });

    expect(builders[0].update).toHaveBeenCalledWith({
      alt_text: "A bottle",
    });
    // Both filters together are the ownership check.
    expect(builders[0].eq).toHaveBeenCalledWith("id", IMAGE_A);
    expect(builders[0].eq).toHaveBeenCalledWith("product_id", PRODUCT_ID);
  });

  it("clears alt text to null when emptied", async () => {
    const { builders } = supabaseWith([{ data: { id: IMAGE_A } }]);

    await updateAdminProductImageAltText(PRODUCT_ID, IMAGE_A, "   ");

    expect(builders[0].update).toHaveBeenCalledWith({ alt_text: null });
  });

  it("refuses an image belonging to another product", async () => {
    // Scoped to both ids, so a mismatched pair matches no row at all.
    supabaseWith([{ data: null }]);

    await expect(
      updateAdminProductImageAltText(OTHER_PRODUCT_ID, IMAGE_A, "Alt"),
    ).resolves.toEqual({
      ok: false,
      error:
        "That image is not part of this product. Reload the page and try again.",
    });
  });

  it("refuses a malformed image reference without querying", async () => {
    supabaseWith([]);

    await expect(
      updateAdminProductImageAltText(PRODUCT_ID, "not-a-uuid", "Alt"),
    ).resolves.toMatchObject({ ok: false });
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("hides database detail behind one generic message", async () => {
    supabaseWith([{ error: { code: "42501", message: "permission denied" } }]);

    const result = await updateAdminProductImageAltText(
      PRODUCT_ID,
      IMAGE_A,
      "Alt",
    );

    expect(result).toEqual({
      ok: false,
      error: "Alt text could not be saved. Try again.",
    });
  });
});

describe("setAdminPrimaryProductImage", () => {
  it("clears the old primary before setting the new one", async () => {
    // A partial unique index allows one is_primary row per product, so both
    // cannot be true at the same instant.
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      {},
      {},
    ]);

    await expect(
      setAdminPrimaryProductImage(PRODUCT_ID, IMAGE_B),
    ).resolves.toEqual({ ok: true });

    expect(updates(builders)).toEqual([
      {
        values: { is_primary: false },
        filters: { product_id: PRODUCT_ID, is_primary: true },
      },
      {
        values: { is_primary: true },
        filters: { id: IMAGE_B, product_id: PRODUCT_ID },
      },
    ]);
  });

  it("leaves exactly one primary after the change", async () => {
    const { builders } = supabaseWith([{ data: THREE_IMAGES }, {}, {}]);

    await setAdminPrimaryProductImage(PRODUCT_ID, IMAGE_B);

    const written = updates(builders);
    const setTrue = written.filter((call) => call.values.is_primary === true);

    expect(setTrue).toHaveLength(1);
    expect(setTrue[0].filters.id).toBe(IMAGE_B);
  });

  it("does nothing when the image is already primary", async () => {
    const { builders } = supabaseWith([{ data: THREE_IMAGES }]);

    await expect(
      setAdminPrimaryProductImage(PRODUCT_ID, IMAGE_A),
    ).resolves.toEqual({ ok: true });
    expect(updates(builders)).toEqual([]);
  });

  it("refuses an image belonging to another product", async () => {
    supabaseWith([{ data: THREE_IMAGES }]);

    await expect(
      setAdminPrimaryProductImage(PRODUCT_ID, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
    ).resolves.toMatchObject({ ok: false });
  });

  it("reports a failure when the clear step fails", async () => {
    supabaseWith([
      { data: THREE_IMAGES },
      { error: { message: "boom" } },
    ]);

    await expect(
      setAdminPrimaryProductImage(PRODUCT_ID, IMAGE_B),
    ).resolves.toEqual({
      ok: false,
      error: "Primary image could not be changed. Try again.",
    });
  });
});

describe("moveAdminProductImage", () => {
  it("moves an image up and rewrites a clean sequence", async () => {
    // Two passes over three rows: park above the maximum, then land on 0..n-1.
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      ...successes(6),
    ]);

    await expect(
      moveAdminProductImage(PRODUCT_ID, IMAGE_B, "up"),
    ).resolves.toEqual({ ok: true });

    const written = updates(builders);

    // First pass parks every row above the current maximum of 2.
    expect(written.slice(0, 3)).toEqual([
      { values: { sort_order: 3 }, filters: { id: IMAGE_B, product_id: PRODUCT_ID } },
      { values: { sort_order: 4 }, filters: { id: IMAGE_A, product_id: PRODUCT_ID } },
      { values: { sort_order: 5 }, filters: { id: IMAGE_C, product_id: PRODUCT_ID } },
    ]);
    // Second pass lands the final order.
    expect(written.slice(3)).toEqual([
      { values: { sort_order: 0 }, filters: { id: IMAGE_B, product_id: PRODUCT_ID } },
      { values: { sort_order: 1 }, filters: { id: IMAGE_A, product_id: PRODUCT_ID } },
      { values: { sort_order: 2 }, filters: { id: IMAGE_C, product_id: PRODUCT_ID } },
    ]);
  });

  it("never assigns a position still held by another row", async () => {
    // The whole point of the parking pass: (product_id, sort_order) is unique
    // and each row is updated by its own statement.
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      ...successes(6),
    ]);

    await moveAdminProductImage(PRODUCT_ID, IMAGE_B, "up");

    const held = new Map(THREE_IMAGES.map((image) => [image.id, image.sort_order]));

    for (const { values, filters } of updates(builders)) {
      const next = values.sort_order as number;
      const owner = [...held.entries()].find(([, order]) => order === next);

      expect(owner?.[0] ?? filters.id).toBe(filters.id);
      held.set(filters.id as string, next);
    }
  });

  it("moves an image down", async () => {
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      ...successes(6),
    ]);

    await moveAdminProductImage(PRODUCT_ID, IMAGE_B, "down");

    expect(updates(builders).slice(3)).toEqual([
      { values: { sort_order: 0 }, filters: { id: IMAGE_A, product_id: PRODUCT_ID } },
      { values: { sort_order: 1 }, filters: { id: IMAGE_C, product_id: PRODUCT_ID } },
      { values: { sort_order: 2 }, filters: { id: IMAGE_B, product_id: PRODUCT_ID } },
    ]);
  });

  it("leaves the order alone when the first image is moved up", async () => {
    const { builders } = supabaseWith([{ data: THREE_IMAGES }]);

    await expect(
      moveAdminProductImage(PRODUCT_ID, IMAGE_A, "up"),
    ).resolves.toEqual({ ok: true });
    expect(updates(builders)).toEqual([]);
  });

  it("leaves the order alone when the last image is moved down", async () => {
    const { builders } = supabaseWith([{ data: THREE_IMAGES }]);

    await expect(
      moveAdminProductImage(PRODUCT_ID, IMAGE_C, "down"),
    ).resolves.toEqual({ ok: true });
    expect(updates(builders)).toEqual([]);
  });

  it("refuses an unrecognised direction without querying", async () => {
    supabaseWith([]);

    await expect(
      moveAdminProductImage(PRODUCT_ID, IMAGE_A, "sideways"),
    ).resolves.toEqual({
      ok: false,
      error: "That move direction is not recognised.",
    });
    expect(mocks.createSupabase).not.toHaveBeenCalled();
  });

  it("refuses an image belonging to another product", async () => {
    supabaseWith([{ data: THREE_IMAGES }]);

    await expect(
      moveAdminProductImage(
        PRODUCT_ID,
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "up",
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("reports a failure when a reorder statement fails", async () => {
    supabaseWith([
      { data: THREE_IMAGES },
      {},
      { error: { message: "boom" } },
    ]);

    await expect(
      moveAdminProductImage(PRODUCT_ID, IMAGE_B, "up"),
    ).resolves.toEqual({
      ok: false,
      error: "Image order could not be saved. Try again.",
    });
  });
});

describe("removeAdminProductImage", () => {
  it("deletes only that image row, scoped to the product", async () => {
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      {},
      ...successes(4),
    ]);

    await expect(
      removeAdminProductImage(PRODUCT_ID, IMAGE_B),
    ).resolves.toEqual({ ok: true });

    expect(builders[1].delete).toHaveBeenCalled();
    expect(builders[1].eq).toHaveBeenCalledWith("id", IMAGE_B);
    expect(builders[1].eq).toHaveBeenCalledWith("product_id", PRODUCT_ID);
    // The product itself is never touched: the cascade runs the other way.
    expect(builders.every((builder) => builder.delete.mock.calls.length <= 1)).toBe(
      true,
    );
    expect(
      builders[1].delete.mock.calls.length +
        builders.slice(2).reduce((n, b) => n + b.delete.mock.calls.length, 0),
    ).toBe(1);
  });

  it("normalizes the remaining order to 0..n-1", async () => {
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      {},
      ...successes(4),
    ]);

    await removeAdminProductImage(PRODUCT_ID, IMAGE_B);

    expect(updates(builders).slice(2)).toEqual([
      { values: { sort_order: 0 }, filters: { id: IMAGE_A, product_id: PRODUCT_ID } },
      { values: { sort_order: 1 }, filters: { id: IMAGE_C, product_id: PRODUCT_ID } },
    ]);
  });

  it("promotes the new leader when the primary is removed", async () => {
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      {},
      ...successes(4),
      {},
    ]);

    await expect(
      removeAdminProductImage(PRODUCT_ID, IMAGE_A),
    ).resolves.toEqual({ ok: true });

    const written = updates(builders);
    const promotion = written[written.length - 1];

    // IMAGE_B now leads the gallery, so it becomes the primary.
    expect(promotion).toEqual({
      values: { is_primary: true },
      filters: { id: IMAGE_B, product_id: PRODUCT_ID },
    });
  });

  it("leaves the primary alone when a different image is removed", async () => {
    const { builders } = supabaseWith([
      { data: THREE_IMAGES },
      {},
      ...successes(4),
    ]);

    await removeAdminProductImage(PRODUCT_ID, IMAGE_C);

    expect(
      updates(builders).some((call) => "is_primary" in call.values),
    ).toBe(false);
  });

  it("accepts a product left with no images and no primary", async () => {
    // A gallery can legitimately be emptied, and no primary is valid then.
    const { builders } = supabaseWith([
      { data: [row(IMAGE_A, 0, true)] },
      {},
    ]);

    await expect(
      removeAdminProductImage(PRODUCT_ID, IMAGE_A),
    ).resolves.toEqual({ ok: true });
    expect(updates(builders)).toEqual([]);
  });

  it("refuses an image belonging to another product", async () => {
    supabaseWith([{ data: THREE_IMAGES }]);

    await expect(
      removeAdminProductImage(
        PRODUCT_ID,
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ),
    ).resolves.toEqual({
      ok: false,
      error:
        "That image is not part of this product. Reload the page and try again.",
    });
  });

  it("hides database detail behind one generic message", async () => {
    supabaseWith([
      { data: THREE_IMAGES },
      { error: { code: "42501", message: "permission denied" } },
    ]);

    const result = await removeAdminProductImage(PRODUCT_ID, IMAGE_B);

    expect(result).toEqual({
      ok: false,
      error: "Image could not be removed. Try again.",
    });
    if (result.ok) {
      throw new Error("Expected the removal to fail.");
    }
    expect(result.error).not.toContain("permission denied");
  });
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/product-images/`;

/** A byte array beginning with `signature`, padded to a realistic length. */
function fileBytes(
  signature: readonly number[],
  length = 64,
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));

  bytes.set(signature.slice(0, length));

  return bytes;
}

function asciiBytes(text: string, length = Math.max(text.length, 64)) {
  const bytes = new Uint8Array(new ArrayBuffer(length));

  for (let index = 0; index < text.length && index < length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }

  return bytes;
}

/** An ISO base media header, used for AVIF and its HEIC look-alike. */
function isoBytes(majorBrand: string) {
  const bytes = new Uint8Array(new ArrayBuffer(64));

  bytes[3] = 16;

  const write = (text: string, offset: number) => {
    for (let index = 0; index < 4; index += 1) {
      bytes[offset + index] = text.charCodeAt(index);
    }
  };

  write("ftyp", 4);
  write(majorBrand, 8);

  return bytes;
}

const JPEG_BYTES = fileBytes([0xff, 0xd8, 0xff, 0xe0]);
const PNG_BYTES = fileBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_BYTES = (() => {
  const bytes = fileBytes([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]);

  bytes.set([0x57, 0x45, 0x42, 0x50], 8);

  return bytes;
})();
const AVIF_BYTES = isoBytes("avif");
const HEIC_BYTES = isoBytes("heic");

/**
 * A submitted file whose name and declared type are deliberately wrong, so any
 * test that passes is passing because of the bytes.
 */
function submittedFile(
  bytes: Uint8Array<ArrayBuffer>,
  name = "PHOTO.JPG",
  type = "image/jpeg",
) {
  return new File([bytes], name, { type });
}

/** Wires the happy path: product found, existing images, insert succeeds. */
function uploadSucceeds(existingImages: unknown[] = []) {
  return supabaseWith([
    { data: { id: PRODUCT_ID } },
    { data: existingImages },
    {},
  ]);
}

/** The single row handed to the product_images insert. */
function insertedRow(builders: ReturnType<typeof query>[]) {
  const builder = builders.find(
    (candidate) => candidate.insert.mock.calls.length > 0,
  );

  if (!builder) {
    throw new Error("No product_images insert was issued.");
  }

  return builder.insert.mock.calls[0][0] as Record<string, unknown>;
}

describe("uploadAdminProductImage", () => {
  it.each([
    ["JPEG", JPEG_BYTES, "image/jpeg", "jpg"],
    ["PNG", PNG_BYTES, "image/png", "png"],
    ["WebP", WEBP_BYTES, "image/webp", "webp"],
    ["AVIF", AVIF_BYTES, "image/avif", "avif"],
  ])("stores a %s and records it", async (_label, bytes, mimeType, extension) => {
    const { builders, upload, storageFrom } = uploadSucceeds();

    await expect(
      uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(bytes),
        altText: "A bottle",
      }),
    ).resolves.toEqual({ ok: true });

    expect(storageFrom).toHaveBeenCalledWith("product-images");

    const [objectPath, body, options] = upload.mock.calls[0];

    expect(objectPath).toBe(`${PRODUCT_ID}/${objectPath.split("/")[1]}`);
    expect(objectPath.endsWith(`.${extension}`)).toBe(true);
    // The verified type, never the one the browser declared.
    expect(options.contentType).toBe(mimeType);
    expect(options.upsert).toBe(false);
    expect(body.byteLength).toBe(bytes.byteLength);

    expect(insertedRow(builders)).toEqual({
      product_id: PRODUCT_ID,
      image_url: `${PUBLIC_PREFIX}${objectPath}`,
      alt_text: "A bottle",
      sort_order: 0,
      is_primary: true,
      storage_object_path: objectPath,
    });
  });

  it("writes only the six explicit columns", async () => {
    const { builders } = uploadSucceeds();

    await uploadAdminProductImage(PRODUCT_ID, {
      file: submittedFile(JPEG_BYTES),
      altText: "",
    });

    expect(Object.keys(insertedRow(builders)).sort()).toEqual([
      "alt_text",
      "image_url",
      "is_primary",
      "product_id",
      "sort_order",
      "storage_object_path",
    ]);
  });

  it("stores a public URL the recogniser accepts", async () => {
    const { builders } = uploadSucceeds();

    await uploadAdminProductImage(PRODUCT_ID, {
      file: submittedFile(JPEG_BYTES),
      altText: "",
    });

    const row = insertedRow(builders);

    expect(row.image_url).toBe(`${PUBLIC_PREFIX}${row.storage_object_path}`);
    expect(
      isSombreStorageImageUrl(row.image_url, SUPABASE_URL),
    ).toBe(true);
  });

  describe("derived values, never the browser's", () => {
    it("ignores the supplied filename and extension", async () => {
      const { builders, upload } = uploadSucceeds();

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(PNG_BYTES, "../../evil name.jpg", "image/jpeg"),
        altText: "",
      });

      const objectPath = upload.mock.calls[0][0];

      expect(objectPath).not.toContain("evil");
      expect(objectPath).not.toContain(" ");
      expect(objectPath).not.toContain("..");
      // PNG bytes behind a .jpg name are stored as a PNG.
      expect(objectPath.endsWith(".png")).toBe(true);
      expect(insertedRow(builders).storage_object_path).toBe(objectPath);
    });

    it("ignores the declared MIME type", async () => {
      const { upload } = uploadSucceeds();

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(WEBP_BYTES, "photo.jpg", "image/jpeg"),
        altText: "",
      });

      expect(
        upload.mock.calls[0][2].contentType,
      ).toBe("image/webp");
    });

    it("puts the object in the validated product's own folder", async () => {
      const { upload } = uploadSucceeds();

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
      });

      const objectPath = upload.mock.calls[0][0];

      expect(objectPath.startsWith(`${PRODUCT_ID}/`)).toBe(true);
      expect(objectPath).not.toContain(OTHER_PRODUCT_ID);
      expect(isValidStorageObjectPath(objectPath)).toBe(true);
    });

    it("generates a different object path every time", async () => {
      const paths = new Set<string>();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { upload } = uploadSucceeds();

        await uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        });

        paths.add(upload.mock.calls[0][0]);
      }

      expect(paths.size).toBe(5);
    });
  });

  describe("ordering and primary", () => {
    it("makes a product's first image its primary", async () => {
      const { builders } = uploadSucceeds([]);

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
      });

      expect(insertedRow(builders)).toMatchObject({
        sort_order: 0,
        is_primary: true,
      });
    });

    it("does not displace a primary the administrator already chose", async () => {
      const { builders } = uploadSucceeds(THREE_IMAGES);

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
      });

      expect(insertedRow(builders)).toMatchObject({
        sort_order: 3,
        is_primary: false,
      });
    });

    it("takes the next position after the highest, not the count", async () => {
      // A legacy gap in the sequence still has to yield a free position.
      const { builders } = uploadSucceeds([
        row(IMAGE_A, 0, true),
        row(IMAGE_B, 5),
      ]);

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
      });

      expect(insertedRow(builders)).toMatchObject({ sort_order: 6 });
    });

    it("ignores a sort order or primary flag posted alongside the file", async () => {
      // Neither is read from the submission at all; both are derived.
      const { builders } = uploadSucceeds(THREE_IMAGES);

      await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
        ...({ sortOrder: 0, isPrimary: true } as Record<string, unknown>),
      });

      expect(insertedRow(builders)).toMatchObject({
        sort_order: 3,
        is_primary: false,
      });
    });
  });

  describe("refusals", () => {
    it("refuses a malformed product reference before touching anything", async () => {
      supabaseWith([]);

      await expect(
        uploadAdminProductImage("not-a-uuid", {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "That product reference is not valid.",
      });
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it("refuses a product that no longer exists", async () => {
      const { upload } = supabaseWith([{ data: null }]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "That product no longer exists. Reload the page and try again.",
      });
      expect(upload).not.toHaveBeenCalled();
    });

    it.each([
      ["no file at all", undefined],
      ["an empty form field", ""],
      ["a string instead of a file", "/images/products/a.jpg"],
      ["null", null],
    ])("refuses %s", async (_label, file) => {
      supabaseWith([]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, { file, altText: "" }),
      ).resolves.toEqual({
        ok: false,
        error: "Choose an image file to upload.",
      });
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it("refuses an empty file", async () => {
      supabaseWith([]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(new Uint8Array(new ArrayBuffer(0))),
          altText: "",
        }),
      ).resolves.toEqual({ ok: false, error: "That file is empty." });
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it("refuses an oversized file without reading it", async () => {
      // The declared size is enough to turn it away, so nothing is buffered.
      const oversized = {
        size: MAX_PRODUCT_IMAGE_BYTES + 1,
        arrayBuffer: vi.fn(async () => new ArrayBuffer(0)),
      };

      supabaseWith([]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: oversized,
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "Images must be 4 MB or smaller.",
      });
      expect(oversized.arrayBuffer).not.toHaveBeenCalled();
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it.each([
      ["an SVG", asciiBytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
      ["a GIF", asciiBytes("GIF89a")],
      ["HEIC", HEIC_BYTES],
      ["an HTML page", asciiBytes("<!doctype html><html></html>")],
      ["a shell script", asciiBytes("#!/bin/sh\nrm -rf /\n")],
      ["an executable", fileBytes([0x4d, 0x5a, 0x90, 0x00])],
      ["random bytes", fileBytes([0x01, 0x02, 0x03, 0x04])],
    ])("refuses %s even when named .jpg", async (_label, bytes) => {
      supabaseWith([]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(bytes, "photo.jpg", "image/jpeg"),
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "That file is not a JPEG, PNG, WebP, or AVIF image.",
      });
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });

    it("refuses alt text past its ceiling", async () => {
      supabaseWith([]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "a".repeat(400),
        }),
      ).resolves.toMatchObject({ ok: false });
      expect(mocks.createSupabase).not.toHaveBeenCalled();
    });
  });

  describe("failure handling", () => {
    it("creates no database row when the upload fails", async () => {
      const { builders } = supabaseWith(
        [{ data: { id: PRODUCT_ID } }, { data: [] }],
        { upload: { error: { message: "storage down" } } },
      );

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "The image could not be uploaded. Try again.",
      });
      expect(
        builders.every((builder) => builder.insert.mock.calls.length === 0),
      ).toBe(true);
    });

    it("removes the uploaded object when the row cannot be written", async () => {
      const { upload, remove } = supabaseWith([
        { data: { id: PRODUCT_ID } },
        { data: [] },
        { error: { code: "42501", message: "permission denied" } },
      ]);

      const result = await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
      });

      expect(result).toEqual({
        ok: false,
        error: "The image could not be uploaded. Try again.",
      });
      // The compensation targets exactly the object that was just stored.
      expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    });

    it("logs an orphan when the compensating delete also fails", async () => {
      const { upload } = supabaseWith(
        [
          { data: { id: PRODUCT_ID } },
          { data: [] },
          { error: { message: "insert failed" } },
        ],
        { remove: { error: { message: "remove failed" } } },
      );

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toMatchObject({ ok: false });

      expect(console.error).toHaveBeenCalledWith(
        "Orphaned product image object: uploaded but neither recorded nor removed",
        expect.objectContaining({ objectPath: upload.mock.calls[0][0] }),
      );
    });

    it("survives a compensating delete that throws", async () => {
      // A throw during cleanup must not replace the original failure.
      supabaseWith(
        [
          { data: { id: PRODUCT_ID } },
          { data: [] },
          { error: { message: "insert failed" } },
        ],
        { remove: { throws: true } },
      );

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "The image could not be uploaded. Try again.",
      });
    });

    it("reports a conflict when the position was taken meanwhile", async () => {
      supabaseWith([
        { data: { id: PRODUCT_ID } },
        { data: [] },
        { error: { code: "23505" } },
      ]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toMatchObject({
        ok: false,
        error:
          "The images changed while you were editing. Reload the page and try again.",
      });
    });

    it("keeps database detail out of the browser", async () => {
      supabaseWith([
        { data: { id: PRODUCT_ID } },
        { data: [] },
        {
          error: {
            code: "42501",
            message: 'permission denied for table "product_images"',
          },
        },
      ]);

      const result = await uploadAdminProductImage(PRODUCT_ID, {
        file: submittedFile(JPEG_BYTES),
        altText: "",
      });

      if (result.ok) {
        throw new Error("Expected the upload to fail.");
      }

      expect(result.error).not.toContain("permission denied");
      expect(result.error).not.toContain("product_images");
      expect(console.error).toHaveBeenCalledWith(
        "Failed to record an uploaded product image",
        expect.objectContaining({ code: "42501" }),
      );
    });

    it("reports a generic failure when the product cannot be read", async () => {
      const { upload } = supabaseWith([{ error: { message: "boom" } }]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toEqual({
        ok: false,
        error: "The image could not be uploaded. Try again.",
      });
      // Nothing is stored when the database cannot be reached.
      expect(upload).not.toHaveBeenCalled();
    });

    it("does not upload when the existing images cannot be read", async () => {
      const { upload } = supabaseWith([
        { data: { id: PRODUCT_ID } },
        { error: { message: "boom" } },
      ]);

      await expect(
        uploadAdminProductImage(PRODUCT_ID, {
          file: submittedFile(JPEG_BYTES),
          altText: "",
        }),
      ).resolves.toMatchObject({ ok: false });
      expect(upload).not.toHaveBeenCalled();
    });
  });

  describe("existing local image management is unchanged", () => {
    it("still adds a local path with no storage object path", async () => {
      const { builders } = supabaseWith([
        { data: THREE_IMAGES },
        {},
      ]);

      await expect(
        addAdminProductImage(PRODUCT_ID, {
          imageUrl: "/images/products/a.jpg",
          altText: "",
        }),
      ).resolves.toEqual({ ok: true });

      const row = insertedRow(builders);

      expect(row.image_url).toBe("/images/products/a.jpg");
      // A local row carries no stored object, so removing it never asks
      // Storage to delete anything.
      expect(row).not.toHaveProperty("storage_object_path");
    });
  });
});
