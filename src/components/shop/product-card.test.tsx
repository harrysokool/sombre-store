// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Forwards className and sizes, so the tile's layout choices (aspect ratio
// padding, sold-out dimming, and the responsive candidate hints) are all
// assertable from the rendered output.
vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    sizes,
  }: {
    alt: string;
    className?: string;
    sizes?: string;
  }) => (
    <span role="img" aria-label={alt} className={className} data-sizes={sizes} />
  ),
}));

import { ProductCard } from "./product-card";

const BASE_PROPS = {
  name: "Replica Jazz Club",
  slug: "replica-jazz-club",
  brandName: "Maison Margiela",
  priceDisplay: {
    kind: "single",
    formattedPrice: "HK$1,200.00",
  } as const,
  sizeLabel: "100 mL",
  notes: "Spiced warmth",
  stockQuantity: 5,
  imageAlt: "Replica Jazz Club bottle",
};

const PROMOTIONAL_PROPS = {
  ...BASE_PROPS,
  priceDisplay: {
    kind: "promotional",
    formattedRetailPrice: "HK$1,320.00",
    formattedPromotionalPrice: "HK$1,188.00",
    couponCode: "HAPPY2026",
  } as const,
};

/** The white photography panel that sets the tile's media ratio. */
function mediaPanel(container: HTMLElement) {
  const panel = container.querySelector("div.bg-white");

  if (!panel) {
    throw new Error("media panel not found");
  }

  return panel;
}

describe("product card media", () => {
  afterEach(() => {
    cleanup();
  });

  // Bottles are taller than they are wide, so the portrait box gives the
  // product more of the tile without widening the column.
  it("uses a portrait 4/5 media ratio rather than a square one", () => {
    const { container } = render(
      <ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />,
    );

    const panel = mediaPanel(container);

    expect(panel.className).toContain("aspect-[4/5]");
    expect(panel.className).not.toContain("aspect-square");
  });

  it("keeps the white photography panel", () => {
    const { container } = render(
      <ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />,
    );

    expect(mediaPanel(container).className).toContain("bg-white");
  });

  // Less padding is what actually enlarges the product: the box is unchanged,
  // the inset around the bottle shrinks.
  it("insets the image with the reduced padding at both steps", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    const image = screen.getByRole("img");

    expect(image.className).toContain("p-3");
    expect(image.className).toContain("sm:p-4");
    expect(image.className).not.toContain("p-5");
    expect(image.className).not.toContain("sm:p-7");
  });

  // The hints describe the 1 / 2 / 3 / 4 grid at its current gutters. If the
  // columns or gaps move and these do not, phones start downloading the wrong
  // candidate.
  it("describes the tile width for each column count", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    expect(screen.getByRole("img").getAttribute("data-sizes")).toBe(
      "(min-width: 1280px) 23vw, (min-width: 768px) 30vw, (min-width: 360px) 46vw, 85vw",
    );
  });

  it("keeps the whole card a single link to the product", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/products/replica-jazz-club");
    expect(links[0]).toHaveTextContent("Replica Jazz Club");
  });
});

describe("product card detail line", () => {
  afterEach(() => {
    cleanup();
  });

  it("merges the notes and the size into one line", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    expect(screen.getByText("Spiced warmth · 100 mL")).toBeInTheDocument();
    // No longer a row of its own.
    expect(screen.queryByText("100 mL")).toBeNull();
  });

  it("clamps the line so a long note cannot unbalance a row", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    expect(
      screen.getByText("Spiced warmth · 100 mL").className,
    ).toContain("line-clamp-2");
  });

  it("drops the separator when only the notes are present", () => {
    render(
      <ProductCard {...BASE_PROPS} sizeLabel={null} imageUrl="/bottle.jpg" />,
    );

    expect(screen.getByText("Spiced warmth")).toBeInTheDocument();
  });

  // Notes are authored as sentences, so mid-line the full stop reads as a stray
  // mark between the note and the size.
  it("drops a trailing full stop from the notes when a size follows", () => {
    render(
      <ProductCard
        {...BASE_PROPS}
        notes="Spiced warmth and polished woods."
        imageUrl="/bottle.jpg"
      />,
    );

    expect(
      screen.getByText("Spiced warmth and polished woods · 100 mL"),
    ).toBeInTheDocument();
  });

  it("keeps the full stop when the notes stand alone", () => {
    render(
      <ProductCard
        {...BASE_PROPS}
        notes="Spiced warmth and polished woods."
        sizeLabel={null}
        imageUrl="/bottle.jpg"
      />,
    );

    expect(
      screen.getByText("Spiced warmth and polished woods."),
    ).toBeInTheDocument();
  });

  it("drops the separator when only the size is present", () => {
    render(<ProductCard {...BASE_PROPS} notes={null} imageUrl="/bottle.jpg" />);

    expect(screen.getByText("100 mL")).toBeInTheDocument();
  });

  it("renders no line at all when neither is present", () => {
    render(
      <ProductCard
        {...BASE_PROPS}
        notes={null}
        sizeLabel={null}
        imageUrl="/bottle.jpg"
      />,
    );

    expect(screen.queryByText(/·/)).toBeNull();
  });
});

