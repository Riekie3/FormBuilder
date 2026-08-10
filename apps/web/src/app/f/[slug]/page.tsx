import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { PublicFormDto } from "@sfb/shared";
import { API_URL } from "@/lib/config";
import { PublicFormClient } from "@/components/PublicFormClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchForm(slug: string): Promise<PublicFormDto | null> {
  const res = await fetch(`${API_URL}/api/public/forms/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json();
  return body.form;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await fetchForm(slug);
  if (!form) return { title: "Form not found" };
  return {
    title: `${form.title} — Smart Form Builder`,
    description: form.description ?? `Fill out ${form.title}`,
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { slug } = await params;
  const form = await fetchForm(slug);
  if (!form) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/60 to-transparent px-4 py-12 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-xl">
        <Suspense fallback={null}>
          <PublicFormClient slug={slug} form={form} />
        </Suspense>
        <p className="mt-6 text-center text-xs text-slate-400">Built with Smart Form Builder</p>
      </div>
    </div>
  );
}
