import type {EquipmentDescriptor,} from '../application/equipment.ts';
import type {ProjectConfiguration} from './contracts.ts';
import {definitionInfo} from './catalog.ts';
export function projectEquipment(config:ProjectConfiguration):EquipmentDescriptor[]{
  return config.components.filter(c=>c.placement===null).map(c=>{
    const info=definitionInfo(c.definitionId);
    return {id:c.id,definitionId:c.definitionId,label:info.name,terminals:info.terminals};
  });
}