describe("product card text contrast", () => {
  afterEach(() => {
    cleanup();
  });

  // These classes carry a WCAG decision from the accessibility pass, not a
  // stylistic one: stone-500 fails against the near-black tile background.
  it("keeps the brand and the detail line off the failing low-contrast class", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    const brand = screen.getByText("Maison Margiela");
    const detail = screen.getByText("Spiced warmth · 100 mL");

    for (const el of [brand, detail]) {
      expect(el.className).not.toContain("text-stone-500");
      expect(el.className).toContain("text-stone-400");
    }
  });

  it("keeps the product name at its full-contrast class", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    expect(screen.getByText("Replica Jazz Club").className).toContain(
      "text-stone-100",
    );
  });

  it("keeps the missing-image placeholder on its original class, since it renders on a white tile", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl={null} />);

    const placeholder = screen.getByText("Image coming soon");
    // bg-white gives stone-500 ~4.8:1 here, so this one is correct as-is —
    // switching it to stone-400 would actually fail against a light tile.
    expect(placeholder.className).toContain("text-stone-500");
  });
});

describe("product card pricing", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the promotional pair through the card variant", () => {
    render(<ProductCard {...PROMOTIONAL_PROPS} imageUrl="/bottle.jpg" />);

    const retail = screen.getByText("HK$1,320.00");

    expect(retail.tagName).toBe("S");
    expect(retail.className).toContain("line-through");
    expect(
      screen.getByText("HK$1,188.00 w/ HAPPY2026"),
    ).toBeInTheDocument();
  });

  // The promotional figure is the line a customer acts on. In the two-column
  // mobile grid the tile is only ~150px wide, so it has to be held on one line.
  it("keeps the promotional price from wrapping", () => {
    render(<ProductCard {...PROMOTIONAL_PROPS} imageUrl="/bottle.jpg" />);

    expect(
      screen.getByText("HK$1,188.00 w/ HAPPY2026").className,
    ).toContain("whitespace-nowrap");
  });

  it("shows exactly two prices, never the normal selling price as a third", () => {
    const { container } = render(
      <ProductCard {...PROMOTIONAL_PROPS} imageUrl="/bottle.jpg" />,
    );

    expect(container.textContent?.match(/HK\$[\d,]+\.\d{2}/g)).toEqual([
      "HK$1,320.00",
      "HK$1,188.00",
    ]);
  });

  it("shows the single price alone when there is no promotion", () => {
    const { container } = render(
      <ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />,
    );

    expect(container.textContent?.match(/HK\$[\d,]+\.\d{2}/g)).toEqual([
      "HK$1,200.00",
    ]);
    expect(container.querySelector("s")).toBeNull();
    expect(container.textContent).not.toContain("HAPPY2026");
  });
});

describe("product card sold out behaviour", () => {
  afterEach(() => {
    cleanup();
  });

  it("badges the tile and replaces the price with the sold-out wording", () => {
    const { container } = render(
      <ProductCard
        {...PROMOTIONAL_PROPS}
        stockQuantity={0}
        imageUrl="/bottle.jpg"
      />,
    );

    // Once on the image badge, once where the price would be.
    expect(screen.getAllByText("Sold out")).toHaveLength(2);
    // No price is offered for something that cannot be bought.
    expect(container.textContent).not.toContain("HK$");
    expect(container.textContent).not.toContain("HAPPY2026");
  });

  it("dims the photography while it is sold out", () => {
    render(
      <ProductCard
        {...BASE_PROPS}
        stockQuantity={0}
        imageUrl="/bottle.jpg"
      />,
    );

    expect(screen.getByRole("img").className).toContain("opacity-60");
  });

  it("leaves the photography undimmed while it is in stock", () => {
    render(<ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />);

    expect(screen.getByRole("img").className).not.toContain("opacity-60");
  });
});
