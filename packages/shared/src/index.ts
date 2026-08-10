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
  "ADDRESS",
  "RATING",
  "SIGNATURE",
  "DIVIDER",
  "HEADING",
  "HTML_BLOCK",
  "HIDDEN",
  "RICH_TEXT",
  "CALCULATION",
  "PAGE_BREAK",
  "MATRIX",
  "REPEATER",
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
  maxRating?: number; // RATING — default 5
  htmlContent?: string; // HTML_BLOCK — sanitized at render time, never trusted raw
  richText?: string; // RICH_TEXT — a small safe markdown subset (bold/italic/links/newlines)
  defaultValue?: string; // HIDDEN — the constant value submitted with the form
  formula?: string; // CALCULATION — e.g. "{fieldId1} + {fieldId2} * 2"
  precision?: number; // CALCULATION — decimal places to round to, default 2
  // Shown only when ALL conditions evaluate true against the visitor's
  // current answers. Absent/empty = always shown. Not offered on PAGE_BREAK
  // fields (they're a structural marker, not visitor-facing content).
  conditions?: FieldCondition[];
  matrixRows?: FieldOption[]; // MATRIX — one row per item being rated; `value` unused, id/label only
  matrixColumns?: FieldOption[]; // MATRIX — the answer options shown across the top of every row
  // The public form's URL query-string parameter name that pre-fills this
  // field, e.g. prefillKey "ref" + visiting /f/slug?ref=newsletter sets this
  // field's initial value to "newsletter". Unset = no pre-fill. Purely a
  // client-side rendering concern — the server never reads or validates it
  // beyond generic string bounds.
  prefillKey?: string;
  minLength?: number; // TEXT, PARAGRAPH
  maxLength?: number; // TEXT, PARAGRAPH
  // A fixed, pre-vetted content-shape check — deliberately not a
  // user-authored regex. A form-builder-supplied pattern evaluated on every
  // public submission would be a real ReDoS vector (catastrophic
  // backtracking); a closed set of hand-picked, linear-time patterns has no
  // such risk. TEXT only.
  format?: "any" | "letters" | "numbers" | "alphanumeric";
  repeaterColumns?: FieldOption[]; // REPEATER — the line-items table's columns; `value` unused like matrixRows
}

export interface FieldCondition {
  fieldId: string; // the other field whose answer is checked
  operator: "equals" | "not_equals" | "contains";
  value: string;
}

// Divider/Heading/HTML Block/Rich Text/Page Break are content or structure,
// not input — they never collect a value and can never be marked required.
export function isLayoutField(type: FieldType): boolean {
  return (
    type === "DIVIDER" ||
    type === "HEADING" ||
    type === "HTML_BLOCK" ||
    type === "RICH_TEXT" ||
    type === "PAGE_BREAK"
  );
}

// Calculation derives its value from other fields — the visitor never types
// into it directly, so it's exempt from required-field validation too.
export function isComputedField(type: FieldType): boolean {
  return type === "CALCULATION";
}

// A PAGE_BREAK field never renders as visitor-facing content — it only marks
// where one page of a multi-page form ends and the next begins.
export function isPageBreak(type: FieldType): boolean {
  return type === "PAGE_BREAK";
}

// Evaluates a field's conditional-visibility rules against the visitor's
// current answers (keyed by fieldId). Used identically by the client (to
// decide what to render) and the server (to decide what's actually required),
// so the two can never disagree about what was "shown".
export function isFieldVisible(field: Pick<FieldDto, "config">, values: Record<string, string>): boolean {
  const conditions = field.config.conditions;
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => {
    const actual = values[c.fieldId] ?? "";
    switch (c.operator) {
      case "equals":
        return actual === c.value;
      case "not_equals":
        return actual !== c.value;
      case "contains":
        return actual.includes(c.value);
      default:
        return true;
    }
  });
}

// A Matrix field stores one answer per row as JSON: { [rowId]: columnValue }.
// "Required" means every row needs an answer, not just that the field has
// *some* value — a visitor who only rated 2 of 5 rows hasn't really answered it.
export function isMatrixAnswerComplete(rows: FieldOption[], rawValue: string | undefined): boolean {
  if (!rawValue) return false;
  let answers: Record<string, string>;
  try {
    answers = JSON.parse(rawValue) as Record<string, string>;
  } catch {
    return false;
  }
  return rows.length > 0 && rows.every((row) => !!answers[row.id]);
}

// A Repeater (line-items table) field stores its answer as a JSON array of
// row objects: [{ [columnId]: value }, ...]. "Required" here just means at
// least one row exists — not that every cell in it is filled — since a
// visitor who added one line item has meaningfully answered the field even
// if they left an optional column blank on that row.
export function isRepeaterAnswerComplete(rawValue: string | undefined): boolean {
  if (!rawValue) return false;
  let rows: unknown;
  try {
    rows = JSON.parse(rawValue);
  } catch {
    return false;
  }
  return Array.isArray(rows) && rows.length > 0;
}

