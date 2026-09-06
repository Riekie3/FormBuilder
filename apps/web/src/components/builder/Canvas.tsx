"use client";

import { useDrop } from "react-dnd";
import { LayoutTemplate } from "lucide-react";
import type { FieldDto, FieldType } from "@sfb/shared";
import type { SelectModifiers } from "@/hooks/useFormBuilder";
import { FieldItem } from "./FieldItem";
import { DND_TYPES } from "./FieldPalette";

interface Props {
  fields: FieldDto[];
  selectedIds: Set<string>;
  onSelect: (id: string, index: number, modifiers: SelectModifiers) => void;
  onClearSelection: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onMoveField: (id: string, direction: "up" | "down") => void;
  onDropNewField: (type: FieldType) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function Canvas({
  fields,
  selectedIds,
  onSelect,
  onClearSelection,
  onDuplicate,
  onDelete,
  onMove,
  onMoveField,
  onDropNewField,
  onDragStart,
  onDragEnd,
}: Props) {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: DND_TYPES.PALETTE_FIELD,
      drop: (item: { fieldType: FieldType }) => onDropNewField(item.fieldType),
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [onDropNewField],
  );

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClearSelection();
      }}
      className={`min-h-[400px] rounded-xl2 border-2 border-dashed p-4 transition ${
        isOver ? "border-brand-400 bg-brand-50/50 dark:bg-brand-950/20" : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-slate-400">
          <LayoutTemplate size={32} />
          <p className="text-sm">Drag a field type here, or click one in the palette.</p>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3">
          {fields.map((field, index) => (
            <FieldItem
              key={field.id}
              field={field}
              index={index}
              selected={selectedIds.has(field.id)}
              onSelect={(modifiers) => onSelect(field.id, index, modifiers)}
              onDuplicate={() => onDuplicate(field.id)}
              onDelete={() => onDelete(field.id)}
              onMove={onMove}
              onMoveUp={() => onMoveField(field.id, "up")}
              onMoveDown={() => onMoveField(field.id, "down")}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
