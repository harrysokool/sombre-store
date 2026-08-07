// Shown while `/shop` waits on Supabase and the promotion lookup. The route is
// `force-dynamic`, so without this the page holds a blank screen for the whole
// round trip.
//
// The measurements mirror `page.tsx` exactly — same section padding, same
// header rhythm, same divider, same grid and gutters, same 4/5 media ratio — so
// the real content lands on the skeleton rather than shifting it.

/** Fills the grid twice over on desktop and four rows deep on a phone. */
const SKELETON_TILES = 8;

// `motion-safe:` gates the pulse behind `prefers-reduced-motion: no-preference`,
// so a reader who has asked for less motion gets flat blocks instead.
const SHIMMER = "motion-safe:animate-pulse";

export default function ShopLoading() {
  return (
    <section className="px-4 py-12 sm:px-10 sm:py-16 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        {/* One announcement for assistive technology; the blocks themselves are
            decorative and would only read as noise. */}
        <p role="status" className="sr-only">
          Loading products
        </p>

        <div aria-hidden="true">
          {/* Header: eyebrow, title, description. */}
          <div className="mx-auto max-w-2xl">
            <div className={`mx-auto h-2 w-28 bg-stone-800 ${SHIMMER}`} />
            <div className={`mx-auto mt-5 h-9 w-64 bg-stone-800 ${SHIMMER}`} />
            <div className={`mx-auto mt-6 h-3 w-full bg-stone-900 ${SHIMMER}`} />
            <div
              className={`mx-auto mt-2.5 h-3 w-3/4 bg-stone-900 ${SHIMMER}`}
            />
          </div>

          {/* Category row over brand row, closed by the same divider. */}
          <div className="mt-10 border-b border-stone-800 pb-8 sm:mt-12 sm:pb-10">
            <div className="flex justify-start gap-8 sm:justify-center sm:gap-10">
              {[0, 1, 2, 3].map((key) => (
                <div
                  key={key}
                  className={`h-2.5 w-16 bg-stone-800 ${SHIMMER}`}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-start gap-6 sm:justify-center sm:gap-8">
              {[0, 1].map((key) => (
                <div
                  key={key}
                  className={`h-2.5 w-20 bg-stone-900 ${SHIMMER}`}
                />
              ))}
            </div>
          </div>

          {/* Same column counts and gutters as the real grid. */}
          <div className="mt-12 grid grid-cols-1 gap-x-2 gap-y-16 min-[360px]:grid-cols-2 sm:mt-14 sm:gap-x-4 sm:gap-y-20 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: SKELETON_TILES }, (_, index) => (
              <div key={index}>
                {/* Muted rather than the finished tile's white: eight white
                    panels would flare on a dark page before any product has
                    actually arrived. */}
                <div
                  className={`aspect-[4/5] bg-stone-900 ${SHIMMER}`}
                  data-testid="product-card-skeleton"
                />

                <div className="pt-5 sm:pt-6">
                  <div className={`mx-auto h-2 w-24 bg-stone-800 ${SHIMMER}`} />
                  <div
                    className={`mx-auto mt-3 h-4 w-36 bg-stone-800 ${SHIMMER}`}
                  />
                  <div
                    className={`mx-auto mt-3 h-3 w-full bg-stone-900 ${SHIMMER}`}
                  />
                  <div
                    className={`mx-auto mt-4 h-3 w-28 bg-stone-900 ${SHIMMER}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
