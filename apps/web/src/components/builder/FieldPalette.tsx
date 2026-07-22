"use client";

import { useDrag } from "react-dnd";
import { FIELD_TYPES, FIELD_TYPE_LABELS, type FieldType } from "@sfb/shared";
import { FIELD_TYPE_ICONS } from "./fieldIcons";

export const DND_TYPES = {
  PALETTE_FIELD: "PALETTE_FIELD",
  CANVAS_FIELD: "CANVAS_FIELD",
} as const;

function PaletteItem({ type, onAdd }: { type: FieldType; onAdd: (type: FieldType) => void }) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_TYPES.PALETTE_FIELD,
      item: { fieldType: type },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [type],
  );
  const Icon = FIELD_TYPE_ICONS[type];

  return (
    <button
      ref={drag as unknown as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={() => onAdd(type)}
      className={`flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Icon size={16} className="text-brand-500" />
      {FIELD_TYPE_LABELS[type]}
    </button>
  );
}

export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Field types</h3>
      <div className="space-y-1.5">
        {FIELD_TYPES.map((type) => (
          <PaletteItem key={type} type={type} onAdd={onAdd} />
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">Drag onto the canvas, or click to add at the end.</p>
    </div>
  );
}
