import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let createCanvas,sharp;
if(process.argv.includes('--render')){({createCanvas}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas':'@napi-rs/canvas'));sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp':'sharp');}else createCanvas=()=>({width:256,height:256,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})});
class El{constructor(tag){this.tag=tag;this.attrs={};this.childNodes=[];this.style={};}setAttribute(k,v){this.attrs[k]=v;}appendChild(v){this.childNodes.push(v);}removeChild(v){this.childNodes.splice(this.childNodes.indexOf(v),1);}get outerHTML(){return `<${this.tag} ${Object.entries(this.attrs).map(([k,v])=>`${k}="${String(v).replaceAll('"','&quot;')}"`).join(' ')}>${this.childNodes.map(c=>c.outerHTML).join('')}</${this.tag}>`;}}
globalThis.document={createElement:(name)=>name==='canvas'?createCanvas(256,256):new El(name),createElementNS:(ns,name)=>new El(name)};
const T=await import('three');
const {buildModel}=await import('../src/scene.js');
const {HemisphereCamera,cameraBasis,clampElevation}=await import('../src/camera.js');
const {SVGRenderer}=await import('three/addons/renderers/SVGRenderer.js');
const scene=new T.Scene();scene.add(new T.AmbientLight(0xffffff,.65));const light=new T.DirectionalLight(0xffffff,1);light.position.set(-400,1000,200);scene.add(light);
const {world,components}=buildModel(scene);
assert.equal(components.get('TB1').terminals.length,92);assert.equal(components.get('TB2').terminals.length,26);assert.equal(components.get('SO1').terminals.length,11);assert.equal(components.get('AP1').terminals.length,8);assert.equal(components.size,22);
for(const c of components.values()){assert.equal(new Set(c.terminals.map(t=>t.id)).size,c.terminals.length);c.root.updateMatrixWorld(true);for(const t of c.terminals)assert.ok(t.object.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite));}
for(const comp of components.values()){for(const terminal of comp.terminals){let visuals=0;terminal.object.traverse(o=>{if(o.isMesh&&o.material.opacity!==0)visuals++;});assert.ok(visuals>0,comp.def.id+':'+terminal.id+' must retain its visible geometry');}}
const c=components.get('MC1'),p=components.get('AP1').root.getWorldPosition(new T.Vector3());c.root.position.x+=50;world.updateMatrixWorld(true);assert.ok(Math.abs(components.get('AP1').root.getWorldPosition(new T.Vector3()).x-p.x-50)<.01);c.root.position.x-=50;
const camera=new T.PerspectiveCamera(40,4/3,1,4000),orbit=new HemisphereCamera(camera);
for(let a=-Math.PI*6;a<Math.PI*6;a+=.12)for(const e of [0,.5,Math.PI/2]){orbit.azimuth=a;orbit.elevation=e;orbit.update();assert.ok(Math.abs(camera.matrixWorld.elements[1])<1e-10);assert.ok(camera.position.y>=-1e-10);assert.ok(Math.abs(camera.quaternion.length()-1)<1e-10);}
assert.equal(clampElevation(-9),0);assert.equal(clampElevation(9),Math.PI/2);
console.log('PASS: 22 components; 46/13 terminal pairs; 11-pin socket; 8 auxiliary terminals; stable unique IDs; attached AP moves with MC; continuous 3-turn hemisphere incl. exact poles; no roll.');
if(process.argv.includes('--render')){const renderer=new SVGRenderer();renderer.setSize(1600,1200);renderer.setQuality('high');renderer.overdraw=.1;scene.traverse(o=>{if(o.isMesh&&o.material.opacity===0)o.visible=false;});for(const preset of ['perspective','top','side']){orbit.preset(preset);orbit.radius=1080;orbit.update();scene.updateMatrixWorld(true);renderer.render(scene,camera);let svg=renderer.domElement.outerHTML.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');await sharp(Buffer.from(svg)).flatten({background:'#c5d4ce'}).png().toFile(`/workspace/scratch/89a08738cc2b/model-${preset}.png`);console.log(`Rendered CPU geometry: ${preset}, faces=${renderer.info.render.faces}`);}}
