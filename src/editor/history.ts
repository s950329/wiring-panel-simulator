import type {ProjectDocument} from '../project/contracts.ts';
/** History is advanced only after the corresponding ProjectSession transaction succeeds. */
export class LayoutHistory {
  #undo:ProjectDocument[]=[];#redo:ProjectDocument[]=[];
  constructor(readonly limit=30){}
  get canUndo():boolean{return this.#undo.length>0;}
  get canRedo():boolean{return this.#redo.length>0;}
  get undoCount():number{return this.#undo.length;}
  peekUndo():ProjectDocument|null{return this.#undo.length?structuredClone(this.#undo.at(-1)!):null;}
  peekRedo():ProjectDocument|null{return this.#redo.length?structuredClone(this.#redo.at(-1)!):null;}
  record(before:ProjectDocument):void{this.#undo.push(structuredClone(before));if(this.#undo.length>this.limit)this.#undo.shift();this.#redo=[];}
  commitUndo(current:ProjectDocument):void{if(this.#undo.length){this.#undo.pop();this.#redo.push(structuredClone(current));}}
  commitRedo(current:ProjectDocument):void{if(this.#redo.length){this.#redo.pop();this.#undo.push(structuredClone(current));}}
  clear():void{this.#undo=[];this.#redo=[];}
}
