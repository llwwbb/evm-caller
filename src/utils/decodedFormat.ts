import type { ParsedParam } from '../types';

export type DisplayValue =
  | string | number | boolean | null
  | DisplayValue[]
  | { [key: string]: DisplayValue };

export function toDisplay(
  value: unknown,
  param?: ParsedParam | ParsedParam[],
): DisplayValue {
  if (Array.isArray(param)) {
    // ethers v6 unwraps single-output view returns to the bare value
    // (string for address, bigint for uint, Result for tuple, …) — indexing
    // into it would walk into the value's own structure (e.g. char 0 of a
    // hex address string), so wrap it directly.
    if (param.length === 1) {
      return [toDisplay(value, param[0])];
    }
    return param.map((p, i) => toDisplay((value as any)?.[p.name ?? i] ?? (value as any)?.[i], p));
  }

  if (typeof value === 'bigint') return value.toString();
  if (value == null || typeof value !== 'object') return value as DisplayValue;

  const components = param?.components;
  const isResult = typeof (value as any).toArray === 'function';
  const allNamed = !!components && components.length > 0 && components.every((c) => !!c.name);

  if (isResult && allNamed) {
    const out: Record<string, DisplayValue> = {};
    for (const c of components!) {
      out[c.name!] = toDisplay((value as any)[c.name!], c);
    }
    return out;
  }

  if (Array.isArray(value)) {
    const elemParam: ParsedParam | undefined = param && param.type?.endsWith('[]')
      ? { ...param, type: param.type.slice(0, -2) }
      : undefined;
    return (value as any[]).map((v) => toDisplay(v, elemParam));
  }

  const out: Record<string, DisplayValue> = {};
  for (const k of Object.keys(value as any)) {
    if (!isNaN(Number(k))) continue;
    out[k] = toDisplay((value as any)[k]);
  }
  return out;
}
