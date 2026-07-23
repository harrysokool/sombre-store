import { getImageProps } from "next/image";
import Link from "next/link";

type CampaignHeroProps = {
    eyebrow: string;
    headline: string;
    ctaLabel: string;
    ctaHref: string;
};

// Art direction rather than one responsive crop: a landscape frame holds the
// composition on desktop, while a portrait frame keeps the subject filling a
// phone screen. A native <picture> with a media source lets the browser choose
// and download only the crop that matches the viewport — so a single hero image
// is fetched, not both — while getImageProps keeps Next.js' optimized,
// responsive srcSet and quality.
const DESKTOP_IMAGE = {
    src: "/images/products/maison-margiela/model-1.jpg",
    alt: "Sombre fragrance campaign portrait",
};

const MOBILE_IMAGE = {
    src: "/images/products/maison-margiela/model-3.jpg",
    alt: "Sombre fragrance campaign portrait",
};

// The layout below switches artwork at the sm breakpoint, so the desktop source
// applies from 640px up and the <img> fallback serves narrower (mobile) screens.
const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";

export function CampaignHero({
    eyebrow,
    headline,
    ctaLabel,
    ctaHref,
}: CampaignHeroProps) {
    const commonImageProps = {
        fill: true,
        sizes: "100vw",
        // Keeps the hero as a high-priority (LCP) fetch that starts early,
        // without emitting a preload for the hidden crop.
        priority: true,
    } as const;

    const {
        props: { srcSet: desktopSrcSet },
    } = getImageProps({
        ...commonImageProps,
        src: DESKTOP_IMAGE.src,
        alt: DESKTOP_IMAGE.alt,
    });

    const { props: mobileImageProps } = getImageProps({
        ...commonImageProps,
        src: MOBILE_IMAGE.src,
        alt: MOBILE_IMAGE.alt,
    });

    return (
        // Pulled up under the transparent header, then padded back so the copy
        // never collides with the bar.
        <section className="relative -mt-20 flex min-h-[100svh] items-end overflow-hidden pt-20">
            <div className="absolute inset-0">
                <picture>
                    <source
                        media={DESKTOP_MEDIA_QUERY}
                        srcSet={desktopSrcSet}
                        sizes="100vw"
                    />
                    <img
                        {...mobileImageProps}
                        alt={MOBILE_IMAGE.alt}
                        fetchPriority="high"
                        className="object-cover object-center"
                    />
                </picture>
            </div>

            {/* Darkened top and bottom only: the centre of the image stays clean. */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

            <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20 text-center sm:px-10 sm:pb-28">
                <p className="text-[0.65rem] uppercase tracking-[0.42em] text-stone-300/90 sm:text-xs">
                    {eyebrow}
                </p>
                <h1 className="mt-6 font-display text-[2.6rem] font-light leading-[1.08] tracking-[0.02em] text-white sm:text-6xl lg:text-[4.25rem]">
                    {headline}
                </h1>
                <Link
                    href={ctaHref}
                    className="mt-9 inline-block border-b border-white/50 pb-1 text-xs uppercase tracking-[0.28em] text-white transition-colors hover:border-white"
                >
                    {ctaLabel}
                </Link>
            </div>
        </section>
    );
}
