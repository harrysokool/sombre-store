import { describe, expect, it } from "vitest";

import {
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
  buildProductImageObjectPath,
  buildProductImagePublicUrl,
  detectProductImageMimeType,
  getProductIdFromStorageObjectPath,
  getStorageObjectPathFromUrl,
  isSombreStorageImageUrl,
  isValidStorageObjectPath,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_EXTENSIONS,
  validateProductImageFile,
} from "./product-image-storage";
import { isValidProductImagePath } from "./product-image-rules";

const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_NAME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";

/** A byte array beginning with `signature`, padded out to a realistic length. */
function fileBytes(signature: readonly number[], length = 64): Uint8Array {
  const bytes = new Uint8Array(length);

  bytes.set(signature.slice(0, length));

  return bytes;
}

function asciiBytes(text: string, length = Math.max(text.length, 64)) {
  const bytes = new Uint8Array(length);

  for (let index = 0; index < text.length && index < length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }

  return bytes;
}

/** An ISO base media header with the given major and compatible brands. */
function isoBytes(majorBrand: string, compatibleBrands: string[] = []) {
  const boxSize = 16 + compatibleBrands.length * 4;
  const bytes = new Uint8Array(Math.max(boxSize, 64));

  bytes[0] = (boxSize >> 24) & 0xff;
  bytes[1] = (boxSize >> 16) & 0xff;
  bytes[2] = (boxSize >> 8) & 0xff;
  bytes[3] = boxSize & 0xff;

  const write = (text: string, offset: number) => {
    for (let index = 0; index < 4; index += 1) {
      bytes[offset + index] = text.charCodeAt(index);
    }
  };

  write("ftyp", 4);
  write(majorBrand, 8);
  // Bytes 12-15 are the minor version and are left as zeroes.
  compatibleBrands.forEach((brand, index) => write(brand, 16 + index * 4));

  return bytes;
}

const JPEG = fileBytes([0xff, 0xd8, 0xff, 0xe0]);
const PNG = fileBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = (() => {
  const bytes = fileBytes([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]);

  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"

  return bytes;
})();
const AVIF = isoBytes("avif");

