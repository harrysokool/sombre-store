import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_TEXT_LIMITS,
  describeAnnouncement,
  isSafeInternalPath,
  normalizeOptionalText,
  validateAnnouncementSubmission,
  type AdminAnnouncementSubmission,
} from "./announcement-content-rules";

const VALID: AdminAnnouncementSubmission = {
  prefixText: "Use code",
  highlightText: "HAPPY2026",
  suffixText: "for up to 60% off selected products",
  linkLabel: "Shop Now",
  linkHref: "/shop",
  isActive: true,
};

function submit(overrides: Partial<AdminAnnouncementSubmission> = {}) {
  return validateAnnouncementSubmission({ ...VALID, ...overrides });
}

describe("announcement text limits", () => {
  it("matches the lengths the migration enforces", () => {
    expect(ANNOUNCEMENT_TEXT_LIMITS).toEqual({
      prefixText: 80,
      highlightText: 32,
      suffixText: 120,
      linkLabel: 32,
      linkHref: 200,
    });
  });
});

describe("normalizeOptionalText", () => {
  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a tab", "\t"],
    ["a non-string", 42],
    ["null", null],
    ["undefined", undefined],
  ])("turns %s into null", (_name, value) => {
    expect(normalizeOptionalText(value)).toBeNull();
  });

  it("trims a populated value rather than storing the padding", () => {
    expect(normalizeOptionalText("  Use code  ")).toBe("Use code");
  });
});

describe("isSafeInternalPath", () => {
  it.each(["/", "/shop", "/shop/all", "/products/x?y=1", "/a-b_c.d"])(
    "accepts the internal path %s",
    (path) => {
      expect(isSafeInternalPath(path)).toBe(true);
    },
  );

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["an absolute https URL", "https://evil.example"],
    ["a javascript scheme", "javascript:alert(1)"],
    ["a relative path", "shop"],
    ["an empty string", ""],
    ["a backslash escape", "/\\evil.example"],
    ["a mixed separator", "/shop\\..\\evil"],
  ])("rejects %s", (_name, path) => {
    expect(isSafeInternalPath(path)).toBe(false);
  });
});

describe("describeAnnouncement", () => {
  it("joins the populated parts into one readable line", () => {
    expect(
      describeAnnouncement({
        prefix_text: "Use code",
        highlight_text: "HAPPY2026",
        suffix_text: "for 60% off",
      }),
    ).toBe("Use code HAPPY2026 for 60% off");
  });

  it("skips absent parts rather than leaving gaps", () => {
    expect(
      describeAnnouncement({
        prefix_text: null,
        highlight_text: "HAPPY2026",
        suffix_text: null,
      }),
    ).toBe("HAPPY2026");
  });

  it("truncates a long line so a control label stays readable", () => {
    const description = describeAnnouncement({
      prefix_text: "x".repeat(80),
      highlight_text: null,
      suffix_text: null,
    });

    expect(description).toHaveLength(60);
    expect(description.endsWith("…")).toBe(true);
  });
});

