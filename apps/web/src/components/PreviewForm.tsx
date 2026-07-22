"use client";

import { FormEvent, useState } from "react";
import type { FieldDto } from "@sfb/shared";
import { FormFieldRenderer } from "@/components/FormFieldRenderer";

interface Props {
  title: string;
  description?: string | null;
  fields: FieldDto[];
  mode?: "preview" | "live";
  onSubmit?: (answers: Record<string, string>) => Promise<void>;
}

// Renders a fillable form. In "preview" mode (used by the builder) submissions
// are not persisted; in "live" mode (the public /f/[slug] page) onSubmit posts
// the answers to the API.
export function PreviewForm({ title, description, fields, mode = "live", onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !values[f.id]?.trim()) {
        nextErrors[f.id] = "This field is required";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

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
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your response has been recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-slate-400">This form doesn&apos;t have any fields yet.</p>
      ) : (
        fields.map((field) => (
          <FormFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
            error={errors[field.id]}
          />
        ))
      )}

      {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

      <button type="submit" disabled={submitting || fields.length === 0} className="btn-primary w-full">
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
