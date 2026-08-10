"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { FormDetailDto } from "@sfb/shared";
import { AuthGate } from "@/components/AuthGate";
import { PrintFormView } from "@/components/PrintFormView";
import { useAuth } from "@/context/AuthContext";

function PrintContent() {
  const params = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [form, setForm] = useState<FormDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/forms/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Couldn't load this form");
        const body = await res.json();
        if (!cancelled) setForm(body.form);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load this form");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, params.id]);

  if (error) {
    return <p className="p-10 text-sm text-red-600">{error}</p>;
  }
  if (!form) {
    return <p className="p-10 text-sm text-slate-500">Loading form...</p>;
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:bg-white print:py-0 dark:print:bg-white">
      <div className="mx-auto mb-6 flex max-w-2xl items-center justify-between print:hidden">
        <Link href={`/dashboard/forms/${form.id}/builder`} className="flex items-center gap-1.5 text-sm text-slate-600 hover:underline">
          <ArrowLeft size={16} /> Back to builder
        </Link>
        <button type="button" onClick={() => window.print()} className="btn-primary text-sm">
          <Printer size={16} /> Print this form
        </button>
      </div>
      <PrintFormView title={form.title} description={form.description} fields={form.fields} />
    </div>
  );
}

export default function PrintPage() {
  return (
    <AuthGate>
      <PrintContent />
    </AuthGate>
  );
}
