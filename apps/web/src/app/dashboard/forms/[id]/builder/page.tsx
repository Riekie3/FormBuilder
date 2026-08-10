"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ArrowLeft, Eye, Loader2, Radio, Check, Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { useFormBuilder } from "@/hooks/useFormBuilder";
import { FieldPalette } from "@/components/builder/FieldPalette";
import { Canvas } from "@/components/builder/Canvas";
import { FieldSettingsPanel } from "@/components/builder/FieldSettingsPanel";
import { ApprovalSettings } from "@/components/builder/ApprovalSettings";
import { PreviewModal } from "@/components/builder/PreviewModal";
import { ThemeToggle } from "@/components/ThemeToggle";

function SaveStatusIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin" /> Saving...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={12} /> Saved
      </span>
    );
  }
  if (status === "error") {
    return <span className="text-xs text-red-600 dark:text-red-400">Couldn&apos;t save</span>;
  }
  return null;
}

function BuilderContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    form,
    fields,
    loading,
    saveStatus,
    selectedIds,
    selectField,
    clearSelection,
    addField,
    updateField,
    removeField,
    removeFields,
    duplicateField,
    duplicateFields,
    reorderFields,
    beginReorder,
    commitReorder,
    undo,
    redo,
    canUndo,
    canRedo,
    copyFields,
    pasteFields,
    updateFormMetaImmediate,
    debouncedMetaSave,
  } = useFormBuilder(params.id);

  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, Ctrl/Cmd+C/V copy
  // and paste selected fields — guarded against any typing target so these
  // never hijack normal text editing (labels, the title field, etc).
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (key === "z") {
        e.preventDefault();
        undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "c" && selectedIds.size > 0) {
        e.preventDefault();
        copyFields(selectedIds);
      } else if (key === "v") {
        e.preventDefault();
        pasteFields();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, copyFields, pasteFields, selectedIds]);

  if (loading || !form) {
    return <div className="p-10 text-sm text-slate-500 dark:text-slate-400">Loading form...</div>;
  }

  const selectedField = selectedIds.size === 1 ? fields.find((f) => selectedIds.has(f.id)) ?? null : null;
  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;

  async function togglePublish() {
    setPublishing(true);
    try {
      await updateFormMetaImmediate({ status: form!.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/dashboard" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft size={18} />
              </Link>
              <input
                defaultValue={form.title}
                onChange={(e) => debouncedMetaSave({ title: e.target.value })}
                className="min-w-0 truncate border-none bg-transparent text-lg font-semibold text-slate-900 outline-none focus:ring-0 dark:text-white"
              />
              <SaveStatusIndicator status={saveStatus} />
            </div>
            <div className="flex items-center gap-2">
              {form.status === "PUBLISHED" && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden max-w-[220px] truncate text-xs text-brand-600 underline sm:block dark:text-brand-400"
                >
                  {publicUrl}
                </a>
              )}
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Redo2 size={16} />
              </button>
              <button type="button" onClick={() => setShowPreview(true)} className="btn-secondary text-sm">
                <Eye size={16} /> Preview
              </button>
              <button
                type="button"
                onClick={togglePublish}
                disabled={publishing}
                className={form.status === "PUBLISHED" ? "btn-secondary text-sm" : "btn-primary text-sm"}
              >
                <Radio size={16} />
                {form.status === "PUBLISHED" ? "Unpublish" : "Publish"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}
                className="btn-secondary text-sm"
              >
                Responses ({form.responseCount})
              </button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[240px_1fr_280px]">
          <div className="order-2 lg:order-1">
            <FieldPalette onAdd={addField} />
          </div>
          <div className="order-1 lg:order-2">
            <Canvas
              fields={fields}
              selectedIds={selectedIds}
              onSelect={selectField}
              onClearSelection={clearSelection}
              onDuplicate={duplicateField}
              onDelete={removeField}
              onMove={reorderFields}
              onDropNewField={addField}
              onDragStart={beginReorder}
              onDragEnd={commitReorder}
            />
          </div>
          <div className="order-3 space-y-4">
            <div className="card space-y-2 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Product code</h3>
              <input
                defaultValue={form.productCode ?? ""}
                onChange={(e) => debouncedMetaSave({ productCode: e.target.value || null })}
                placeholder="e.g. SKU-1024"
                className="input-field text-sm"
              />
              <p className="text-xs text-slate-400">Your own reference code — never shown to visitors.</p>
            </div>
            <ApprovalSettings form={form} onUpdate={updateFormMetaImmediate} />
            <FieldSettingsPanel
              field={selectedField}
              allFields={fields}
              onChange={(patch) => selectedField && updateField(selectedField.id, patch)}
              selectedCount={selectedIds.size}
              onBulkDuplicate={() => duplicateFields(selectedIds)}
              onBulkDelete={() => removeFields(selectedIds)}
            />
          </div>
        </main>
      </div>

      {showPreview && (
        <PreviewModal
          title={form.title}
          description={form.description}
          fields={fields}
          onClose={() => setShowPreview(false)}
        />
      )}
    </DndProvider>
  );
}

export default function BuilderPage() {
  return (
    <AuthGate>
      <BuilderContent />
    </AuthGate>
  );
}
