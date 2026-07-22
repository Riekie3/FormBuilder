"use client";

import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import type { FieldDto } from "@sfb/shared";
import { FormFieldRenderer } from "@/components/FormFieldRenderer";
import { FIELD_TYPE_ICONS } from "./fieldIcons";
import { DND_TYPES } from "./FieldPalette";

interface DragItem {
  id: string;
  index: number;
}

interface Props {
  field: FieldDto;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
}

export function FieldItem({ field, index, selected, onSelect, onDuplicate, onDelete, onMove }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = FIELD_TYPE_ICONS[field.type];

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_TYPES.CANVAS_FIELD,
      item: (): DragItem => ({ id: field.id, index }),
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [field.id, index],
  );

  const [, drop] = useDrop<DragItem>(
    () => ({
      accept: DND_TYPES.CANVAS_FIELD,
      hover(item, monitor) {
        if (!ref.current || item.index === index) return;
        const hoverRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        const hoverClientY = clientOffset.y - hoverRect.top;

        if (item.index < index && hoverClientY < hoverMiddleY) return;
        if (item.index > index && hoverClientY > hoverMiddleY) return;

        onMove(item.index, index);
        item.index = index;
      },
    }),
    [index, onMove],
  );

  drag(drop(ref));

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition dark:bg-slate-900 ${
        selected ? "border-brand-400 ring-2 ring-brand-100 dark:ring-brand-900" : "border-slate-200 dark:border-slate-800"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <GripVertical size={14} className="cursor-grab" />
          <Icon size={14} />
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Duplicate field"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            aria-label="Delete field"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="pointer-events-none">
        <FormFieldRenderer field={field} value="" onChange={() => {}} disabled />
      </div>
    </div>
  );
}
