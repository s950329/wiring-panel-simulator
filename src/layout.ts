import type {ComponentPlacement} from './core/contracts.ts';
import {resolvePlacements} from './catalog/resolve.ts';

/** Board-proportion coordinates, not measured millimetres. */
export const board={"width":800,"depth":640,"thickness":7};
export const placements: readonly ComponentPlacement[] = [
  {
    "id": "QF1",
    "definitionId": "shihlin-t20",
    "x": 732,
    "z": 70,
    "rotation": -90
  },
  {
    "id": "FU1",
    "definitionId": "twin-fuse-holder",
    "x": 636,
    "z": 174,
    "rotation": -90
  },
  {
    "id": "MC1",
    "definitionId": "shihlin-sp16",
    "x": 356,
    "z": 86,
    "rotation": -90
  },
  {
    "id": "AP1",
    "definitionId": "shihlin-ap22",
    "x": 356,
    "z": 86,
    "y": 83,
    "rotation": -90,
    "parentId": "MC1"
  },
  {
    "id": "TH1",
    "definitionId": "shihlin-th20",
    "x": 276,
    "z": 86,
    "rotation": -90,
    "parentId": "MC1"
  },
  {
    "id": "SO1",
    "definitionId": "omron-p2cf11",
    "x": 352,
    "z": 178,
    "rotation": -90
  },
  {
    "id": "MC2",
    "definitionId": "shihlin-sc21l",
    "x": 356,
    "z": 258,
    "rotation": -90
  },
  {
    "id": "MC3",
    "definitionId": "cn18",
    "x": 360,
    "z": 352,
    "rotation": -90
  },
  {
    "id": "TB1",
    "definitionId": "terminal-strip-46",
    "x": 440,
    "z": 517,
    "rotation": 0
  },
  {
    "id": "TB2",
    "definitionId": "terminal-strip-13",
    "x": 72,
    "z": 273,
    "rotation": 90
  }
];
export const frontPlacements: readonly ComponentPlacement[] = [
  {
    "id": "BZ1",
    "definitionId": "koino-buzzer",
    "x": 54,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "ES1",
    "definitionId": "emergency-red",
    "x": 117,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "SA1",
    "definitionId": "selector-three-position",
    "x": 180,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "PB1",
    "definitionId": "button-yellow",
    "x": 243,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "PB2",
    "definitionId": "button-teal",
    "x": 306,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "PB3",
    "definitionId": "button-green",
    "x": 369,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "PB4",
    "definitionId": "button-red-sticker",
    "x": 432,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "PB5",
    "definitionId": "button-red",
    "x": 495,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "HL1",
    "definitionId": "lamp-white",
    "x": 558,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "HL2",
    "definitionId": "lamp-yellow",
    "x": 621,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "HL3",
    "definitionId": "lamp-red",
    "x": 684,
    "z": 605,
    "rotation": 0
  },
  {
    "id": "HL4",
    "definitionId": "lamp-green",
    "x": 747,
    "z": 605,
    "rotation": 0
  }
];
export const layout=resolvePlacements(placements);
export const frontControls=resolvePlacements(frontPlacements);
/** The B row faces the operation plate; the A row serves cabinet wiring. */
export const panelGateway={component:'TB1',side:'B'} as const;
export const ducts=[
  {
    "x": 212,
    "z": 218,
    "length": 410,
    "width": 43,
    "rotation": 0
  },
  {
    "x": 501,
    "z": 208,
    "length": 416,
    "width": 43,
    "rotation": 0
  },
  {
    "x": 780,
    "z": 282,
    "length": 270,
    "width": 37,
    "rotation": 0
  },
  {
    "x": 416,
    "z": 435,
    "length": 760,
    "width": 47,
    "rotation": 90
  }
];
export const rails=[
  {
    "x": 72,
    "z": 273,
    "length": 241,
    "width": 37,
    "rotation": 0
  },
  {
    "x": 440,
    "z": 517,
    "length": 747,
    "width": 38,
    "rotation": 90
  },
  {
    "x": 360,
    "z": 228,
    "length": 371,
    "width": 37,
    "rotation": 0
  },
  {
    "x": 636,
    "z": 274,
    "length": 320,
    "width": 37,
    "rotation": 0
  }
];
