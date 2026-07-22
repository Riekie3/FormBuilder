// Shared types used by both apps/api and apps/web.
// Keep this dependency-free (no Prisma/Express/React imports) so both apps can import it directly.

export const FIELD_TYPES = [
  "TEXT",
  "PARAGRAPH",
  "EMAIL",
  "NUMBER",
  "PHONE",
  "DATE",
  "DROPDOWN",
  "RADIO",
  "CHECKBOX",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldOption {
  id: string;
  label: string;
  value: string;
}

export interface FieldConfig {
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[]; // DROPDOWN, RADIO, CHECKBOX
  min?: number; // NUMBER
  max?: number; // NUMBER
}

export interface FieldDto {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  order: number;
  config: FieldConfig;
}

export type FormStatus = "DRAFT" | "PUBLISHED";

export interface FormSummaryDto {
  id: string;
  title: string;
  slug: string;
  status: FormStatus;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormDetailDto extends FormSummaryDto {
  description: string | null;
  fields: FieldDto[];
}

export interface PublicFormDto {
  id: string;
  title: string;
  description: string | null;
  fields: FieldDto[];
}

export interface AnswerDto {
  fieldId: string;
  value: string;
}

export interface ResponseDto {
  id: string;
  submittedAt: string;
  answers: AnswerDto[];
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Text Field",
  PARAGRAPH: "Paragraph",
  EMAIL: "Email",
  NUMBER: "Number",
  PHONE: "Phone",
  DATE: "Date",
  DROPDOWN: "Dropdown",
  RADIO: "Radio",
  CHECKBOX: "Checkbox",
};

export function fieldSupportsOptions(type: FieldType): boolean {
  return type === "DROPDOWN" || type === "RADIO" || type === "CHECKBOX";
}
