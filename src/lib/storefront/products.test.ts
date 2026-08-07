import { describe, expect, it } from "vitest";

import {
  getGalleryProductImages,
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

describe("getGalleryProductImages", () => {
  const urls = (images: ProductImage[]) => images.map((i) => i.image_url);

  it("returns an empty list when the product has no images", () => {
    expect(getGalleryProductImages(null)).toEqual([]);
    expect(getGalleryProductImages([])).toEqual([]);
  });

  it("returns the one image a single-image product has", () => {
    expect(urls(getGalleryProductImages([image("/a.jpg", 0, true)]))).toEqual([
      "/a.jpg",
    ]);
  });

  it("keeps sort order when the primary already leads", () => {
    const images = [
      image("/a.jpg", 0, true),
      image("/b.jpg", 1),
      image("/c.jpg", 2),
    ];

    expect(urls(getGalleryProductImages(images))).toEqual([
      "/a.jpg",
      "/b.jpg",
      "/c.jpg",
    ]);
  });

  // Rows arrive in whatever order Postgres returns them.
  it("sorts before ordering, not relying on array order", () => {
    const images = [
      image("/c.jpg", 2),
      image("/a.jpg", 0, true),
      image("/b.jpg", 1),
    ];

    expect(urls(getGalleryProductImages(images))).toEqual([
      "/a.jpg",
      "/b.jpg",
      "/c.jpg",
    ]);
  });

  // The point of the helper: sort order alone would open on the wrong image.
  it("lifts a primary flagged mid-list to the front", () => {
    const images = [
      image("/a.jpg", 0),
      image("/b.jpg", 1, true),
      image("/c.jpg", 2),
    ];

    expect(urls(getGalleryProductImages(images))).toEqual([
      "/b.jpg",
      "/a.jpg",
      "/c.jpg",
    ]);
  });

  it("lifts a primary flagged last to the front", () => {
    const images = [
      image("/a.jpg", 0),
      image("/b.jpg", 1),
      image("/c.jpg", 2, true),
    ];

    expect(urls(getGalleryProductImages(images))).toEqual([
      "/c.jpg",
      "/a.jpg",
      "/b.jpg",
    ]);
  });

  // Matches getPrimaryProductImage's own fallback, so an unflagged product
  // simply shows its images in the order they were arranged.
  it("falls back to plain sort order when no image is flagged primary", () => {
    const images = [image("/c.jpg", 2), image("/a.jpg", 0), image("/b.jpg", 1)];

    expect(urls(getGalleryProductImages(images))).toEqual([
      "/a.jpg",
      "/b.jpg",
      "/c.jpg",
    ]);
  });

  it("never drops or duplicates an image", () => {
    const images = [
      image("/a.jpg", 0),
      image("/b.jpg", 1, true),
      image("/c.jpg", 2),
    ];

    const gallery = getGalleryProductImages(images);

    expect(gallery).toHaveLength(images.length);
    expect(new Set(urls(gallery)).size).toBe(images.length);
  });

  // The two helpers must agree about which image leads.
  it("leads with whatever getPrimaryProductImage returns", () => {
    const images = [
      image("/a.jpg", 0),
      image("/b.jpg", 1, true),
      image("/c.jpg", 2),
    ];

    expect(getGalleryProductImages(images)[0]).toBe(
      getPrimaryProductImage(images),
    );
  });
});

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
