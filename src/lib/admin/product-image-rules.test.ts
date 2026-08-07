import { describe, expect, it } from "vitest";

import {
  getReorderedImageIds,
  isProductImageMoveDirection,
  isValidProductImagePath,
  PRODUCT_IMAGE_TEXT_LIMITS,
  validateProductImageAltText,
  validateProductImageSubmission,
} from "./product-image-rules";

describe("isValidProductImagePath", () => {
  it.each([
    "/images/products/maison-margiela/replica-jazz-club-01.jpg",
    "/images/products/velvet-ember-01.jpg",
    // The task's own example: a space is legal in a path and the browser
    // encodes it.
    "/images/products/example 01.jpg",
    "/images/products/model-4.png",
  ])("accepts the local path %s", (path) => {
    expect(isValidProductImagePath(path)).toBe(true);
  });

  it.each([
    ["a bare slash", "/"],
    ["a relative path", "images/products/a.jpg"],
    ["a backslash path", "\\images\\a.jpg"],
    ["a backslash anywhere", "/images\\a.jpg"],
  ])("refuses %s", (_label, path) => {
    expect(isValidProductImagePath(path)).toBe(false);
  });

  it.each([
    ["a protocol-relative URL", "//evil.example/x.jpg"],
    ["an http URL", "http://evil.example/x.jpg"],
    ["an https URL", "https://cdn.example.com/x.jpg"],
    ["a javascript scheme", "javascript:alert(1)"],
    ["a data URL", "data:image/png;base64,AAAA"],
  ])("refuses %s", (_label, path) => {
    // next/image renders these rows and next.config.ts declares no
    // remotePatterns, so a remote source would throw when the product page
    // tried to render it.
    expect(isValidProductImagePath(path)).toBe(false);
  });

  it("refuses a path past the length ceiling", () => {
    const body = "a".repeat(PRODUCT_IMAGE_TEXT_LIMITS.imageUrl - 1);

    expect(isValidProductImagePath(`/${body}`)).toBe(true);
    expect(isValidProductImagePath(`/${body}a`)).toBe(false);
  });
});

describe("validateProductImageSubmission", () => {
  it("shapes a valid submission for the columns", () => {
    const result = validateProductImageSubmission({
      imageUrl: "  /images/products/a.jpg  ",
      altText: "  A bottle  ",
    });

    expect(result).toEqual({
      ok: true,
      value: { image_url: "/images/products/a.jpg", alt_text: "A bottle" },
    });
  });

  it.each([
    ["an empty path", ""],
    ["a whitespace-only path", "   "],
    ["a missing path", null],
  ])("refuses %s", (_label, imageUrl) => {
    expect(
      validateProductImageSubmission({ imageUrl, altText: "" }),
    ).toEqual({ ok: false, error: "Enter an image path." });
  });

  it("explains what a valid path looks like", () => {
    const result = validateProductImageSubmission({
      imageUrl: "https://cdn.example.com/x.jpg",
      altText: "",
    });

    expect(result).toMatchObject({ ok: false });
    if (result.ok) {
      throw new Error("Expected the submission to be refused.");
    }
    expect(result.error).toContain("local path beginning with a single /");
  });

  it("stores empty alt text as null", () => {
    // The column is nullable, and an invented description is worse than none.
    const result = validateProductImageSubmission({
      imageUrl: "/images/products/a.jpg",
      altText: "   ",
    });

    expect(result).toMatchObject({ ok: true, value: { alt_text: null } });
  });

  it("refuses alt text past its ceiling", () => {
    const result = validateProductImageSubmission({
      imageUrl: "/images/products/a.jpg",
      altText: "a".repeat(PRODUCT_IMAGE_TEXT_LIMITS.altText + 1),
    });

    expect(result).toMatchObject({ ok: false });
  });
});

describe("validateProductImageAltText", () => {
  it("trims and keeps text", () => {
    expect(validateProductImageAltText("  A bottle  ")).toEqual({
      ok: true,
      value: "A bottle",
    });
  });

  it.each([["", null], ["   ", null]])(
    "turns %s into null",
    (value, expected) => {
      expect(validateProductImageAltText(value)).toEqual({
        ok: true,
        value: expected,
      });
    },
  );

  it("treats a non-string as empty", () => {
    expect(validateProductImageAltText(null)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("refuses text past its ceiling", () => {
    const result = validateProductImageAltText(
      "a".repeat(PRODUCT_IMAGE_TEXT_LIMITS.altText + 1),
    );

    expect(result).toMatchObject({ ok: false });
  });
});

describe("isProductImageMoveDirection", () => {
  it.each(["up", "down"])("accepts %s", (direction) => {
    expect(isProductImageMoveDirection(direction)).toBe(true);
  });

  it.each([["sideways"], [""], [null], [undefined], [1]])(
    "refuses %s",
    (direction) => {
      expect(isProductImageMoveDirection(direction)).toBe(false);
    },
  );
});

describe("getReorderedImageIds", () => {
  const ids = ["a", "b", "c"];

  it("moves an image one place up", () => {
    expect(getReorderedImageIds(ids, "b", "up")).toEqual(["b", "a", "c"]);
  });

  it("moves an image one place down", () => {
    expect(getReorderedImageIds(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("refuses to move the first image up", () => {
    // An ordinary outcome, not an error: the control is disabled, so reaching
    // here means a stale page.
    expect(getReorderedImageIds(ids, "a", "up")).toBeNull();
  });

  it("refuses to move the last image down", () => {
    expect(getReorderedImageIds(ids, "c", "down")).toBeNull();
  });

  it("returns null for an image that is not in the list", () => {
    expect(getReorderedImageIds(ids, "missing", "up")).toBeNull();
  });

  it("cannot move the only image in either direction", () => {
    expect(getReorderedImageIds(["a"], "a", "up")).toBeNull();
    expect(getReorderedImageIds(["a"], "a", "down")).toBeNull();
  });

  it("leaves the source array untouched", () => {
    getReorderedImageIds(ids, "b", "up");

    expect(ids).toEqual(["a", "b", "c"]);
  });
});
