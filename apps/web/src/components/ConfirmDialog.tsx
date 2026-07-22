"use client";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// A native window.confirm() is unreliable — some browsers/extensions/corporate
// policies suppress or auto-dismiss it, and it blocks the JS thread in a way
// that doesn't play well with React state. This in-app modal replaces it so
// destructive actions get a predictable, testable confirmation step.
export function ConfirmDialog({ title, message, confirmLabel = "Delete", danger = true, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`text-sm ${danger ? "inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-red-700" : "btn-primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
