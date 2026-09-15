import type {ProjectConfiguration,ProjectDocument} from './contracts.ts';
import {defaultProject} from './default-project.ts';
import {connectionKey,validateProject} from './validation.ts';

const byId=<T extends {id:string}>(items:readonly T[])=>[...items].sort((a,b)=>a.id.localeCompare(b.id));
function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
/** Match the complete stock layout, ignoring only operating inputs and collection ordering. */
function layoutKey(c:ProjectConfiguration):string{
  const {fixedConnections:_,components,rails,ducts,assemblies,operationPanel,...rest}=c;
  const panel=operationPanel?(({state,...identity})=>identity)(operationPanel):null;
  return JSON.stringify(canonical({...rest,operationPanel:panel,rails:byId(rails),ducts:byId(ducts),assemblies:byId(assemblies),
    components:byId(components.map(({state,parameters,...identity})=>identity))}));
}

/** Only the import boundary upgrades old stock boards; generic validation never adds power. */
export function upgradeClassroomInlet(project:ProjectDocument):{project:ProjectDocument;conversionNotes:string[]}{
  const stock=defaultProject();
  if(project.configuration.fixedConnections!==undefined||layoutKey(project.configuration)!==layoutKey(stock.configuration))
    return {project,conversionNotes:[]};
  const upgraded=structuredClone(project),fixed=stock.configuration.fixedConnections!;
  upgraded.configuration.fixedConnections=fixed;
  const pairs=new Set(fixed.map(connectionKey));
  upgraded.connections=upgraded.connections.filter(w=>!pairs.has(connectionKey(w)));
  return {project:validateProject(upgraded),conversionNotes:[
    '已依實習盤補上電源至 QF1 的三條固定預接線；相同的舊進線已歸入固定配置，其餘接線與開關位置保持原樣。',
  ]};
}
