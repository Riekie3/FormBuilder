"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ClipboardCheck, X } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DashboardShell } from "@/components/DashboardShell";
import { useApprovals } from "@/hooks/useApprovals";
import { displayAnswerValue } from "@/lib/displayAnswerValue";
import type { PendingApprovalDto } from "@sfb/shared";

function ApprovalCard({
  item,
  onDecide,
}: {
  item: PendingApprovalDto;
  onDecide: (decision: "APPROVED" | "REJECTED", comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byField = new Map(item.answers.map((a) => [a.fieldId, a.value]));

  async function handleDecide(decision: "APPROVED" | "REJECTED") {
    setSubmitting(decision);
    setError(null);
    try {
      await onDecide(decision, comment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record the decision");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/forms/${item.formId}/responses`} className="font-semibold text-slate-900 dark:text-white">
          {item.formTitle}
        </Link>
        <span className="text-xs text-slate-400">{new Date(item.submittedAt).toLocaleString()}</span>
      </div>

      <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
        {item.fields.map((field) => (
          <div key={field.id} className="flex gap-2">
            <dt className="w-1/3 shrink-0 text-slate-400">{field.label}</dt>
            <dd className="text-slate-700 dark:text-slate-300">{displayAnswerValue(field, byField.get(field.id)) || "—"}</dd>
          </div>
        ))}
      </dl>

      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        className="input-field text-sm"
      />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleDecide("APPROVED")}
          disabled={submitting !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
        >
          <Check size={16} /> {submitting === "APPROVED" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => handleDecide("REJECTED")}
          disabled={submitting !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
        >
          <X size={16} /> {submitting === "REJECTED" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}

function ApprovalsContent() {
  const { pending, loading, error, decide } = useApprovals();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Approvals</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Submissions waiting on your decision, across every form you can approve for.
      </p>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      ) : pending.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-2 p-16 text-center">
          <ClipboardCheck className="text-slate-300 dark:text-slate-600" size={40} />
          <p className="font-medium text-slate-700 dark:text-slate-300">Nothing pending</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;re all caught up.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {pending.map((item) => (
            <ApprovalCard
              key={item.responseId}
              item={item}
              onDecide={(decision, comment) => decide(item.formId, item.responseId, decision, comment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <AuthGate>
      <DashboardShell>
        <ApprovalsContent />
      </DashboardShell>
    </AuthGate>
  );
}
