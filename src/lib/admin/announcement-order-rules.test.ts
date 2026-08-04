import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_MOVE_DIRECTIONS,
  getAdjacentIndex,
  isAnnouncementMoveDirection,
} from "./announcement-order-rules";

describe("announcement move directions", () => {
  it("supports exactly up and down", () => {
    expect(ANNOUNCEMENT_MOVE_DIRECTIONS).toEqual(["up", "down"]);
  });
});

describe("isAnnouncementMoveDirection", () => {
  it.each(["up", "down"])("accepts %s", (direction) => {
    expect(isAnnouncementMoveDirection(direction)).toBe(true);
  });

  it.each([
    ["an unknown word", "sideways"],
    ["the wrong case", "UP"],
    ["a padded value", " up "],
    ["an empty string", ""],
    ["a number", 1],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
  ])("rejects %s", (_name, value) => {
    expect(isAnnouncementMoveDirection(value)).toBe(false);
  });
});

describe("getAdjacentIndex", () => {
  it("steps one place up", () => {
    expect(getAdjacentIndex(2, "up", 5)).toBe(1);
  });

  it("steps one place down", () => {
    expect(getAdjacentIndex(2, "down", 5)).toBe(3);
  });

  it("returns null moving the first item up", () => {
    expect(getAdjacentIndex(0, "up", 5)).toBeNull();
  });

  it("returns null moving the last item down", () => {
    expect(getAdjacentIndex(4, "down", 5)).toBeNull();
  });

  it("returns null in both directions for a single-item list", () => {
    expect(getAdjacentIndex(0, "up", 1)).toBeNull();
    expect(getAdjacentIndex(0, "down", 1)).toBeNull();
  });

  it("never moves more than one place", () => {
    for (const index of [0, 1, 2, 3, 4]) {
      for (const direction of ANNOUNCEMENT_MOVE_DIRECTIONS) {
        const target = getAdjacentIndex(index, direction, 5);

        if (target !== null) {
          expect(Math.abs(target - index)).toBe(1);
        }
      }
    }
  });
});
