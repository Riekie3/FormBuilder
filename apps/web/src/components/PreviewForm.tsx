"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { FieldDto } from "@sfb/shared";
import { isComputedField, isFieldAnswerComplete, isFieldVisible, isLayoutField } from "@sfb/shared";
import { FormFieldRenderer } from "@/components/FormFieldRenderer";
import { evaluateFormula } from "@/lib/safeFormula";
import { splitIntoPages } from "@/lib/formPages";

interface Props {
  title: string;
  description?: string | null;
  fields: FieldDto[];
  mode?: "preview" | "live";
  onSubmit?: (answers: Record<string, string>) => Promise<void>;
  requiresApproval?: boolean;
  // Seeds the visitor's answers before they type anything — used by the
  // public form's URL query-string pre-fill (config.prefillKey matches).
  initialValues?: Record<string, string>;
}

// Renders a fillable form. In "preview" mode (used by the builder) submissions
// are not persisted; in "live" mode (the public /f/[slug] page) onSubmit posts
// the answers to the API. PAGE_BREAK fields split the field list into pages,
// shown one at a time with a progress bar; a form with none of those renders
// exactly as it did before multi-page support existed.
export function PreviewForm({
  title,
  description,
  fields,
  mode = "live",
  onSubmit,
  requiresApproval = false,
  initialValues,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useMemo(() => splitIntoPages(fields), [fields]);
  const isMultiPage = pages.length > 1;

  // Keep the current page in range if the field list shrinks out from under it.
  useEffect(() => {
    setPageIndex((i) => Math.min(i, pages.length - 1));
  }, [pages.length]);

  // Hidden fields carry a fixed value the visitor never sees or edits.
  useEffect(() => {
    setValues((prev) => {
      const updates: Record<string, string> = {};
      for (const f of fields) {
        if (f.type === "HIDDEN" && prev[f.id] === undefined) {
          updates[f.id] = f.config.defaultValue ?? "";
        }
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Recompute Calculation fields whenever an input changes. Only writes back
  // when a computed value actually differs from what's stored, so this
  // settles in one extra pass instead of looping forever.
  useEffect(() => {
    setValues((prev) => {
      const updates: Record<string, string> = {};
      for (const f of fields) {
        if (f.type !== "CALCULATION") continue;
        const computed = evaluateFormula(f.config.formula ?? "", prev, f.config.precision ?? 2);
        const computedStr = computed === null ? "" : String(computed);
        if (prev[f.id] !== computedStr) updates[f.id] = computedStr;
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, fields]);

  const currentPage = pages[pageIndex] ?? pages[0];
  const currentPageFields = currentPage.fields.filter((f) => isFieldVisible(f, values));

  function validatePage(index: number): boolean {
    const pageFieldIds = new Set(pages[index].fields.map((f) => f.id));
    const visible = pages[index].fields.filter((f) => isFieldVisible(f, values));
    const pageErrors: Record<string, string> = {};
    for (const f of visible) {
      if (isLayoutField(f.type) || isComputedField(f.type)) continue;
      if (f.required && !isFieldAnswerComplete(f, values[f.id])) {
        pageErrors[f.id] = "This field is required";
      }
    }
    setErrors((prev) => {
      const next = { ...prev };
      for (const id of pageFieldIds) delete next[id];
      return { ...next, ...pageErrors };
    });
    return Object.keys(pageErrors).length === 0;
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validatePage(pageIndex)) return;

    if (pageIndex < pages.length - 1) {
      setPageIndex((i) => i + 1);
      return;
    }

    if (mode === "preview") {
      window.alert("This is a live preview — submissions aren't saved.");
      return;
    }
    if (!onSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit the form");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="card p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Thanks!</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {requiresApproval
            ? "Your response has been recorded and is pending review."
            : "Your response has been recorded."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className="card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>

      {isMultiPage && (
        <div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>
              Page {pageIndex + 1} of {pages.length}
            </span>
            {currentPage.title && <span className="text-slate-500 dark:text-slate-300">{currentPage.title}</span>}
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <p className="text-sm text-slate-400">This form doesn&apos;t have any fields yet.</p>
      ) : (
        currentPageFields.map((field) => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
            error={errors[field.id]}
            allValues={values}
          />
        ))
      )}

      {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

      <div className="flex gap-3">
        {isMultiPage && pageIndex > 0 && (
          <button type="button" onClick={() => setPageIndex((i) => i - 1)} className="btn-secondary flex-1">
            Back
          </button>
        )}
        <button type="submit" disabled={submitting || fields.length === 0} className="btn-primary flex-1">
          {pageIndex < pages.length - 1 ? "Next" : submitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
  );
}
