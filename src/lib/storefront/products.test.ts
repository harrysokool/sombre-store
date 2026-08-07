import { describe, expect, it } from "vitest";

import {
  getPrimaryProductImage,
  getSecondaryProductImage,
  type ProductImage,
} from "./products";

function image(
  url: string,
  sortOrder: number,
  isPrimary = false,
): ProductImage {
  return {
    image_url: url,
    alt_text: `${url} alt`,
    sort_order: sortOrder,
    is_primary: isPrimary,
  };
}

describe("getSecondaryProductImage", () => {
  it("returns null when the product has no images at all", () => {
    expect(getSecondaryProductImage(null)).toBeNull();
    expect(getSecondaryProductImage([])).toBeNull();
  });

  // The single-image case is the one that has to keep the tile unchanged.
  it("returns null when the product has only one image", () => {
    expect(getSecondaryProductImage([image("/a.jpg", 0, true)])).toBeNull();
  });

  it("returns the image that follows the primary in sort order", () => {
    const images = [
      image("/a.jpg", 0, true),
      image("/b.jpg", 1),
      image("/c.jpg", 2),
    ];

    expect(getSecondaryProductImage(images)?.image_url).toBe("/b.jpg");
  });

  // Rows arrive in whatever order Postgres returns them, so the helper has to
  // sort before it counts.
  it("sorts before choosing, not relying on array order", () => {
    const images = [
      image("/c.jpg", 2),
      image("/a.jpg", 0, true),
      image("/b.jpg", 1),
    ];

    expect(getSecondaryProductImage(images)?.image_url).toBe("/b.jpg");
  });

  // The primary is not required to be first: whichever row carries the flag is
  // the primary, and the secondary is whatever sorts directly after it.
  it("follows a primary that sits in the middle of the order", () => {
    const images = [
      image("/a.jpg", 0),
      image("/b.jpg", 1, true),
      image("/c.jpg", 2),
    ];

    expect(getPrimaryProductImage(images)?.image_url).toBe("/b.jpg");
    expect(getSecondaryProductImage(images)?.image_url).toBe("/c.jpg");
  });

  // Nothing follows a primary flagged last, so there is no second view to
  // offer. Better to show one image than to jump backwards to the start.
  it("returns null when the primary is the last image in the order", () => {
    const images = [image("/a.jpg", 0), image("/b.jpg", 1, true)];

    expect(getSecondaryProductImage(images)).toBeNull();
  });

  // Matches the fallback in getPrimaryProductImage, so the two can never
  // disagree about which image is standing in as the primary.
  it("treats the first sorted image as primary when no row is flagged", () => {
    const images = [image("/b.jpg", 1), image("/a.jpg", 0)];

    expect(getPrimaryProductImage(images)?.image_url).toBe("/a.jpg");
    expect(getSecondaryProductImage(images)?.image_url).toBe("/b.jpg");
  });

  it("never returns the same image the primary getter returned", () => {
    const images = [
      image("/a.jpg", 0, true),
      image("/b.jpg", 1),
      image("/c.jpg", 2),
    ];

    expect(getSecondaryProductImage(images)?.image_url).not.toBe(
      getPrimaryProductImage(images)?.image_url,
    );
  });
});
