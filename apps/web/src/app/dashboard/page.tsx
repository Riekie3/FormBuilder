"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, MoreVertical, Plus, Trash2 } from "lucide-react";
import type { FormSummaryDto } from "@sfb/shared";
import { AuthGate } from "@/components/AuthGate";
import { DashboardShell } from "@/components/DashboardShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useForms } from "@/hooks/useForms";

function DashboardContent() {
  const { forms, creatableDepartments, loading, error, createForm, deleteForm } = useForms();
  const [newTitle, setNewTitle] = useState("");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [formPendingDelete, setFormPendingDelete] = useState<FormSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleConfirmDelete() {
    if (!formPendingDelete) return;
    setDeleting(true);
    try {
      await deleteForm(formPendingDelete.id);
      setFormPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const form = await createForm(newTitle.trim() || "Untitled Form", newDepartmentId || null);
      setNewTitle("");
      router.push(`/dashboard/forms/${form.id}/builder`);
    } finally {
      setCreating(false);
    }
  }

  const draftCount = forms.filter((f) => f.status === "DRAFT").length;
  const publishedCount = forms.filter((f) => f.status === "PUBLISHED").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Your forms</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {publishedCount} published · {draftCount} draft{draftCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Form title (optional)"
            className="input-field w-56"
          />
          {creatableDepartments.length > 0 && (
            <select
              value={newDepartmentId}
              onChange={(e) => setNewDepartmentId(e.target.value)}
              className="input-field w-40"
              aria-label="Department"
            >
              <option value="">Private (just me)</option>
              {creatableDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={handleCreate} disabled={creating} className="btn-primary">
            <Plus size={16} /> Create
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">Loading forms...</p>
      ) : forms.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-2 p-16 text-center">
          <FileText className="text-slate-300 dark:text-slate-600" size={40} />
          <p className="font-medium text-slate-700 dark:text-slate-300">No forms yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Give your first form a title above and hit Create.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <div key={form.id} className="card relative flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      form.status === "PUBLISHED"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {form.status === "PUBLISHED" ? "Published" : "Draft"}
                  </span>
                  {form.departmentName && (
                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {form.departmentName}
                    </span>
                  )}
                  {form.canApprove && form.pendingCount > 0 && (
                    <Link
                      href="/dashboard/approvals"
                      className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    >
                      {form.pendingCount} pending
                    </Link>
                  )}
                </div>
                {form.canDelete && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === form.id ? null : form.id)}
                      className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Form actions"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenuId === form.id && (
                      <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setFormPendingDelete(form);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Link href={`/dashboard/forms/${form.id}/builder`} className="font-semibold text-slate-900 dark:text-white">
                {form.title}
              </Link>
              <p className="text-xs text-slate-400">
                {form.responseCount} response{form.responseCount === 1 ? "" : "s"}
                {form.productCode && <span className="ml-2 font-mono text-slate-400">#{form.productCode}</span>}
              </p>

              <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                <Link href={`/dashboard/forms/${form.id}/builder`} className="font-medium text-brand-600 dark:text-brand-400">
                  {form.canEdit ? "Edit" : "View"}
                </Link>
                <Link href={`/dashboard/forms/${form.id}/responses`} className="font-medium text-slate-500 dark:text-slate-400">
                  Responses
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {formPendingDelete && (
        <ConfirmDialog
          title="Delete this form?"
          message={`"${formPendingDelete.title}" and all of its responses will be permanently deleted. This cannot be undone.`}
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          onCancel={() => setFormPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardShell>
        <DashboardContent />
      </DashboardShell>
    </AuthGate>
  );
}