// Whether `value` counts as a real answer to `field`, for required-field
// validation. Almost every type is just "non-empty string", but Matrix needs
// every row answered and Repeater needs at least one row — used identically
// by the client (what to flag) and the server (what to actually reject), so
// the two can't disagree.
export function isFieldAnswerComplete(field: Pick<FieldDto, "type" | "config">, value: string | undefined): boolean {
  if (field.type === "MATRIX") return isMatrixAnswerComplete(field.config.matrixRows ?? [], value);
  if (field.type === "REPEATER") return isRepeaterAnswerComplete(value);
  return !!value?.trim();
}

// Fixed, linear-time patterns only — never a form-builder-supplied regex.
// A user-authored pattern evaluated on every public submission would be a
// real ReDoS vector (catastrophic backtracking is easy to write by
// accident, not just maliciously); this closed set has no such risk.
const FORMAT_PATTERNS: Record<string, RegExp> = {
  letters: /^[A-Za-z\s]+$/,
  numbers: /^[0-9]+$/,
  alphanumeric: /^[A-Za-z0-9]+$/,
};
const FORMAT_LABELS: Record<string, string> = {
  letters: "letters only",
  numbers: "numbers only",
  alphanumeric: "letters and numbers only",
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Format/length/range constraints beyond plain required-ness — e.g. a Number
// field's configured min/max, or a Text field's min/max length and content
// shape. Only checked when a value is actually present; an empty optional
// field is a required-ness question, not a format one, so this always
// returns null for "". Used identically by the client (what to flag inline)
// and the server (what to actually reject) so the two can't disagree.
export function getFieldValidationError(field: Pick<FieldDto, "type" | "config">, value: string): string | null {
  if (!value) return null;
  const { type, config } = field;

  if (type === "TEXT" || type === "PARAGRAPH") {
    if (config.minLength !== undefined && value.length < config.minLength) {
      return `Must be at least ${config.minLength} characters`;
    }
    if (config.maxLength !== undefined && value.length > config.maxLength) {
      return `Must be at most ${config.maxLength} characters`;
    }
  }

  if (type === "TEXT" && config.format && config.format !== "any") {
    const pattern = FORMAT_PATTERNS[config.format];
    if (pattern && !pattern.test(value)) {
      return `Must contain ${FORMAT_LABELS[config.format]}`;
    }
  }

  if (type === "NUMBER") {
    const n = Number(value);
    if (Number.isNaN(n)) return "Must be a number";
    if (config.min !== undefined && n < config.min) return `Must be at least ${config.min}`;
    if (config.max !== undefined && n > config.max) return `Must be at most ${config.max}`;
  }

  if (type === "EMAIL" && !EMAIL_PATTERN.test(value)) {
    return "Must be a valid email address";
  }

  return null;
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
  // Free-text tag/identifier (e.g. a SKU or reference code) — purely for the
  // form owner's own organization, not shown to public form visitors.
  productCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  // What the *current* user can do with this form — lets the UI hide
  // Edit/Delete for forms granted via a view-only role.
  canEdit: boolean;
  canDelete: boolean;
  // Opt-in, single-level approval (Phase 3) — only settable when the form
  // has a department, since the approver role is resolved against it.
  requiresApproval: boolean;
  approverRoleId: string | null;
  approverRoleName: string | null;
  // Can the *current* user decide on this form's pending responses?
  canApprove: boolean;
  pendingCount: number;
  // "Conversational" display: one real question per page instead of the
  // PAGE_BREAK-grouped layout — see the Form model for the full rule.
  oneQuestionPerPage: boolean;
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
  requiresApproval: boolean;
  oneQuestionPerPage: boolean;
}

export interface AnswerDto {
  fieldId: string;
  value: string;
}

export type ResponseStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ResponseDto {
  id: string;
  submittedAt: string;
  answers: AnswerDto[];
  status: ResponseStatus | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

export interface PendingApprovalDto {
  responseId: string;
  formId: string;
  formTitle: string;
  submittedAt: string;
  answers: AnswerDto[];
  fields: FieldDto[];
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

export interface DepartmentDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDto {
  id: string;
  name: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipDto {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  departmentId: string;
  departmentName: string;
  roleId: string;
  roleName: string;
  createdAt: string;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
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
  ADDRESS: "Address",
  RATING: "Rating",
  SIGNATURE: "Signature",
  DIVIDER: "Divider",
  HEADING: "Heading",
  HTML_BLOCK: "HTML Block",
  HIDDEN: "Hidden Field",
  RICH_TEXT: "Rich Text",
  CALCULATION: "Calculation",
  PAGE_BREAK: "Page Break",
  MATRIX: "Matrix",
  REPEATER: "Line Items",
};

export function fieldSupportsOptions(type: FieldType): boolean {
  return type === "DROPDOWN" || type === "RADIO" || type === "CHECKBOX";
}
