import type {ProjectDocument} from '../project/contracts.ts';
import {prepareLayoutCommand,type LayoutCommand,type LayoutChange} from './commands.ts';
import {checkLayoutPlacement} from './geometry.ts';
import {LayoutHistory} from './history.ts';
export interface LayoutHost {
  read():ProjectDocument;
  canEdit():boolean;
  load(project:ProjectDocument):Promise<void>;
}
/** Authoring never mutates the live runtime: publication is delegated to ProjectSession. */
export class LayoutController {
  readonly history=new LayoutHistory();
  busy=false;
  constructor(private readonly host:LayoutHost){}
  private assertEditable(){if(this.busy||!this.host.canEdit())throw new Error('請先停止模擬，並等目前操作完成');}
  async apply(command:LayoutCommand):Promise<LayoutChange>{
    this.assertEditable();const before=this.host.read(),change=prepareLayoutCommand(before,command);
    const check=checkLayoutPlacement(change.project,change.changedIds);if(!check.valid)throw new Error(check.message);
    this.busy=true;
    try{await this.host.load(change.project);this.history.record(before);return change;}finally{this.busy=false;}
  }
  async undo():Promise<void>{
    this.assertEditable();const previous=this.history.peekUndo();if(!previous)return;
    const current=this.host.read();this.busy=true;
    try{await this.host.load(previous);this.history.commitUndo(current);}finally{this.busy=false;}
  }
  async redo():Promise<void>{
    this.assertEditable();const next=this.history.peekRedo();if(!next)return;
    const current=this.host.read();this.busy=true;
    try{await this.host.load(next);this.history.commitRedo(current);}finally{this.busy=false;}
  }
}
