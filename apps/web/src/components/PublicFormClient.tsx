"use client";

import type { PublicFormDto } from "@sfb/shared";
import { PreviewForm } from "@/components/PreviewForm";
import { API_URL } from "@/lib/config";

export function PublicFormClient({ slug, form }: { slug: string; form: PublicFormDto }) {
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
    <PreviewForm title={form.title} description={form.description} fields={form.fields} mode="live" onSubmit={handleSubmit} />
  );
}
