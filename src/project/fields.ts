import {PROJECT_LIMITS} from './contracts.ts';
import type {Vec3} from '../core/contracts.ts';
export function requireField(ok: unknown, path: string, message: string): asserts ok {
  if (!ok) throw new Error(`${path}：${message}`);
}
export function record(value: unknown, path: string, allowed?: readonly string[]): Record<string, unknown> {
  requireField(value !== null && typeof value === 'object' && !Array.isArray(value), path, '必須是物件');
  const out = value as Record<string, unknown>;
  if (allowed) for (const key of Object.keys(out)) requireField(allowed.includes(key), `${path}.${key}`, '不支援的欄位');
  return out;
}
export function array(value: unknown, path: string, max: number): unknown[] {
  requireField(Array.isArray(value) && value.length <= max, path, `必須是陣列，最多 ${max} 項`); return value;
}
export function text(value: unknown, path: string, max: number = PROJECT_LIMITS.id): string {
  requireField(typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value), path, `文字長度必須為 1–${max}`); return value;
}
export function identifier(value: unknown, path: string): string {
  const id = text(value, path);
  requireField(/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(id) && !['__proto__','constructor','prototype'].includes(id), path, 'ID 只允許文字、數字、底線、連字號及句點'); return id;
}
export function finite(value: unknown, path: string, min: number = -PROJECT_LIMITS.coordinate, max: number = PROJECT_LIMITS.coordinate): number {
  requireField(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, path, `必須是 ${min}–${max} 的有限數值`); return value;
}
export function dimension(value: unknown, path: string): number {
  const n = finite(value, path, 0); requireField(n > 0, path, '尺寸必須大於零'); return n;
}
export function vector(value: unknown, path: string): Vec3 {
  const a = array(value, path, 3); requireField(a.length === 3, path, '必須有三個座標');
  return [finite(a[0],`${path}[0]`), finite(a[1],`${path}[1]`), finite(a[2],`${path}[2]`)];
}
export function rotation(value: unknown, path: string): number {
  const n = finite(value, path); requireField(n % 90 === 0, path, '只支援 90° 的整數倍'); return n;
}
export function boolean(value: unknown, path: string): boolean {requireField(typeof value === 'boolean', path, '必須是布林值'); return value;}
/** Iterative guard: deep/hostile JSON never reaches recursive reference or geometry code. */
export function safeJSON(source: string): unknown {
  requireField(new TextEncoder().encode(source).length <= PROJECT_LIMITS.bytes, '檔案', '超過 10 MB');
  let value: unknown; try {value = JSON.parse(source.replace(/^\uFEFF/, ''));} catch {throw new Error('檔案：無法解析 JSON');}
  const pending: {v: unknown; depth: number}[] = [{v: value, depth: 0}]; let visited = 0;
  while (pending.length) {
    const {v, depth} = pending.pop()!; requireField(depth <= 64 && ++visited <= 500000, '檔案', '巢狀深度或資料量過大');
    if (v && typeof v === 'object') for (const key of Object.keys(v)) {
      requireField(!['__proto__','constructor','prototype'].includes(key), key, '拒絕原型污染欄位');
      pending.push({v: (v as Record<string, unknown>)[key], depth: depth + 1});
    }
  }
  return value;
}
