import {componentDefinitions} from '../catalog/definitions.ts';
import {definitionInfo} from '../project/catalog.ts';
import type {BehaviorKind} from '../core/contracts.ts';

export const catalogCategories = [
  {id:'all',label:'全部元件'}, {id:'contactors',label:'電磁接觸器 MC'},
  {id:'relays',label:'繼電器與插座'}, {id:'protection',label:'電源與保護'},
  {id:'controls',label:'按鈕與開關'}, {id:'indicators',label:'指示與警報'}, {id:'terminals',label:'端子台'},
] as const;
export type CatalogCategory = typeof catalogCategories[number]['id'];
export interface CatalogEntry {
  id:string; name:string; model:string; manufacturer:string|null; category:CatalogCategory;
  mount:'board'|'panel'; prefix:string; note:string; terminalCount:number;
  size:readonly [number,number,number]; attachment?:'auxiliary'|'overload';
}
const categories:Record<BehaviorKind,CatalogCategory> = {
  breaker:'protection', fuse:'protection', contactor:'contactors', auxiliary:'relays', overload:'relays',
  socket:'relays', terminalStrip:'terminals', button:'controls', selector:'controls', emergency:'controls',
  lamp:'indicators', buzzer:'indicators',
};
const prefixes:Record<BehaviorKind,string> = {
  breaker:'QF',fuse:'FU',contactor:'MC',auxiliary:'AP',overload:'TH',socket:'RY',terminalStrip:'TB',
  button:'PB',selector:'SA',emergency:'ES',lamp:'HL',buzzer:'BZ',
};
/** Metadata is grounded in the existing, qualified catalog; no inferred electrical ratings. */
export function catalogEntries():CatalogEntry[] {
  return Object.values(componentDefinitions).map(d=>({
    id:d.id,name:d.name,model:d.model,manufacturer:d.id.startsWith('shihlin-')?'SHIHLIN':d.id.startsWith('omron-')?'OMRON':d.id==='koino-buzzer'?'Koino':null,
    category:categories[d.behavior],mount:definitionInfo(d.id).mounts[0]==='panel'?'panel':'board',prefix:prefixes[d.behavior],
    note:d.hint,terminalCount:definitionInfo(d.id).terminals.length,size:d.size,
    ...(d.id==='shihlin-ap22'?{attachment:'auxiliary' as const}:d.id==='shihlin-th20'?{attachment:'overload' as const}:{}),
  }));
}
export function catalogEntry(id:string):CatalogEntry {
  const entry=catalogEntries().find(e=>e.id===id);
  if(!entry)throw new Error(`未知元件型號 ${id}`);
  return entry;
}
