import Image from "next/image";
import Link from "next/link";

type StoryBandProps = {
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageSrc: string;
  imageAlt: string;
  /** Which side the image takes on desktop. Alternating these builds the rhythm. */
  imageSide: "left" | "right";
};

export function StoryBand({
  eyebrow,
  headline,
  body,
  ctaLabel,
  ctaHref,
  imageSrc,
  imageAlt,
  imageSide,
}: StoryBandProps) {
  return (
    <section className="px-6 sm:px-10 lg:px-12">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
        {/* Ordering is set on the desktop breakpoint only, so the stacked
            mobile layout always leads with the image. */}
        <div
          className={`relative aspect-[4/5] w-full overflow-hidden sm:aspect-[3/2] lg:aspect-[4/5] ${
            imageSide === "right" ? "lg:order-2" : "lg:order-1"
          }`}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>

        <div
          className={`max-w-md ${
            imageSide === "right" ? "lg:order-1" : "lg:order-2"
          }`}
        >
          <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-500 sm:text-xs">
            {eyebrow}
          </p>
          <h2 className="mt-6 font-display text-4xl font-light leading-[1.12] text-stone-100 sm:text-5xl">
            {headline}
          </h2>
          <p className="mt-6 text-sm leading-8 text-stone-400 sm:text-base">
            {body}
          </p>
          <Link
            href={ctaHref}
            className="mt-8 inline-block border-b border-stone-600 pb-1 text-xs uppercase tracking-[0.28em] text-stone-200 transition-colors hover:border-stone-300 hover:text-white"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
