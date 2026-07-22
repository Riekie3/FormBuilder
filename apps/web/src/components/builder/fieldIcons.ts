import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  Circle,
  Hash,
  Mail,
  Phone,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { FieldType } from "@sfb/shared";

export const FIELD_TYPE_ICONS: Record<FieldType, LucideIcon> = {
  TEXT: Type,
  PARAGRAPH: AlignLeft,
  EMAIL: Mail,
  NUMBER: Hash,
  PHONE: Phone,
  DATE: Calendar,
  DROPDOWN: ChevronDownSquare,
  RADIO: Circle,
  CHECKBOX: CheckSquare,
};
