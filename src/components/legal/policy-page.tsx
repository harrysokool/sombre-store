import { BUSINESS_DETAILS } from "@/lib/legal/business-details";

export type PolicySection = {
  eyebrow: string;
  heading: string;
  paragraphs: string[];
};

type PolicyPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: PolicySection[];
};

export function PolicyPage({
  eyebrow,
  title,
  intro,
  sections,
}: PolicyPageProps) {
  return (
    <div className="overflow-hidden">
      <section className="px-6 py-20 sm:px-10 sm:py-28 lg:px-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-4xl font-medium leading-tight tracking-[0.08em] text-stone-100 sm:text-5xl">
            {title}
          </h1>
          <p className="max-w-2xl text-base leading-8 text-stone-400">
            {intro}
          </p>
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
            Last updated: {BUSINESS_DETAILS.lastUpdated}
          </p>
        </div>
      </section>

      {sections.map((section) => (
        <section
          key={section.heading}
          className="px-6 py-10 sm:px-10 sm:py-12 lg:px-12"
        >
          <div className="mx-auto grid w-full max-w-5xl gap-10 border-t border-white/10 pt-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.34em] text-stone-500">
                {section.eyebrow}
              </p>
              <h2 className="text-2xl font-medium tracking-[0.08em] text-stone-100 sm:text-3xl">
                {section.heading}
              </h2>
            </div>

            <div className="space-y-4">
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-2xl text-base leading-8 text-stone-400"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="px-6 pb-24 pt-10 sm:px-10 sm:pb-32 lg:px-12">
        <div className="mx-auto w-full max-w-5xl border-t border-white/10 pt-10">
          <p className="max-w-2xl text-sm leading-7 text-stone-500">
            Sombre is operated by {BUSINESS_DETAILS.legalName} (Business
            Registration Number {BUSINESS_DETAILS.registrationNumber}),{" "}
            {BUSINESS_DETAILS.address}. Questions about this policy can be sent
            to {BUSINESS_DETAILS.supportEmail}.
          </p>
        </div>
      </section>
    </div>
  );
}
