import * as T from 'three';
import type {ModelContext} from '../core/contracts.ts';
import {box, cyl, hit, label, mat, mountingFoot, terminal} from '../primitives.ts';

const term = (c: ModelContext, id: string, x: number, y: number, z: number) =>
  terminal(c.root, c.terminals, id, x, y, z, {scale: .78});

export function buildMotorBreaker(c: ModelContext): ModelContext {
  mountingFoot(c.root, 58, 96);
  box(c.root, 54, 68, 84, 0, 38, 0, mat.white, 2);
  box(c.root, 50, 24, 78, 0, 78, 0, mat.white, 1);
  for (const [i,x] of [-17,0,17].entries()) {
    term(c, ['L1','L2','L3'][i]!, x, 72, -43);
    term(c, ['T1','T2','T3'][i]!, x, 30, 43);
  }
  c.parts.lever = new T.Group(); c.parts.lever.position.z = 6; c.root.add(c.parts.lever);
  hit(box(c.parts.lever, 37, 9, 18, 0, 86, 3, mat.black, 2), 'toggle');
  cyl(c.root, 12, 4, 0, 89, 25, mat.black, 32);
  label(c.root, '2.5–4A', 22, 8, 0, 93.2, 25, {bg:'#efefea',fg:'#222',size:25});
  label(c.root, 'Schneider\nGV2ME', 38, 19, 0, 82.2, -16, {bg:'#f1f1ed',fg:'#333',size:26});
  return c;
}

export function buildMiniBreaker2P(c: ModelContext): ModelContext {
  mountingFoot(c.root, 40, 88);
  box(c.root, 38, 61, 78, 0, 35, 0, mat.white, 2);
  for (const [i,x] of [-10,10].entries()) {
    term(c, ['L1','L2'][i]!, x, 63, -39);
    term(c, ['T1','T2'][i]!, x, 25, 39);
  }
  c.parts.lever = new T.Group(); c.parts.lever.position.z = 5; c.root.add(c.parts.lever);
  hit(box(c.parts.lever, 30, 8, 16, 0, 71, 3, mat.black, 1.5), 'toggle');
  label(c.root, 'iC60N\nC3', 27, 17, 0, 67.2, -13, {bg:'#f5f5f2',fg:'#333',size:27});
  return c;
}

export function buildTesysContactor(c: ModelContext): ModelContext {
  mountingFoot(c.root, 54, 96);
  box(c.root, 52, 48, 72, 0, 32, 0, mat.dark, 2);
  box(c.root, 50, 39, 66, 0, 72, 0, mat.white, 1.5);
  const xs=[-17,0,17];
  for(let i=0;i<3;i++){ term(c,['1L1','3L2','5L3'][i]!,xs[i]!,72,-39); term(c,['2T1','4T2','6T3'][i]!,xs[i]!,28,39); }
  term(c,'A1',-25,55,-23); term(c,'A2',25,55,23);
  box(c.root, 50, 24, 58, 0, 101, 0, mat.white, 1);
  term(c,'13',-17,108,-31); term(c,'14',-17,108,31);
  term(c,'21',17,108,-31); term(c,'22',17,108,31);
  c.parts.plunger=new T.Group(); c.parts.plunger.position.y=88; c.root.add(c.parts.plunger);
  hit(box(c.parts.plunger,25,6,22,0,0,0,mat.black,1),'press');
  label(c.root,'Schneider\nTeSys D',34,16,0,89.2,4,{bg:'#efefe9',fg:'#333',size:26});
  return c;
}

export function buildMechanicalInterlock(c: ModelContext): ModelContext {
  mountingFoot(c.root, 24, 74);
  box(c.root, 22, 43, 62, 0, 28, 0, mat.black, 2);
  box(c.root, 10, 8, 38, 0, 52, 0, mat.gray, 1);
  label(c.root,'↔',13,13,0,56.2,0,{bg:'#222',fg:'#ddd',size:42});
  return c;
}
