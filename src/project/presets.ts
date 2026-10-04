import type {ProjectDocument} from './contracts.ts';
import {defaultProject} from './default-project.ts';

const question07: ProjectDocument = {
  "format": "wiring-panel-project",
  "schemaVersion": 1,
  "name": "工業配線丙級｜第七題｜正逆轉控制（空盤）",
  "configuration": {
    "units": {
      "position": "scene-units",
      "rotation": "degrees"
    },
    "board": {
      "id": "baseplate-q7",
      "width": 800,
      "depth": 640,
      "thickness": 7
    },
    "operationPanel": {
      "id": "operation-panel-q7",
      "definitionId": "hinged-operation-panel",
      "definitionVersion": 1,
      "position": [
        400,
        52,
        637
      ],
      "rotationY": 0,
      "width": 792,
      "depth": 85,
      "thickness": 2.5,
      "skirtHeight": 35,
      "state": {
        "open": false
      }
    },
    "rails": [
      {
        "id": "rail-top",
        "mountId": "baseplate-q7",
        "position": [
          400,
          0.5,
          118
        ],
        "rotationY": 0,
        "length": 520,
        "width": 37
      },
      {
        "id": "rail-mid",
        "mountId": "baseplate-q7",
        "position": [
          400,
          0.5,
          315
        ],
        "rotationY": 0,
        "length": 520,
        "width": 37
      },
      {
        "id": "rail-bottom",
        "mountId": "baseplate-q7",
        "position": [
          400,
          0.5,
          505
        ],
        "rotationY": 0,
        "length": 620,
        "width": 37
      }
    ],
    "ducts": [
      {
        "id": "duct-left",
        "mountId": "baseplate-q7",
        "position": [
          170,
          0.5,
          310
        ],
        "rotationY": 90,
        "length": 470,
        "width": 43
      },
      {
        "id": "duct-center",
        "mountId": "baseplate-q7",
        "position": [
          400,
          0.5,
          310
        ],
        "rotationY": 90,
        "length": 470,
        "width": 43
      },
      {
        "id": "duct-right",
        "mountId": "baseplate-q7",
        "position": [
          630,
          0.5,
          310
        ],
        "rotationY": 90,
        "length": 470,
        "width": 43
      }
    ],
    "components": [
      {
        "id": "Q1",
        "definitionId": "schneider-gv2me08",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            285,
            7,
            112
          ],
          "rotationY": 0
        },
        "state": {
          "on": false
        }
      },
      {
        "id": "Q2",
        "definitionId": "schneider-ic60n-2p-c3",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            500,
            7,
            112
          ],
          "rotationY": 0
        },
        "state": {
          "on": false
        }
      },
      {
        "id": "KM1",
        "definitionId": "schneider-tesys-d",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            335,
            7,
            300
          ],
          "rotationY": 0
        }
      },
      {
        "id": "LOCK",
        "definitionId": "reversing-mechanical-interlock",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            400,
            7,
            300
          ],
          "rotationY": 0
        }
      },
      {
        "id": "KM2",
        "definitionId": "schneider-tesys-d",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            465,
            7,
            300
          ],
          "rotationY": 0
        }
      },
      {
        "id": "TB1",
        "definitionId": "terminal-strip-13",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            400,
            7,
            505
          ],
          "rotationY": 0
        }
      },
      {
        "id": "TB2",
        "definitionId": "terminal-strip-4",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            170,
            7,
            505
          ],
          "rotationY": 0
        }
      },
      {
        "id": "TB3",
        "definitionId": "terminal-strip-4",
        "definitionVersion": 1,
        "placement": {
          "mountId": "baseplate-q7",
          "position": [
            630,
            7,
            505
          ],
          "rotationY": 0
        }
      },
      {
        "id": "PB1",
        "definitionId": "button-red",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            -110,
            0,
            -28
          ],
          "rotationY": 0
        }
      },
      {
        "id": "PB2",
        "definitionId": "button-green",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            -35,
            0,
            -28
          ],
          "rotationY": 0
        }
      },
      {
        "id": "PB3",
        "definitionId": "button-red",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            40,
            0,
            -28
          ],
          "rotationY": 0
        }
      },
      {
        "id": "PB4",
        "definitionId": "button-green",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            115,
            0,
            -28
          ],
          "rotationY": 0
        }
      },
      {
        "id": "WL",
        "definitionId": "lamp-white",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            -110,
            0,
            -60
          ],
          "rotationY": 0
        }
      },
      {
        "id": "YL",
        "definitionId": "lamp-yellow",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            -35,
            0,
            -60
          ],
          "rotationY": 0
        }
      },
      {
        "id": "RL",
        "definitionId": "lamp-red",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            40,
            0,
            -60
          ],
          "rotationY": 0
        }
      },
      {
        "id": "GL",
        "definitionId": "lamp-green",
        "definitionVersion": 1,
        "placement": {
          "mountId": "operation-panel-q7",
          "position": [
            115,
            0,
            -60
          ],
          "rotationY": 0
        }
      }
    ],
    "assemblies": [],
    "panelGateway": null
  },
  "connections": []
};

export interface ProjectPreset {id:string;label:string;project:()=>ProjectDocument}
export const projectPresets:readonly ProjectPreset[] = Object.freeze([
  {id:'board-024',label:'原始練習盤｜BOARD 024',project:defaultProject},
  {id:'question-07',label:'第七題｜三相感應電動機正反轉控制',project:()=>structuredClone(question07)},
]);
export function projectPreset(id:string):ProjectPreset|undefined{return projectPresets.find(p=>p.id===id);}
