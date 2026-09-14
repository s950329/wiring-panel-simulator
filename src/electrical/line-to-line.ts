import type {LineToLineCapability} from './contracts.ts';

/** Validate optional explicit capabilities even for disabled sources. Never infer them from a name. */
export function validLineToLine(value: unknown): value is readonly LineToLineCapability[] | undefined {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 3) return false;
  const pairs = new Set<string>();
  for (const entry of value as unknown[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>, indices = item.phaseIndices;
    if (Object.keys(item).some(key => !['phaseIndices', 'profile'].includes(key)) ||
      !Array.isArray(indices) || indices.length !== 2 ||
      ![indices[0],indices[1]].every(i => Number.isInteger(i) && i >= 0 && i <= 2) || indices[0] >= indices[1] ||
      typeof item.profile !== 'string' || !item.profile.trim()) return false;
    const key = indices.join(':');
    if (pairs.has(key)) return false;
    pairs.add(key);
  }
  return true;
}
