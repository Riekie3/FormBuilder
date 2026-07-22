"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Search, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DashboardShell } from "@/components/DashboardShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useResponses } from "@/hooks/useResponses";
import { displayAnswerValue } from "@/lib/displayAnswerValue";
import { StatusBadge } from "@/components/StatusBadge";

function ResponsesContent() {
  const params = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const { form, responses, loading, error, deleteResponse, exportCsv } = useResponses(params.id, search);
  const [responsePendingDelete, setResponsePendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const orderedFields = form?.fields ?? [];

  async function handleConfirmDelete() {
    if (!responsePendingDelete) return;
    setDeleting(true);
    try {
      await deleteResponse(responsePendingDelete);
      setResponsePendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{form?.title ?? "Responses"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{responses.length} response{responses.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search responses..."
            className="input-field pl-9"
          />
        </div>
        <button type="button" onClick={() => exportCsv()} className="btn-secondary text-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading responses...</p>
      ) : responses.length === 0 ? (
        <div className="card p-16 text-center text-sm text-slate-500 dark:text-slate-400">No responses yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Submitted</th>
                {form?.requiresApproval && <th className="px-4 py-3 font-medium">Status</th>}
                {orderedFields.map((field) => (
                  <th key={field.id} className="px-4 py-3 font-medium">
                    {field.label}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => {
                const byField = new Map(response.answers.map((a) => [a.fieldId, a.value]));
                return (
                  <tr key={response.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(response.submittedAt).toLocaleString()}
                    </td>
                    {form?.requiresApproval && (
                      <td className="px-4 py-3">{response.status && <StatusBadge status={response.status} />}</td>
                    )}
                    {orderedFields.map((field) => (
                      <td key={field.id} className="max-w-xs truncate px-4 py-3 text-slate-700 dark:text-slate-300">
                        {displayAnswerValue(field, byField.get(field.id))}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setResponsePendingDelete(response.id)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        aria-label="Delete response"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {responsePendingDelete && (
        <ConfirmDialog
          title="Delete this response?"
          message="This response will be permanently deleted. This cannot be undone."
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          onCancel={() => setResponsePendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export default function ResponsesPage() {
  return (
    <AuthGate>
      <DashboardShell>
        <ResponsesContent />
      </DashboardShell>
    </AuthGate>
  );
}