describe("detectProductImageMimeType", () => {
  it("identifies JPEG from its bytes", () => {
    expect(detectProductImageMimeType(JPEG)).toBe("image/jpeg");
  });

  it("identifies PNG from its bytes", () => {
    expect(detectProductImageMimeType(PNG)).toBe("image/png");
  });

  it("identifies WebP from its RIFF container", () => {
    expect(detectProductImageMimeType(WEBP)).toBe("image/webp");
  });

  it("identifies AVIF from its major brand", () => {
    expect(detectProductImageMimeType(AVIF)).toBe("image/avif");
  });

  it("identifies AVIF declared through its compatible brands", () => {
    // Some encoders write a generic major brand and list avif alongside it.
    expect(detectProductImageMimeType(isoBytes("mif1", ["mif1", "avif"]))).toBe(
      "image/avif",
    );
  });

  it("refuses HEIC, which shares the same container", () => {
    expect(detectProductImageMimeType(isoBytes("heic", ["mif1"]))).toBeNull();
  });

  it.each([
    ["an SVG document", '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    ["an SVG behind an XML declaration", '<?xml version="1.0"?><svg></svg>'],
    ["a GIF", "GIF89a"],
    ["a shell script", "#!/bin/sh\nrm -rf /\n"],
    ["an HTML page", "<!doctype html><html></html>"],
    ["random text", "just some words that are definitely not an image"],
  ])("refuses %s", (_label, text) => {
    expect(detectProductImageMimeType(asciiBytes(text))).toBeNull();
  });

  it.each([
    ["a Mach-O binary", [0xcf, 0xfa, 0xed, 0xfe]],
    ["an ELF binary", [0x7f, 0x45, 0x4c, 0x46]],
    ["a Windows executable", [0x4d, 0x5a, 0x90, 0x00]],
    ["a ZIP archive", [0x50, 0x4b, 0x03, 0x04]],
    ["a PDF", [0x25, 0x50, 0x44, 0x46]],
  ])("refuses %s", (_label, signature) => {
    expect(detectProductImageMimeType(fileBytes(signature))).toBeNull();
  });

  it("refuses an empty file", () => {
    expect(detectProductImageMimeType(new Uint8Array(0))).toBeNull();
  });

  it("refuses a truncated signature rather than guessing", () => {
    expect(detectProductImageMimeType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectProductImageMimeType(new Uint8Array([0x52, 0x49]))).toBeNull();
  });

  it("refuses RIFF that is not WebP", () => {
    // A WAV file is also RIFF, so the second tag is what decides.
    const wav = fileBytes([0x52, 0x49, 0x46, 0x46]);

    wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

    expect(detectProductImageMimeType(wav)).toBeNull();
  });
});

describe("validateProductImageFile", () => {
  it("accepts each allowed format and reports what it really is", () => {
    expect(validateProductImageFile({ size: 1024, bytes: JPEG })).toEqual({
      ok: true,
      mimeType: "image/jpeg",
      extension: "jpg",
    });
    expect(validateProductImageFile({ size: 1024, bytes: PNG })).toEqual({
      ok: true,
      mimeType: "image/png",
      extension: "png",
    });
    expect(validateProductImageFile({ size: 1024, bytes: WEBP })).toEqual({
      ok: true,
      mimeType: "image/webp",
      extension: "webp",
    });
    expect(validateProductImageFile({ size: 1024, bytes: AVIF })).toEqual({
      ok: true,
      mimeType: "image/avif",
      extension: "avif",
    });
  });

  it("refuses a file named .jpg that does not contain JPEG bytes", () => {
    // The name never reaches this function; only the bytes decide.
    const result = validateProductImageFile({
      size: 1024,
      bytes: asciiBytes("<svg></svg>"),
    });

    expect(result).toEqual({
      ok: false,
      error: "That file is not a JPEG, PNG, WebP, or AVIF image.",
    });
  });

  it("accepts a file exactly at the size ceiling", () => {
    expect(
      validateProductImageFile({
        size: MAX_PRODUCT_IMAGE_BYTES,
        bytes: JPEG,
      }),
    ).toMatchObject({ ok: true });
  });

  it("refuses a file one byte over the ceiling", () => {
    expect(
      validateProductImageFile({
        size: MAX_PRODUCT_IMAGE_BYTES + 1,
        bytes: JPEG,
      }),
    ).toEqual({ ok: false, error: "Images must be 4 MB or smaller." });
  });

  it("refuses on size before looking at the contents", () => {
    // An oversized file should be turned away for its size, whatever it holds.
    expect(
      validateProductImageFile({
        size: MAX_PRODUCT_IMAGE_BYTES + 1,
        bytes: asciiBytes("not an image"),
      }),
    ).toMatchObject({ ok: false, error: "Images must be 4 MB or smaller." });
  });

  it.each([0, -1, Number.NaN])("refuses a size of %s", (size) => {
    expect(validateProductImageFile({ size, bytes: JPEG })).toEqual({
      ok: false,
      error: "That file is empty.",
    });
  });
});

describe("MIME and extension mapping", () => {
  it("maps every allowed type to an extension", () => {
    expect(Object.keys(PRODUCT_IMAGE_EXTENSIONS).sort()).toEqual(
      [...ALLOWED_PRODUCT_IMAGE_MIME_TYPES].sort(),
    );
    expect(PRODUCT_IMAGE_EXTENSIONS).toEqual({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    });
  });

  it("does not offer an SVG or GIF mapping", () => {
    expect(ALLOWED_PRODUCT_IMAGE_MIME_TYPES).not.toContain("image/svg+xml");
    expect(ALLOWED_PRODUCT_IMAGE_MIME_TYPES).not.toContain("image/gif");
  });
});

describe("buildProductImageObjectPath", () => {
  it("uses the product folder, a random name, and the detected extension", () => {
    expect(
      buildProductImageObjectPath(PRODUCT_ID, "image/jpeg", () => OBJECT_NAME),
    ).toBe(`${PRODUCT_ID}/${OBJECT_NAME}.jpg`);
  });

  it.each(ALLOWED_PRODUCT_IMAGE_MIME_TYPES)(
    "names a %s object with its own extension",
    (mimeType) => {
      expect(
        buildProductImageObjectPath(PRODUCT_ID, mimeType, () => OBJECT_NAME),
      ).toBe(
        `${PRODUCT_ID}/${OBJECT_NAME}.${PRODUCT_IMAGE_EXTENSIONS[mimeType]}`,
      );
    },
  );

  it("generates a distinct name every time by default", () => {
    // crypto.randomUUID backs the default, so two uploads never collide and a
    // path cannot be guessed from another.
    const paths = new Set(
      Array.from({ length: 50 }, () =>
        buildProductImageObjectPath(PRODUCT_ID, "image/jpeg"),
      ),
    );

    expect(paths.size).toBe(50);
    for (const path of paths) {
      expect(isValidStorageObjectPath(path)).toBe(true);
    }
  });

  it("normalizes an uppercase product id", () => {
    expect(
      buildProductImageObjectPath(
        PRODUCT_ID.toUpperCase(),
        "image/jpeg",
        () => OBJECT_NAME,
      ),
    ).toBe(`${PRODUCT_ID}/${OBJECT_NAME}.jpg`);
  });

  it.each([
    ["a non-uuid product id", "not-a-uuid"],
    ["an empty product id", ""],
    ["a traversal segment", "../../etc"],
    ["a path instead of an id", "33333333-3333-4333-8333-333333333333/evil"],
  ])("refuses %s", (_label, productId) => {
    expect(
      buildProductImageObjectPath(productId, "image/jpeg", () => OBJECT_NAME),
    ).toBeNull();
  });

  it.each([[null], [undefined], [42], [{}]])(
    "refuses a product id of %s",
    (productId) => {
      expect(
        buildProductImageObjectPath(productId, "image/jpeg", () => OBJECT_NAME),
      ).toBeNull();
    },
  );

  it("refuses an object name that is not a uuid", () => {
    // Guards the shape even if the generator is ever replaced.
    expect(
      buildProductImageObjectPath(
        PRODUCT_ID,
        "image/jpeg",
        () => "../../evil",
      ),
    ).toBeNull();
  });

  it("never puts a supplied filename in the path", () => {
    const path = buildProductImageObjectPath(PRODUCT_ID, "image/jpeg");

    expect(path).not.toContain("photo");
    expect(path).toMatch(
      /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/,
    );
  });
});

describe("isValidStorageObjectPath", () => {
  it("accepts a generated path", () => {
    expect(isValidStorageObjectPath(`${PRODUCT_ID}/${OBJECT_NAME}.jpg`)).toBe(
      true,
    );
  });

  it.each([
    ["a leading slash", `/${PRODUCT_ID}/${OBJECT_NAME}.jpg`],
    ["a traversal segment", `${PRODUCT_ID}/../${OBJECT_NAME}.jpg`],
    ["a bare traversal", "../../etc/passwd"],
    ["an unlisted extension", `${PRODUCT_ID}/${OBJECT_NAME}.svg`],
    ["no extension", `${PRODUCT_ID}/${OBJECT_NAME}`],
    ["a nested folder", `${PRODUCT_ID}/nested/${OBJECT_NAME}.jpg`],
    ["a non-uuid folder", `products/${OBJECT_NAME}.jpg`],
    ["a local image path", "/images/products/a.jpg"],
    ["an empty string", ""],
  ])("refuses %s", (_label, value) => {
    expect(isValidStorageObjectPath(value)).toBe(false);
  });

  it.each([[null], [undefined], [42]])("refuses %s", (value) => {
    expect(isValidStorageObjectPath(value)).toBe(false);
  });
});

describe("getProductIdFromStorageObjectPath", () => {
  it("reads the owning product out of the path", () => {
    expect(
      getProductIdFromStorageObjectPath(`${PRODUCT_ID}/${OBJECT_NAME}.jpg`),
    ).toBe(PRODUCT_ID);
  });

  it("returns nothing for a path it does not recognise", () => {
    expect(getProductIdFromStorageObjectPath("/images/products/a.jpg")).toBeNull();
  });
});

describe("Storage URL recognition", () => {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${PRODUCT_ID}/${OBJECT_NAME}.jpg`;

  it("accepts a URL for this bucket and returns its object path", () => {
    expect(getStorageObjectPathFromUrl(url, SUPABASE_URL)).toBe(
      `${PRODUCT_ID}/${OBJECT_NAME}.jpg`,
    );
    expect(isSombreStorageImageUrl(url, SUPABASE_URL)).toBe(true);
  });

  it("accepts a Supabase URL given with a trailing slash", () => {
    expect(isSombreStorageImageUrl(url, `${SUPABASE_URL}/`)).toBe(true);
  });

  it.each([
    [
      "another bucket on the same project",
      `${SUPABASE_URL}/storage/v1/object/public/avatars/${PRODUCT_ID}/${OBJECT_NAME}.jpg`,
    ],
    [
      "the signed URL endpoint",
      `${SUPABASE_URL}/storage/v1/object/sign/${PRODUCT_IMAGE_BUCKET}/${PRODUCT_ID}/${OBJECT_NAME}.jpg`,
    ],
    [
      "an authenticated object endpoint",
      `${SUPABASE_URL}/storage/v1/object/${PRODUCT_IMAGE_BUCKET}/${PRODUCT_ID}/${OBJECT_NAME}.jpg`,
    ],
    ["the REST API", `${SUPABASE_URL}/rest/v1/products?select=*`],
    ["the project root", SUPABASE_URL],
    [
      "a bucket whose name merely starts the same",
      `${SUPABASE_URL}/storage/v1/object/public/product-images-private/${PRODUCT_ID}/${OBJECT_NAME}.jpg`,
    ],
  ])("refuses %s", (_label, candidate) => {
    expect(getStorageObjectPathFromUrl(candidate, SUPABASE_URL)).toBeNull();
    expect(isSombreStorageImageUrl(candidate, SUPABASE_URL)).toBe(false);
  });

  it("refuses another host offering the same path", () => {
    const impostor = `https://evil.example/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${PRODUCT_ID}/${OBJECT_NAME}.jpg`;

    expect(isSombreStorageImageUrl(impostor, SUPABASE_URL)).toBe(false);
  });

  it("refuses a look-alike hostname", () => {
    const impostor = url.replace(
      "abcdefghijklmnop.supabase.co",
      "abcdefghijklmnop.supabase.co.evil.example",
    );

    expect(isSombreStorageImageUrl(impostor, SUPABASE_URL)).toBe(false);
  });

  it("refuses a percent-encoded traversal", () => {
    const traversal = `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${PRODUCT_ID}%2f..%2f..%2fsecret.jpg`;

    expect(getStorageObjectPathFromUrl(traversal, SUPABASE_URL)).toBeNull();
  });

  it.each([
    ["a query string", `${url}?download=1`],
    ["a fragment", `${url}#x`],
  ])("refuses %s", (_label, candidate) => {
    expect(isSombreStorageImageUrl(candidate, SUPABASE_URL)).toBe(false);
  });

  it("refuses a local image path", () => {
    expect(isSombreStorageImageUrl("/images/products/a.jpg", SUPABASE_URL)).toBe(
      false,
    );
  });

  it.each([[null], [undefined], [""], ["not a url"]])(
    "refuses a configured Supabase URL of %s",
    (configured) => {
      expect(isSombreStorageImageUrl(url, configured)).toBe(false);
    },
  );
});

