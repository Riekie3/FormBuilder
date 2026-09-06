"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicFormDto } from "@sfb/shared";
import { PreviewForm } from "@/components/PreviewForm";
import { API_URL } from "@/lib/config";

export function PublicFormClient({ slug, form }: { slug: string; form: PublicFormDto }) {
  const searchParams = useSearchParams();
  const resumeToken = searchParams.get("resume");

  const [draftAnswers, setDraftAnswers] = useState<Record<string, string> | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(!!resumeToken);
  const [draftLoadError, setDraftLoadError] = useState(false);

  // A resume link's draft is fetched once on load — PreviewForm only reads
  // initialValues at mount (a lazy useState initializer), so this has to
  // resolve before it renders, not update it afterward.
  useEffect(() => {
    if (!resumeToken) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`${API_URL}/api/public/forms/${slug}/draft/${resumeToken}`);
      if (cancelled) return;
      if (res.ok) {
        const body = await res.json();
        setDraftAnswers(body.answers);
      } else {
        setDraftLoadError(true);
      }
      setLoadingDraft(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeToken, slug]);

  // Pre-fills any field whose config.prefillKey matches a query-string
  // param, e.g. a field with prefillKey "ref" gets pre-filled by
  // /f/slug?ref=newsletter. A resumed draft's own answers take priority.
  const initialValues: Record<string, string> = {};
  for (const field of form.fields) {
    const key = field.config.prefillKey;
    if (!key) continue;
    const value = searchParams.get(key);
    if (value !== null) initialValues[field.id] = value;
  }
  Object.assign(initialValues, draftAnswers ?? {});

  async function handleSubmit(answers: Record<string, string>, submissionResumeToken: string | null) {
    const res = await fetch(`${API_URL}/api/public/forms/${slug}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.entries(answers).map(([fieldId, value]) => ({ fieldId, value })),
        resumeToken: submissionResumeToken ?? undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't submit the form");
    }
  }

  async function handleSaveDraft(answers: Record<string, string>, token: string | null) {
    const res = await fetch(`${API_URL}/api/public/forms/${slug}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token ?? undefined,
        answers: Object.entries(answers).map(([fieldId, value]) => ({ fieldId, value })),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Couldn't save your progress");
    }
    const body = await res.json();
    return { token: body.token as string, link: `${window.location.origin}/f/${slug}?resume=${body.token}` };
  }

  if (loadingDraft) {
    return (
      <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading your saved progress...
      </div>
    );
  }

  return (
    <>
      {draftLoadError && (
        <p className="mb-3 text-center text-xs text-amber-600 dark:text-amber-400">
          That saved link couldn&apos;t be found — starting fresh.
        </p>
      )}
      <PreviewForm
        title={form.title}
        description={form.description}
        fields={form.fields}
        mode="live"
        onSubmit={handleSubmit}
        requiresApproval={form.requiresApproval}
        initialValues={initialValues}
        initialResumeToken={draftLoadError ? null : resumeToken}
        onSaveDraft={handleSaveDraft}
        oneQuestionPerPage={form.oneQuestionPerPage}
        lookupDatasets={form.lookupDatasets}
      />
    </>
  );
}