describe("validateAnnouncementSubmission", () => {
  describe("content presence", () => {
    it("accepts a complete announcement", () => {
      expect(submit()).toEqual({
        ok: true,
        value: {
          prefix_text: "Use code",
          highlight_text: "HAPPY2026",
          suffix_text: "for up to 60% off selected products",
          link_label: "Shop Now",
          link_href: "/shop",
          is_active: true,
        },
      });
    });

    it.each([
      ["prefix only", { highlightText: "", suffixText: "" }],
      ["highlight only", { prefixText: "", suffixText: "" }],
      ["suffix only", { prefixText: "", highlightText: "" }],
    ])("accepts %s, so the pill can lead, close, or sit inside", (
      _name,
      overrides,
    ) => {
      expect(submit(overrides).ok).toBe(true);
    });

    it("refuses an announcement with no text at all", () => {
      const result = submit({
        prefixText: "",
        highlightText: "   ",
        suffixText: "",
      });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(
        "at least one of prefix, highlight, or suffix",
      );
    });
  });

  describe("normalisation", () => {
    it("stores absent optional fields as null, never as empty strings", () => {
      const result = submit({
        highlightText: "",
        suffixText: "   ",
        linkLabel: "",
        linkHref: "",
      });

      expect(result.ok === true && result.value).toEqual({
        prefix_text: "Use code",
        highlight_text: null,
        suffix_text: null,
        link_label: null,
        link_href: null,
        is_active: true,
      });
    });

    it("trims populated values", () => {
      const result = submit({
        prefixText: "  Use code  ",
        linkLabel: "  Shop Now  ",
        linkHref: "  /shop  ",
      });

      expect(result.ok === true && result.value.prefix_text).toBe("Use code");
      expect(result.ok === true && result.value.link_label).toBe("Shop Now");
      expect(result.ok === true && result.value.link_href).toBe("/shop");
    });

    it("normalises the active flag to a real boolean", () => {
      expect(submit({ isActive: false }).ok === true).toBe(true);
      const result = submit({ isActive: false });
      expect(result.ok === true && result.value.is_active).toBe(false);
    });
  });

  describe("length limits", () => {
    it.each([
      ["prefixText", "Prefix text", ANNOUNCEMENT_TEXT_LIMITS.prefixText],
      [
        "highlightText",
        "Highlight text",
        ANNOUNCEMENT_TEXT_LIMITS.highlightText,
      ],
      ["suffixText", "Suffix text", ANNOUNCEMENT_TEXT_LIMITS.suffixText],
      ["linkLabel", "Link label", ANNOUNCEMENT_TEXT_LIMITS.linkLabel],
    ])("accepts %s at exactly the limit", (field, _label, limit) => {
      expect(submit({ [field]: "x".repeat(limit) }).ok).toBe(true);
    });

    it.each([
      ["prefixText", "Prefix text", ANNOUNCEMENT_TEXT_LIMITS.prefixText],
      [
        "highlightText",
        "Highlight text",
        ANNOUNCEMENT_TEXT_LIMITS.highlightText,
      ],
      ["suffixText", "Suffix text", ANNOUNCEMENT_TEXT_LIMITS.suffixText],
      ["linkLabel", "Link label", ANNOUNCEMENT_TEXT_LIMITS.linkLabel],
    ])("refuses %s one character over the limit", (field, label, limit) => {
      const result = submit({ [field]: "x".repeat(limit + 1) });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(label);
      expect(result.ok === false && result.error).toContain(String(limit));
    });

    it("refuses an over-long link path", () => {
      const result = submit({
        linkHref: `/${"x".repeat(ANNOUNCEMENT_TEXT_LIMITS.linkHref)}`,
      });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain("Link path");
    });

    it("measures the trimmed value, not the padding", () => {
      const atLimit = "x".repeat(ANNOUNCEMENT_TEXT_LIMITS.highlightText);

      expect(submit({ highlightText: `  ${atLimit}  ` }).ok).toBe(true);
    });
  });

  describe("link pairing", () => {
    it("accepts both halves absent", () => {
      const result = submit({ linkLabel: "", linkHref: "" });

      expect(result.ok).toBe(true);
      expect(result.ok === true && result.value.link_label).toBeNull();
      expect(result.ok === true && result.value.link_href).toBeNull();
    });

    it.each([
      ["a label with no path", { linkHref: "" }],
      ["a path with no label", { linkLabel: "" }],
      ["a whitespace-only label", { linkLabel: "   " }],
    ])("refuses %s", (_name, overrides) => {
      const result = submit(overrides);

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(
        "both a label and a path",
      );
    });
  });

  describe("link safety", () => {
    it.each([
      "//evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "shop",
      "/\\evil.example",
    ])("refuses the unsafe link path %s", (linkHref) => {
      const result = submit({ linkHref });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(
        "stay on this site",
      );
    });

    it("accepts an ordinary internal path", () => {
      expect(submit({ linkHref: "/products/replica" }).ok).toBe(true);
    });
  });
});
