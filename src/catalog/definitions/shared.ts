import type {CatalogTerminalDefinition, TerminalRole, Vec3} from '../../core/contracts.ts';

export const terminal = (
  id: string,
  position: Vec3,
  role: TerminalRole = 'unverified',
  displayName?: string,
  group?: string,
  exitDirection: Vec3 = [0, 0, position[2] >= 0 ? 1 : -1],
): CatalogTerminalDefinition => ({
  id,
  position,
  exitDirection,
  role,
  ...(displayName === undefined ? {} : {displayName}),
  ...(group === undefined ? {} : {group}),
});

export function poleBankTerminals(
  ids: readonly string[],
  width: number,
  y: number,
  z: number,
  role: TerminalRole = 'power',
): CatalogTerminalDefinition[] {
  const pitch = width / ids.length;
  return ids.map((id, i) => terminal(id, [-width / 2 + pitch * (i + .5), y, z], role));
}

export function terminalStripTerminals(
  count: number,
  pitch: number,
): CatalogTerminalDefinition[] {
  const terminals: CatalogTerminalDefinition[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * pitch;
    terminals.push(terminal(`${i + 1}A`, [x, 23, -13]));
    terminals.push(terminal(`${i + 1}B`, [x, 23, 13]));
  }
  return terminals;
}

export const pushButtonTerminals = (): CatalogTerminalDefinition[] => [
  terminal('1', [-9, -41, -6], 'contact', '13 · 常開 NO', 'NO'),
  terminal('2', [9, -41, 6], 'contact', '14 · 常開 NO', 'NO'),
  terminal('3', [-9, -41, 6], 'contact', '21 · 常閉 NC', 'NC'),
  terminal('4', [9, -41, -6], 'contact', '22 · 常閉 NC', 'NC'),
];

export const selectorTerminals = (): CatalogTerminalDefinition[] => [
  terminal('1', [-9, -41, -6], 'contact', '13 · 接點 A', 'selector-A'),
  terminal('2', [9, -41, 6], 'contact', '14 · 接點 A', 'selector-A'),
  terminal('3', [-9, -41, 6], 'contact', '23 · 接點 B', 'selector-B'),
  terminal('4', [9, -41, -6], 'contact', '24 · 接點 B', 'selector-B'),
];

export const emergencyTerminals = (): CatalogTerminalDefinition[] => [
  terminal('1', [-9, -41, -6], 'contact', '21 · 常閉 NC', 'NC'),
  terminal('2', [9, -41, 6], 'contact', '22 · 常閉 NC', 'NC'),
];

export const twoFrontTerminals = (
  y = -41,
  role: TerminalRole = 'control',
): CatalogTerminalDefinition[] => [
  terminal('1', [-9, y, -6], role),
  terminal('2', [9, y, 6], role),
];
