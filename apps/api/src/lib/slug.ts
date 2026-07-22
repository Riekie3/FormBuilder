import { nanoid } from "nanoid";

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  const suffix = nanoid(6).toLowerCase();
  return base ? `${base}-${suffix}` : suffix;
}
