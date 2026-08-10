"use client";

import { useSearchParams } from "next/navigation";
import type { PublicFormDto } from "@sfb/shared";
import { PreviewForm } from "@/components/PreviewForm";
import { API_URL } from "@/lib/config";

export function PublicFormClient({ slug, form }: { slug: string; form: PublicFormDto }) {
  const searchParams = useSearchParams();

  // Pre-fills any field whose config.prefillKey matches a query-string
  // param, e.g. a field with prefillKey "ref" gets pre-filled by
  // /f/slug?ref=newsletter. Fields without a configured key are untouched.
  const initialValues: Record<string, string> = {};
  for (const field of form.fields) {
    const key = field.config.prefillKey;
    if (!key) continue;
    const value = searchParams.get(key);
    if (value !== null) initialValues[field.id] = value;
  }

  async function handleSubmit(answers: Record<string, string>) {
    const res = await fetch(`${API_URL}/api/public/forms/${slug}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.entries(answers).map(([fieldId, value]) => ({ fieldId, value })),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't submit the form");
    }
  }

  return (
    <PreviewForm
      title={form.title}
      description={form.description}
      fields={form.fields}
      mode="live"
      onSubmit={handleSubmit}
      requiresApproval={form.requiresApproval}
      initialValues={initialValues}
    />
  );
}
