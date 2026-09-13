import type {ComponentDefinition} from '../core/contracts.ts';
import {contactorDefinitions} from './definitions/contactors.ts';
import {controlDefinitions} from './definitions/controls.ts';
import {indicatorDefinitions} from './definitions/indicators.ts';
import {protectionDefinitions} from './definitions/protection.ts';
import {relayDefinitions} from './definitions/relay.ts';
import {terminalBlockDefinitions} from './definitions/terminal-blocks.ts';

function freezeDefinition(definition: ComponentDefinition): ComponentDefinition {
  Object.freeze(definition.size);
  Object.freeze(definition.visual);
  if (definition.terminals) {
    for (const t of definition.terminals) {
      Object.freeze(t.position);
      Object.freeze(t.exitDirection);
      if (t.escapePath) {
        for (const p of t.escapePath) Object.freeze(p);
        Object.freeze(t.escapePath);
      }
      Object.freeze(t);
    }
    Object.freeze(definition.terminals);
  }
  if (definition.electrical?.coil) {
    Object.freeze(definition.electrical.coil.terminals);
    Object.freeze(definition.electrical.coil);
  }
  if (definition.electrical?.contacts) {
    for (const contact of definition.electrical.contacts) {
      Object.freeze(contact.terminals);
      Object.freeze(contact);
    }
    Object.freeze(definition.electrical.contacts);
  }
  if (definition.electrical) Object.freeze(definition.electrical);
  return Object.freeze(definition);
}

const groups: readonly Readonly<Record<string, ComponentDefinition>>[] = [
  protectionDefinitions,
  contactorDefinitions,
  relayDefinitions,
  terminalBlockDefinitions,
  controlDefinitions,
  indicatorDefinitions,
];

const definitions: Record<string, ComponentDefinition> = {};
for (const group of groups) {
  for (const [id, definition] of Object.entries(group)) {
    if (definition.id !== id) throw new Error(`元件規格 key 與 id 不一致：${id} / ${definition.id}`);
    if (Object.hasOwn(definitions, id)) throw new Error(`重複元件規格：${id}`);
    definitions[id] = freezeDefinition(definition);
  }
}

export const componentDefinitions: Readonly<Record<string, ComponentDefinition>> = Object.freeze(definitions);
