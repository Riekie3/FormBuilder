"use client";

import DOMPurify from "dompurify";
import { Plus, Trash2 } from "lucide-react";
import type { FieldDto } from "@sfb/shared";
import { pipeAnswers } from "@/lib/answerPiping";
import { renderSafeMarkdown } from "@/lib/safeMarkdown";
import { SignaturePad } from "@/components/SignaturePad";

interface Props {
  field: FieldDto;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  // Every field's current answer, keyed by fieldId — lets a later field's
  // label/help text/content pipe in an earlier answer via a "{fieldId}"
  // token. Omitted (e.g. the builder canvas's static preview) means no
  // answers exist yet, so tokens simply pipe in as empty.
  allValues?: Record<string, string>;
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

function parseMatrix(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function parseRepeaterRows(raw: string): Record<string, string>[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Shared between the builder's live preview and the public form renderer so
// field behavior never drifts between "what you designed" and "what visitors see".
export function FormFieldRenderer({ field, value, onChange, error, disabled, allValues = {} }: Props) {
  const pipedLabel = pipeAnswers(field.label, allValues);
  const pipedHelpText = field.config.helpText ? pipeAnswers(field.config.helpText, allValues) : undefined;

  const baseLabel = (
    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {pipedLabel}
      {field.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );

  const helpText = pipedHelpText && <p className="mt-1 text-xs text-slate-400">{pipedHelpText}</p>;

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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{pipedLabel}</h3>
          {helpText}
        </div>
      );

    case "SECTION":
      // A visual grouping marker, not a standalone heading — the top
      // border reads as "a new group starts here" so a Section is
      // distinguishable from a plain Heading at a glance.
      return (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{pipedLabel}</h3>
          {helpText}
        </div>
      );

    case "HTML_BLOCK":
      return (
        <div
          className="text-sm text-slate-700 dark:text-slate-300"
          // Piped first, then sanitized — field.config.htmlContent is
          // untrusted (authored by whoever built the form) until DOMPurify
          // has run, regardless of what got substituted into it.
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(pipeAnswers(field.config.htmlContent ?? "", allValues)),
          }}
        />
      );

    case "RICH_TEXT":
      return (
        <div
          className="text-sm text-slate-700 dark:text-slate-300"
          dangerouslySetInnerHTML={{
            __html: renderSafeMarkdown(pipeAnswers(field.config.richText ?? "", allValues)),
          }}
        />
      );

    case "HIDDEN":
      // Carries a fixed value along with the submission without being shown.
      return null;

    case "PAGE_BREAK":
      // Only ever reached from the builder's flat canvas list — the actual
      // paginated renderers (PreviewForm) consume this as a page separator
      // and never include it in a page's own field list.
      return (
        <div className="flex items-center gap-2 py-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
          <span className="h-px flex-1 bg-brand-200 dark:bg-brand-900" />
          Page break{field.label ? ` — ${field.label}` : ""}
          <span className="h-px flex-1 bg-brand-200 dark:bg-brand-900" />
        </div>
      );

    // --- Interactive fields ---
    case "PARAGRAPH":
      return wrap(
        <textarea
          className="input-field min-h-[100px]"
          placeholder={field.config.placeholder}
          value={value}
          maxLength={field.config.maxLength}
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
      // type="text" + inputMode="email" rather than type="email": the
      // latter's native format validation blocks the whole form's submit
      // event silently (no visible error, no request sent) before our own
      // custom validation ever runs — inputMode alone still gives mobile
      // browsers the "@"-key email keyboard, with none of that.
      return wrap(
        <input
          type="text"
          inputMode="email"
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

    case "MATRIX": {
      const rows = field.config.matrixRows ?? [];
      const columns = field.config.matrixColumns ?? [];
      const answers = parseMatrix(value);
      const setRow = (rowId: string, columnValue: string) => onChange(JSON.stringify({ ...answers, [rowId]: columnValue }));
      return wrap(
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left" />
                {columns.map((col) => (
                  <th key={col.id} className="p-2 text-center font-medium text-slate-500 dark:text-slate-400">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2 text-slate-700 dark:text-slate-300">{row.label}</td>
                  {columns.map((col) => (
                    <td key={col.id} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`${field.id}-${row.id}`}
                        checked={answers[row.id] === col.value}
                        disabled={disabled}
                        onChange={() => setRow(row.id, col.value)}
                        className="h-4 w-4 accent-brand-500"
                        aria-label={`${row.label}: ${col.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }

    case "REPEATER": {
      const columns = field.config.repeaterColumns ?? [];
      const rows = parseRepeaterRows(value);
      const setCell = (rowIndex: number, columnId: string, cellValue: string) => {
        const next = rows.map((row, i) => (i === rowIndex ? { ...row, [columnId]: cellValue } : row));
        onChange(JSON.stringify(next));
      };
      const addRow = () => onChange(JSON.stringify([...rows, {}]));
      const removeRow = (rowIndex: number) => onChange(JSON.stringify(rows.filter((_, i) => i !== rowIndex)));
      return wrap(
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse text-sm">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.id} className="p-2 text-left font-medium text-slate-500 dark:text-slate-400">
                      {col.label}
                    </th>
                  ))}
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {columns.map((col) => (
                      <td key={col.id} className="p-1">
                        <input
                          className="input-field"
                          value={row[col.id] ?? ""}
                          disabled={disabled}
                          onChange={(e) => setCell(i, col.id, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => removeRow(i)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        aria-label="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={disabled} onClick={addRow} className="btn-secondary text-xs">
            <Plus size={14} /> Add row
          </button>
        </div>,
      );
    }

    case "TEXT":
    default:
      return wrap(
        <input
          type="text"
          className="input-field"
          placeholder={field.config.placeholder}
          value={value}
          maxLength={field.config.maxLength}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />,
      );
  }
}
