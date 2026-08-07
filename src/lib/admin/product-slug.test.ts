import { describe, expect, it } from "vitest";

import {
  isValidProductSlug,
  MAX_PRODUCT_SLUG_LENGTH,
  slugifyProductName,
} from "./product-slug";

describe("slugifyProductName", () => {
  it("lowercases a name and joins its words with hyphens", () => {
    expect(slugifyProductName("Replica Jazz Club")).toBe("replica-jazz-club");
  });

  it("folds accented letters to their base form", () => {
    // Losing the letter entirely would turn "Réplica" into "rplica".
    expect(slugifyProductName("Réplica Léger")).toBe("replica-leger");
  });

  it("drops apostrophes instead of replacing them", () => {
    // "women-s" would read as two words that were never two words.
    expect(slugifyProductName("Women's Éclat")).toBe("womens-eclat");
    expect(slugifyProductName("L’Homme Idéal")).toBe("lhomme-ideal");
  });

  it("spells an ampersand out, matching the existing catalog", () => {
    expect(slugifyProductName("Vale & Hearth")).toBe("vale-and-hearth");
  });

  it("collapses runs of separators and trims the ends", () => {
    expect(slugifyProductName("  Spaced   Out!  ")).toBe("spaced-out");
    expect(slugifyProductName("--Lead and trail--")).toBe("lead-and-trail");
  });

  it("returns an empty slug when a name has nothing sluggable in it", () => {
    // Reported by the validation layer rather than saved as "".
    expect(slugifyProductName("!!!")).toBe("");
    expect(slugifyProductName("   ")).toBe("");
  });

  it("returns an empty slug for a value that is not a string", () => {
    expect(slugifyProductName(null)).toBe("");
    expect(slugifyProductName(undefined)).toBe("");
    expect(slugifyProductName(42)).toBe("");
  });

  it("produces a slug the format check accepts when it truncates", () => {
    // Cutting mid-name can land on a hyphen, which the format refuses.
    const slug = slugifyProductName(`${"word ".repeat(40)}tail`);

    expect(slug.length).toBeLessThanOrEqual(MAX_PRODUCT_SLUG_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidProductSlug(slug)).toBe(true);
  });

  it("suggests a slug the format check accepts for a realistic name", () => {
    expect(isValidProductSlug(slugifyProductName("Replica By the Fireplace"))).toBe(
      true,
    );
  });
});

describe("isValidProductSlug", () => {
  it.each(["jazz", "replica-jazz-club", "maison-margiela-replica-no5", "no5"])(
    "accepts %s",
    (slug) => {
      expect(isValidProductSlug(slug)).toBe(true);
    },
  );

  it.each([
    ["an empty slug", ""],
    ["uppercase letters", "Replica-Jazz"],
    ["a leading hyphen", "-replica"],
    ["a trailing hyphen", "replica-"],
    ["doubled hyphens", "replica--jazz"],
    ["underscores", "replica_jazz"],
    ["spaces", "replica jazz"],
    ["a slash", "replica/jazz"],
  ])("refuses %s", (_label, slug) => {
    expect(isValidProductSlug(slug)).toBe(false);
  });

  it("refuses a slug past the length ceiling", () => {
    expect(isValidProductSlug("a".repeat(MAX_PRODUCT_SLUG_LENGTH))).toBe(true);
    expect(isValidProductSlug("a".repeat(MAX_PRODUCT_SLUG_LENGTH + 1))).toBe(
      false,
    );
  });
});
