"use client";

import DOMPurify from "dompurify";
import type { FieldDto } from "@sfb/shared";
import { renderSafeMarkdown } from "@/lib/safeMarkdown";
import { SignaturePad } from "@/components/SignaturePad";

interface Props {
  field: FieldDto;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

interface AddressValue {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

function parseAddress(raw: string): AddressValue {
  if (!raw) return { street: "", city: "", state: "", zip: "", country: "" };
  try {
    return { street: "", city: "", state: "", zip: "", country: "", ...JSON.parse(raw) };
  } catch {
    return { street: "", city: "", state: "", zip: "", country: "" };
  }
}

// Shared between the builder's live preview and the public form renderer so
// field behavior never drifts between "what you designed" and "what visitors see".
export function FormFieldRenderer({ field, value, onChange, error, disabled }: Props) {
  const baseLabel = (
    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {field.label}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  const helpText = field.config.helpText && (
    <p className="mt-1 text-xs text-slate-400">{field.config.helpText}</p>
  );

  const errorText = error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>;

  const wrap = (control: React.ReactNode) => (
    <div>
      {baseLabel}
      {control}
      {helpText}
      {errorText}
    </div>
  );

  switch (field.type) {
    // --- Pure layout/content blocks — no input, no label/required semantics ---
    case "DIVIDER":
      return <hr className="border-slate-200 dark:border-slate-800" />;

    case "HEADING":
      return (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{field.label}</h3>
          {helpText}
        </div>
      );

    case "HTML_BLOCK":
      return (
        <div
          className="text-sm text-slate-700 dark:text-slate-300"
          // Sanitized at render time — field.config.htmlContent is untrusted
          // (authored by whoever built the form) until DOMPurify has run.
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(field.config.htmlContent ?? "") }}
        />
      );

    case "RICH_TEXT":
      return (
        <div
          className="text-sm text-slate-700 dark:text-slate-300"
          dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(field.config.richText ?? "") }}
        />
      );

    case "HIDDEN":
      // Carries a fixed value along with the submission without being shown.
      return null;

    // --- Interactive fields ---
    case "PARAGRAPH":
      return wrap(
        <textarea
          className="input-field min-h-[100px]"
          placeholder={field.config.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "DROPDOWN":
      return wrap(
        <select
          className="input-field"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select an option...</option>
          {field.config.options?.map((opt) => (
            <option key={opt.id} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>,
      );

    case "RADIO":
      return wrap(
        <div className="space-y-2">
          {field.config.options?.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                checked={value === opt.value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="h-4 w-4 accent-brand-500"
              />
              {opt.label}
            </label>
          ))}
        </div>,
      );

    case "CHECKBOX": {
      const selected = new Set(value ? value.split(",") : []);
      return wrap(
        <div className="space-y-2">
          {field.config.options?.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                disabled={disabled}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(opt.value);
                  else next.delete(opt.value);
                  onChange([...next].join(","));
                }}
                className="h-4 w-4 rounded accent-brand-500"
              />
              {opt.label}
            </label>
          ))}
        </div>,
      );
    }

    case "NUMBER":
      return wrap(
        <input
          type="number"
          className="input-field"
          placeholder={field.config.placeholder}
          value={value}
          min={field.config.min}
          max={field.config.max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "DATE":
      return wrap(
        <input
          type="date"
          className="input-field"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "EMAIL":
      return wrap(
        <input
          type="email"
          className="input-field"
          placeholder={field.config.placeholder ?? "you@example.com"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "PHONE":
      return wrap(
        <input
          type="tel"
          className="input-field"
          placeholder={field.config.placeholder ?? "+1 555 123 4567"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "ADDRESS": {
      const addr = parseAddress(value);
      const set = (patch: Partial<AddressValue>) => onChange(JSON.stringify({ ...addr, ...patch }));
      return wrap(
        <div className="space-y-2">
          <input
            className="input-field"
            placeholder="Street address"
            value={addr.street}
            disabled={disabled}
            onChange={(e) => set({ street: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field"
              placeholder="City"
              value={addr.city}
              disabled={disabled}
              onChange={(e) => set({ city: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="State / Province"
              value={addr.state}
              disabled={disabled}
              onChange={(e) => set({ state: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-field"
              placeholder="ZIP / Postal code"
              value={addr.zip}
              disabled={disabled}
              onChange={(e) => set({ zip: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Country"
              value={addr.country}
              disabled={disabled}
              onChange={(e) => set({ country: e.target.value })}
            />
          </div>
        </div>,
      );
    }

    case "RATING": {
      const max = field.config.maxRating ?? 5;
      const current = Number(value) || 0;
      return wrap(
        <div className="flex gap-1">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(String(n))}
              aria-label={`Rate ${n} out of ${max}`}
              className={`text-2xl leading-none transition ${n <= current ? "text-amber-400" : "text-slate-300 dark:text-slate-700"} ${disabled ? "" : "hover:text-amber-400"}`}
            >
              ★
            </button>
          ))}
        </div>,
      );
    }

    case "SIGNATURE":
      return wrap(<SignaturePad value={value} onChange={onChange} disabled={disabled} />);

    case "CALCULATION":
      return wrap(
        <div className="input-field bg-slate-50 font-medium text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {value || "0"}
        </div>,
      );

    case "TEXT":
    default:
      return wrap(
        <input
          type="text"
          className="input-field"
          placeholder={field.config.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
  }
}
