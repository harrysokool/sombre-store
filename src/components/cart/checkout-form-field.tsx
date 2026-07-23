type CheckoutFormFieldProps = {
  label: string;
  name: string;
  type: "email" | "tel" | "text";
  placeholder: string;
  required?: boolean;
  defaultValue?: string;
  readOnly?: boolean;
  className?: string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  /** Id of a help message this input is described by, if any. */
  describedBy?: string;
};

// Text inputs match :focus-visible whenever focused, so the ring shows for both
// keyboard and pointer focus — a clear, consistent focus state either way.
const inputClassName =
  "w-full rounded-lg border border-white/15 bg-transparent px-4 py-3.5 text-sm text-stone-100 outline-none transition-colors placeholder:text-stone-600 hover:border-white/25 focus-visible:border-white/40 focus-visible:ring-1 focus-visible:ring-stone-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 read-only:cursor-default read-only:border-white/10 read-only:text-stone-400 read-only:hover:border-white/10";

export function CheckoutFormField({
  label,
  name,
  type,
  placeholder,
  required = false,
  defaultValue,
  readOnly = false,
  className = "space-y-2.5",
  maxLength,
  autoComplete,
  inputMode,
  describedBy,
}: CheckoutFormFieldProps) {
  return (
    <label className={className}>
      <span className="text-[0.65rem] uppercase tracking-[0.22em] text-stone-500">
        {label}
        {/* Required is announced by the input's `required` attribute, so the
            asterisk is decorative; optional status has no such attribute, so its
            label text is left visible to assistive tech. */}
        {required ? (
          <span aria-hidden="true" className="text-stone-400">
            {" "}
            *
          </span>
        ) : (
          <span className="text-stone-600"> (optional)</span>
        )}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        readOnly={readOnly}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-describedby={describedBy}
        className={inputClassName}
        placeholder={placeholder}
      />
    </label>
  );
}
