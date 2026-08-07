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

// Forwards className, sizes, src, and aria-hidden, so the tile's layout choices
// (aspect ratio padding, sold-out dimming, the responsive candidate hints, and
// which image is exposed to assistive technology) are all assertable from the
// rendered output.
//
// `aria-label` is left off for an empty alt, so a decorative layer behaves here
// the way a real `<img alt="">` behaves: present in the DOM, absent from the
// accessibility tree once `aria-hidden` is applied.
vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    sizes,
    src,
    "aria-hidden": ariaHidden,
  }: {
    alt: string;
    className?: string;
    sizes?: string;
    src?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }) => (
    <span
      role="img"
      aria-label={alt || undefined}
      aria-hidden={ariaHidden}
      className={className}
      data-sizes={sizes}
      data-src={src}
    />
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
      "(min-width: 1280px) 23vw, (min-width: 768px) 30vw, (min-width: 360px) 47vw, 90vw",
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

describe("product card hover image", () => {
  afterEach(() => {
    cleanup();
  });

  /** Every image layer in the tile, in DOM order. */
  function imageLayers(container: HTMLElement) {
    return [...container.querySelectorAll("[data-src]")];
  }

  describe("a product with only one image", () => {
    it("renders a single image layer", () => {
      const { container } = render(
        <ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />,
      );

      const layers = imageLayers(container);

      expect(layers).toHaveLength(1);
      expect(layers[0]).toHaveAttribute("data-src", "/bottle.jpg");
    });

    it("renders a single layer when the hover image is explicitly absent", () => {
      const { container } = render(
        <ProductCard
          {...BASE_PROPS}
          imageUrl="/bottle.jpg"
          hoverImageUrl={null}
        />,
      );

      expect(imageLayers(container)).toHaveLength(1);
    });

    // The whole point of the fallback: nothing about a one-image tile changes.
    it("keeps the original transform-only transition on the image", () => {
      const { container } = render(
        <ProductCard {...BASE_PROPS} imageUrl="/bottle.jpg" />,
      );

      const primary = imageLayers(container)[0];

      expect(primary.className).toContain("transition-transform");
      expect(primary.className).toContain("duration-700");
      // No fade-out, because there is nothing to fade to.
      expect(primary.className).not.toContain("opacity-0");
      expect(primary.className).not.toContain("group-hover:opacity");
    });

    it("still renders nothing but the placeholder when there is no image at all", () => {
      const { container } = render(
        <ProductCard
          {...BASE_PROPS}
          imageUrl={null}
          hoverImageUrl="/second.jpg"
        />,
      );

      // A product with no primary image does not get to hover-reveal a second.
      expect(imageLayers(container)).toHaveLength(0);
      expect(screen.getByText("Image coming soon")).toBeInTheDocument();
    });
  });

  describe("a product with two images", () => {
    const TWO_IMAGES = {
      ...BASE_PROPS,
      imageUrl: "/bottle.jpg",
      hoverImageUrl: "/bottle-detail.jpg",
    };

    it("renders the primary first and the hover image second", () => {
      const { container } = render(<ProductCard {...TWO_IMAGES} />);

      const layers = imageLayers(container);

      expect(layers).toHaveLength(2);
      expect(layers[0]).toHaveAttribute("data-src", "/bottle.jpg");
      expect(layers[1]).toHaveAttribute("data-src", "/bottle-detail.jpg");
    });

    // At rest the tile looks exactly like a one-image tile.
    it("leaves the hover image invisible until hovered", () => {
      const { container } = render(<ProductCard {...TWO_IMAGES} />);

      expect(imageLayers(container)[1].className).toContain("opacity-0");
    });

    it("crossfades the pair on pointer hover", () => {
      const { container } = render(<ProductCard {...TWO_IMAGES} />);

      const [primary, hover] = imageLayers(container);

      expect(primary.className).toContain("md:group-hover:opacity-0");
      expect(hover.className).toContain("md:group-hover:opacity-100");
    });

    it("transitions opacity as well as the zoom", () => {
      const { container } = render(<ProductCard {...TWO_IMAGES} />);

      for (const layer of imageLayers(container)) {
        expect(layer.className).toContain("transition-[opacity,transform]");
        expect(layer.className).toContain("duration-700");
      }
    });

    // Same `md:` gate as the zoom beside it, so a phone never swaps the image.
    it("gates the swap behind the desktop breakpoint", () => {
      const { container } = render(<ProductCard {...TWO_IMAGES} />);

      for (const layer of imageLayers(container)) {
        for (const cls of layer.className.split(/\s+/)) {
          if (cls.includes("group-hover:opacity")) {
            expect(cls).toContain("md:");
          }
        }
      }
    });

    it("gives both layers the same fit, inset, and candidate hints", () => {
      const { container } = render(<ProductCard {...TWO_IMAGES} />);

      for (const layer of imageLayers(container)) {
        expect(layer.className).toContain("object-contain");
        expect(layer.className).toContain("p-3");
        expect(layer.className).toContain("sm:p-4");
        expect(layer).toHaveAttribute(
          "data-sizes",
          "(min-width: 1280px) 23vw, (min-width: 768px) 30vw, (min-width: 360px) 47vw, 90vw",
        );
      }
    });
  });

  describe("reduced motion", () => {
    // With less motion asked for, the reveal simply never fires and the reader
    // keeps the primary image, held still.
    it("gates every hover reveal behind the reduced-motion preference", () => {
      const { container } = render(
        <ProductCard
          {...BASE_PROPS}
          imageUrl="/bottle.jpg"
          hoverImageUrl="/bottle-detail.jpg"
        />,
      );

      const revealClasses = [
        ...container.querySelectorAll("[data-src]"),
      ].flatMap((layer) =>
        layer.className.split(/\s+/).filter((cls) => cls.includes("opacity")),
      );

      const hoverReveals = revealClasses.filter((cls) =>
        cls.includes("group-hover:"),
      );

      expect(hoverReveals.length).toBeGreaterThan(0);
      for (const cls of hoverReveals) {
        expect(cls).toContain("motion-safe:");
      }
    });
  });

  describe("accessibility", () => {
    // The tile already names the product; announcing a second image of it adds
    // nothing a screen reader user can act on.
    it("exposes only the primary image to assistive technology", () => {
      render(
        <ProductCard
          {...BASE_PROPS}
          imageUrl="/bottle.jpg"
          hoverImageUrl="/bottle-detail.jpg"
        />,
      );

      const announced = screen.getAllByRole("img");

      expect(announced).toHaveLength(1);
      expect(announced[0]).toHaveAccessibleName("Replica Jazz Club bottle");
    });

    it("hides the hover layer rather than leaving it unlabelled", () => {
      const { container } = render(
        <ProductCard
          {...BASE_PROPS}
          imageUrl="/bottle.jpg"
          hoverImageUrl="/bottle-detail.jpg"
        />,
      );

      const hover = container.querySelector('[data-src="/bottle-detail.jpg"]');

      expect(hover).toHaveAttribute("aria-hidden", "true");
      expect(hover).not.toHaveAttribute("aria-label");
    });

    it("leaves the card a single focusable link", () => {
      render(
        <ProductCard
          {...BASE_PROPS}
          imageUrl="/bottle.jpg"
          hoverImageUrl="/bottle-detail.jpg"
        />,
      );

      const links = screen.getAllByRole("link");

      expect(links).toHaveLength(1);
      expect(links[0].className).toContain("focus-visible:ring-1");
    });
  });

  describe("sold out with two images", () => {
    const SOLD_OUT = {
      ...BASE_PROPS,
      stockQuantity: 0,
      imageUrl: "/bottle.jpg",
      hoverImageUrl: "/bottle-detail.jpg",
    };

    it("still badges the tile", () => {
      render(<ProductCard {...SOLD_OUT} />);

      expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
    });

    it("dims the primary image as before", () => {
      const { container } = render(<ProductCard {...SOLD_OUT} />);

      expect(imageLayers(container)[0].className).toContain("opacity-60");
    });

    // Without this the tile would brighten under the pointer as it swapped.
    it("carries the dimming across to the hover image", () => {
      const { container } = render(<ProductCard {...SOLD_OUT} />);

      const hover = imageLayers(container)[1];

      expect(hover.className).toContain("md:group-hover:opacity-60");
      expect(hover.className).not.toContain("md:group-hover:opacity-100");
    });
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

describe("product card vertical alignment", () => {
  afterEach(() => {
    cleanup();
  });

  /** The `<h2>` carrying the product name. */
  function nameHeading(container: HTMLElement) {
    const heading = container.querySelector("h2");

    if (!heading) {
      throw new Error("product name heading not found");
    }

    return heading;
  }

  // Two lines maximum, so a long name cannot run away down the tile.
  it("clamps the product name to two lines", () => {
    const { container } = render(
      <ProductCard
        {...BASE_PROPS}
        name="Replica When The Rain Stops Eau de Toilette"
        imageUrl="/bottle.jpg"
      />,
    );

    expect(nameHeading(container).className).toContain("line-clamp-2");
  });

  // ...and two lines minimum, which is the half that actually does the
  // aligning: a one-line name reserves the row a two-line name would need.
  it("reserves two lines of height for a one-line name", () => {
    const { container } = render(
      <ProductCard {...BASE_PROPS} name="Jazz Club" imageUrl="/bottle.jpg" />,
    );

    expect(nameHeading(container).className).toContain("min-h-[2lh]");
  });

  it("gives a short name and a wrapping name the same reserved box", () => {
    const short = render(
      <ProductCard {...BASE_PROPS} name="Jazz Club" imageUrl="/bottle.jpg" />,
    );
    const long = render(
      <ProductCard
        {...BASE_PROPS}
        name="Replica Lazy Sunday Morning"
        imageUrl="/bottle.jpg"
      />,
    );

    // jsdom does not lay out, so the guarantee is asserted as the shared
    // clamp-plus-floor contract rather than as a measured pixel height.
    expect(nameHeading(short.container).className).toBe(
      nameHeading(long.container).className,
    );
  });

  // The detail slot is always rendered, empty or not, for the same reason: a
  // product with no notes must not pull its price up past its neighbours'.
  it("keeps the detail slot present and reserved even with nothing to show", () => {
    const { container } = render(
      <ProductCard
        {...BASE_PROPS}
        notes={null}
        sizeLabel={null}
        imageUrl="/bottle.jpg"
      />,
    );

    const detailSlot = container.querySelector("p.line-clamp-2");

    expect(detailSlot).not.toBeNull();
    expect(detailSlot?.className).toContain("min-h-[2lh]");
    expect(detailSlot?.textContent).toBe("");
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
