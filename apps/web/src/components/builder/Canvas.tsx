"use client";

import { useDrop } from "react-dnd";
import { LayoutTemplate } from "lucide-react";
import type { FieldDto, FieldType } from "@sfb/shared";
import { FieldItem } from "./FieldItem";
import { DND_TYPES } from "./FieldPalette";

interface Props {
  fields: FieldDto[];
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onDropNewField: (type: FieldType) => void;
}

export function Canvas({ fields, selectedFieldId, onSelect, onDuplicate, onDelete, onMove, onDropNewField }: Props) {
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
        <div className="space-y-3">
          {fields.map((field, index) => (
            <FieldItem
              key={field.id}
              field={field}
              index={index}
              selected={field.id === selectedFieldId}
              onSelect={() => onSelect(field.id)}
              onDuplicate={() => onDuplicate(field.id)}
              onDelete={() => onDelete(field.id)}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