describe("buildProductImagePublicUrl", () => {
  it("round-trips with the recogniser", () => {
    const objectPath = `${PRODUCT_ID}/${OBJECT_NAME}.jpg`;
    const built = buildProductImagePublicUrl(objectPath, SUPABASE_URL);

    expect(built).toBe(
      `${SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${objectPath}`,
    );
    expect(getStorageObjectPathFromUrl(built, SUPABASE_URL)).toBe(objectPath);
  });

  it("refuses to build a URL from a path it does not recognise", () => {
    expect(buildProductImagePublicUrl("../../secret", SUPABASE_URL)).toBeNull();
    expect(
      buildProductImagePublicUrl("/images/products/a.jpg", SUPABASE_URL),
    ).toBeNull();
  });
});

describe("existing local images stay unaffected", () => {
  const localPaths = [
    "/images/products/maison-margiela/replica-jazz-club-01.jpg",
    "/images/products/velvet-ember-01.jpg",
    "/images/products/example 01.jpg",
  ];

  it("still accepts every local path the admin editor accepts", () => {
    // Phase 4A's rule is untouched by the Storage work.
    for (const path of localPaths) {
      expect(isValidProductImagePath(path)).toBe(true);
    }
  });

  it("does not mistake a local path for a stored object", () => {
    // A row with no storage_object_path must never trigger a Storage delete.
    for (const path of localPaths) {
      expect(isValidStorageObjectPath(path)).toBe(false);
      expect(isSombreStorageImageUrl(path, SUPABASE_URL)).toBe(false);
    }
  });

  it("keeps the two forms mutually exclusive", () => {
    const storageUrl = buildProductImagePublicUrl(
      `${PRODUCT_ID}/${OBJECT_NAME}.jpg`,
      SUPABASE_URL,
    );

    expect(isValidProductImagePath(storageUrl!)).toBe(false);
    expect(isSombreStorageImageUrl(storageUrl, SUPABASE_URL)).toBe(true);
  });
});
