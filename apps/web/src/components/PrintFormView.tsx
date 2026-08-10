import DOMPurify from "dompurify";
import type { FieldDto } from "@sfb/shared";
import { renderSafeMarkdown } from "@/lib/safeMarkdown";

interface Props {
  title: string;
  description?: string | null;
  fields: FieldDto[];
}

// A single ruled line a visitor can hand-write an answer on. Print-only
// pages have no interactive controls, so every "fillable" field reduces to
// some flavor of blank space plus, where relevant, markable options.
function BlankLine({ lines = 1 }: { lines?: number }) {
  return (
    <div className="mt-2 space-y-5">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-0 border-b border-slate-400" />
      ))}
    </div>
  );
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? <span className="ml-0.5 text-red-600">*</span> : null;
}

// Renders one field as its paper equivalent — a label plus whatever a
// visitor would mark or write by hand. Fields that only make sense with a
// live computation (Calculation) or that never carry visitor-facing content
// (Hidden) contribute nothing to a printed page.
function PrintField({ field }: { field: FieldDto }) {
  const helpText = field.config.helpText && (
    <p className="mt-0.5 text-xs text-slate-500">{field.config.helpText}</p>
  );

  const labelBlock = (
    <p className="text-sm font-medium text-slate-900">
      {field.label}
      <RequiredMark required={field.required} />
    </p>
  );

  switch (field.type) {
    case "HIDDEN":
    case "CALCULATION":
      return null;

    case "DIVIDER":
      return <hr className="border-slate-300" />;

    case "HEADING":
      return (
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{field.label}</h3>
          {helpText}
        </div>
      );

    case "SECTION":
      return (
        <div className="border-t border-slate-300 pt-4">
          <h3 className="text-base font-semibold text-slate-900">{field.label}</h3>
          {helpText}
        </div>
      );

    case "HTML_BLOCK":
      return (
        <div
          className="text-sm text-slate-700"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(field.config.htmlContent ?? "") }}
        />
      );

    case "RICH_TEXT":
      return (
        <div
          className="text-sm text-slate-700"
          dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(field.config.richText ?? "") }}
        />
      );

    case "PAGE_BREAK":
      // A literal page break on paper — inert on screen (nothing else in
      // this layout uses multi-column/paged flow), only takes effect when
      // the browser paginates for printing.
      return <div style={{ breakAfter: "page" }} />;

    case "PARAGRAPH":
      return (
        <div>
          {labelBlock}
          {helpText}
          <BlankLine lines={3} />
        </div>
      );

    case "DROPDOWN":
    case "RADIO":
      return (
        <div>
          {labelBlock}
          {helpText}
          <div className="mt-1.5 space-y-1">
            {field.config.options?.map((opt) => (
              <p key={opt.id} className="text-sm text-slate-700">
                <span className="mr-2 inline-block h-3 w-3 rounded-full border border-slate-500 align-middle" />
                {opt.label}
              </p>
            ))}
          </div>
        </div>
      );

    case "CHECKBOX":
      return (
        <div>
          {labelBlock}
          {helpText}
          <div className="mt-1.5 space-y-1">
            {field.config.options?.map((opt) => (
              <p key={opt.id} className="text-sm text-slate-700">
                <span className="mr-2 inline-block h-3 w-3 border border-slate-500 align-middle" />
                {opt.label}
              </p>
            ))}
          </div>
        </div>
      );

    case "ADDRESS":
      return (
        <div>
          {labelBlock}
          {helpText}
          <div className="mt-2 space-y-4 text-xs text-slate-500">
            {["Street address", "City", "State / Province", "ZIP / Postal code", "Country"].map((caption) => (
              <div key={caption}>
                <div className="h-0 border-b border-slate-400" />
                <p className="mt-0.5">{caption}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "RATING": {
      const max = field.config.maxRating ?? 5;
      return (
        <div>
          {labelBlock}
          {helpText}
          <p className="mt-1.5 text-xl tracking-widest text-slate-400">{"☆".repeat(max)}</p>
        </div>
      );
    }

    case "SIGNATURE":
      return (
        <div>
          {labelBlock}
          {helpText}
          <div className="mt-6 flex gap-8">
            <div className="flex-1">
              <div className="h-0 border-b border-slate-400" />
              <p className="mt-0.5 text-xs text-slate-500">Signature</p>
            </div>
            <div className="w-32">
              <div className="h-0 border-b border-slate-400" />
              <p className="mt-0.5 text-xs text-slate-500">Date</p>
            </div>
          </div>
        </div>
      );

    case "MATRIX": {
      const rows = field.config.matrixRows ?? [];
      const columns = field.config.matrixColumns ?? [];
      return (
        <div>
          {labelBlock}
          {helpText}
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-1.5 text-left" />
                {columns.map((col) => (
                  <th key={col.id} className="p-1.5 text-center text-xs font-medium text-slate-500">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="p-1.5 text-slate-700">{row.label}</td>
                  {columns.map((col) => (
                    <td key={col.id} className="p-1.5 text-center">
                      <span className="inline-block h-3 w-3 rounded-full border border-slate-500 align-middle" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "REPEATER": {
      const columns = field.config.repeaterColumns ?? [];
      const BLANK_ROWS = 4;
      return (
        <div>
          {labelBlock}
          {helpText}
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.id} className="border-b border-slate-400 p-1.5 text-left text-xs font-medium text-slate-500">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: BLANK_ROWS }, (_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.id} className="h-8 border-b border-slate-200 p-1.5" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // TEXT, EMAIL, NUMBER, PHONE, DATE and anything else fillable — a label
    // plus a single blank line is the right paper equivalent.
    default:
      return (
        <div>
          {labelBlock}
          {helpText}
          <BlankLine />
        </div>
      );
  }
}

// The printable, hand-fillable version of a form: every field renders as a
// blank to write on or an option to mark, with no interactive controls at
// all — meant to be printed and filled out with a pen, or scanned/emailed as
// a PDF for someone who can't use the live web form.
export function PrintFormView({ title, description, fields }: Props) {
  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-black print:p-0">
      <div className="border-b border-slate-300 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      <div className="mt-6 space-y-6">
        {fields.length === 0 ? (
          <p className="text-sm text-slate-400">This form doesn&apos;t have any fields yet.</p>
        ) : (
          fields.map((field) => <PrintField key={field.id} field={field} />)
        )}
      </div>
    </div>
  );
}
