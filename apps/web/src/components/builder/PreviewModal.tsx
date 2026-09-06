"use client";

import { X } from "lucide-react";
import type { FieldDto, LookupDataset } from "@sfb/shared";
import { PreviewForm } from "@/components/PreviewForm";

interface Props {
  title: string;
  description?: string | null;
  fields: FieldDto[];
  onClose: () => void;
  oneQuestionPerPage?: boolean;
  lookupDatasets?: LookupDataset[];
}

export function PreviewModal({ title, description, fields, onClose, oneQuestionPerPage, lookupDatasets }: Props) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg pt-10">
        <div className="mb-3 flex items-center justify-between text-white">
          <span className="text-sm font-medium">Live preview</span>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-1.5 hover:bg-white/20">
            <X size={16} />
          </button>
        </div>
        <PreviewForm
          title={title}
          description={description}
          fields={fields}
          mode="preview"
          oneQuestionPerPage={oneQuestionPerPage}
          lookupDatasets={lookupDatasets}
        />
      </div>
    </div>
  );
}
