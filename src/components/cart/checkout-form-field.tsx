type CheckoutFormFieldProps = {
  label: string;
  name: string;
  type: "email" | "tel" | "text";
  placeholder: string;
  required?: boolean;
  defaultValue?: string;
  readOnly?: boolean;
  className?: string;
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
}: CheckoutFormFieldProps) {
  return (
    <label className={className}>
      <span className="text-[0.65rem] uppercase tracking-[0.22em] text-stone-500">
        {label}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={inputClassName}
        placeholder={placeholder}
      />
    </label>
  );
}
