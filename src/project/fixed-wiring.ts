import type {ProjectConfiguration} from './contracts.ts';
import type {Wire} from '../electrical/contracts.ts';
import {fixedAssemblyWires} from './assemblies.ts';

/** Electrical links only; assembly copper geometry remains owned by assemblies.ts. */
export function fixedProjectWires(config:ProjectConfiguration):Wire[]{
  return [...fixedAssemblyWires(config),...(config.fixedConnections??[]).map((w,i)=>({
    id:`prewired:${i+1}`,from:{...w.from},to:{...w.to},
  }))];
}
