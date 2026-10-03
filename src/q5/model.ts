/** B5 visual research model. Dimensions and terminal coordinates are NOT field measurements. */
export type Vec3=readonly[number,number,number];
export type Shape={type:'box';size:Vec3}|{type:'cylinder';radius:number;height:number;topRadius?:number;segments?:number}|{type:'torus';radius:number;tube:number}|{type:'sphere';radius:number;scale:Vec3}|{type:'label';text:string;width:number;height:number;background:string;foreground:string};
export interface ModelNode{id:string;position:Vec3;rotation:Vec3;color:string;opacity:number;layer:'body'|'label'|'hardware'|'cover';componentId?:string;shape?:Shape;children:ModelNode[]}
export interface PhotoTerminal{id:string;printedId:string|null;position:Vec3;exitDirection:Vec3;positionVerified:boolean;identityVerified:boolean;wiringEnabled:false;note:string}
export interface PhotoComponent{id:string;name:string;kind:string;model:string;parent:'base'|'operation';position:Vec3;rotation:Vec3;photos:string[];terminals:PhotoTerminal[];description:string;logicalRole:string|null;photoLabel?:string;dimensionsMeasured:false}
export interface ModelIssue{id:string;title:string;components:string[];request:string;severity:'mapping'|'optional'}
export interface Q5Model{version:'Q5-MODEL-V1';examId:'01300-104305B';name:string;nominalPlateMm:Vec3;nominalOperationPlateMm:Vec3;measuredFromPhysicalPanel:false;electricalSimulationEnabled:false;routingMode:'unconfigured-no-duct';photos:string[];components:PhotoComponent[];nodes:ModelNode[];issues:ModelIssue[]}
const ZERO:Vec3=[0,0,0],TOP:Vec3=[-Math.PI/2,0,0];
const C={board:'#c5c2a4',white:'#dedfd8',black:'#1f2426',dark:'#101519',metal:'#aab3b8',silver:'#d7dedf',copper:'#b57a43',blue:'#155093',green:'#176b55',red:'#68191d'};
export function* flattenNodes(nodes:readonly ModelNode[]):Generator<ModelNode>{for(const n of nodes){yield n;yield* flattenNodes(n.children);}}
function group(id:string,position:Vec3=ZERO,rotation:Vec3=ZERO):ModelNode{return{id,position,rotation,color:C.black,opacity:1,layer:'body',children:[]};}
class Parts{
 private sequence=0;
 constructor(readonly root:ModelNode,readonly componentId?:string){}
 add(shape:Shape,position:Vec3,color=C.black,rotation:Vec3=ZERO,opacity=1,layer:ModelNode['layer']='body'):ModelNode{const n:ModelNode={id:`${this.root.id}/${++this.sequence}`,shape,position,rotation,color,opacity,layer,componentId:this.componentId,children:[]};this.root.children.push(n);return n;}
 box(size:Vec3,p:Vec3,color=C.black,rotation:Vec3=ZERO,opacity=1,layer:ModelNode['layer']='body'):void{this.add({type:'box',size},p,color,rotation,opacity,layer);}
 cylinder(radius:number,height:number,p:Vec3,color=C.black,rotation:Vec3=ZERO,topRadius=radius,segments=24):void{this.add({type:'cylinder',radius,height,topRadius,segments},p,color,rotation);}
 ring(radius:number,tube:number,p:Vec3,color=C.metal,rotation:Vec3=[Math.PI/2,0,0]):void{this.add({type:'torus',radius,tube},p,color,rotation,1,'hardware');}
 label(text:string,width:number,height:number,p:Vec3,foreground='#24383d',background=C.white,rotation:Vec3=TOP):void{this.add({type:'label',text,width,height,foreground,background},p,foreground,rotation,1,'label');}
 screw(p:Vec3,r=2.7):void{const[x,y,z]=p;this.box([r*3,.9,r*3],[x,y-1,z],C.metal,ZERO,1,'hardware');this.cylinder(r*1.22,.65,[x,y-.2,z],C.silver);this.cylinder(r,1.6,[x,y+1,z],C.metal);this.box([r*1.35,.2,.65],[x,y+1.86,z],C.dark,ZERO,1,'hardware');this.box([.65,.2,r*1.35],[x,y+1.87,z],C.dark,ZERO,1,'hardware');}
 terminal(c:PhotoComponent,id:string,printedId:string|null,p:Vec3,visible:boolean,note='',direction:Vec3=[0,1,0]):void{c.terminals.push({id,printedId,position:p,exitDirection:direction,positionVerified:visible,identityVerified:printedId!==null,wiringEnabled:false,note});this.screw(p);}
}
/** Builds fresh geometry and evidence metadata. Does not register any simulator terminal. */
export function buildQ5Model():Q5Model{
 const base=group('base'),operation=group('operation',[480,0,0],[0,0,Math.PI/2]),components:PhotoComponent[]=[];
 const photos=Array.from({length:22},(_,i)=>4592+i).map(n=>`IMG_${n}${[4596,4597,4598,4599,4600,4601].includes(n)?'(1)':''}.jpeg`);
 const make=(id:string,name:string,kind:string,model:string,position:Vec3,parent:'base'|'operation',description:string,refs:number[],rotation:Vec3=ZERO):[PhotoComponent,Parts]=>{
  const c:PhotoComponent={id,name,kind,model,position,parent,rotation,description,photos:refs.map(n=>photos[n-4592]),terminals:[],logicalRole:id,dimensionsMeasured:false};const n=group(id,position,rotation);n.componentId=id;(parent==='base'?base:operation).children.push(n);components.push(c);return[c,new Parts(n,id)];
 };
 const bp=new Parts(base);bp.box([480,2,350],[240,-1,175],C.board);
 for(const z of [1,349])bp.box([480,24,2],[240,-14,z],C.board);for(const x of [1,479])bp.box([2,24,346],[x,-14,175],C.board);
 bp.label('B5  ·  PUMP ALTERNATION',135,9,[124,.2,343],'#435653',C.board);
 const op=new Parts(operation);op.box([270,2,350],[135,0,175],C.board);
 for(const z of [30,175,320]){op.cylinder(4.5,2.3,[14,0,z],C.dark);if(z!==175)op.cylinder(6,4,[14,-3,z],C.metal,ZERO,6,6);}
 op.label('第五題 · 二台抽水機交替運轉控制',210,16,[136,1.2,23],'#7b3432','#e4dfca');
 const rail=(x:number,z:number,length:number,rot=0):void=>{const n=group(`rail-${x}-${z}`,[x,2,z],[0,rot,0]);base.children.push(n);const p=new Parts(n);p.box([length,1.5,25],[0,0,0],C.metal);for(const zz of [-15,15]){p.box([length,4,1.5],[0,2,zz],C.silver);p.box([length,1.2,4],[0,4,zz],C.silver);}for(let xx=-length/2+12;xx<length/2-5;xx+=30)p.box([12,.2,4],[xx,.86,0],'#798087');};
 rail(197,80,242);rail(192,192,184);rail(187,320,200);rail(407,97,132,Math.PI/2);rail(443,252,165,Math.PI/2);rail(335,235,67);
 {
  const[c,p]=make('MCCB','無熔線斷路器','breaker','Shihlin NF100-SN · 3P / 30A',[44,3,74],'base','六個 LINE／LOAD 端子與型號可辨識；外殼尺寸按照片比例近似。',[4601,4602,4603,4604]);
  p.box([90,26,124],[0,13,0],C.black);p.box([88,35,89],[0,43,0],C.white);p.box([76,5,79],[0,63,0],C.white);
  for(const z of [-54,54]){for(const x of [-30,0,30]){p.box([24,17,23],[x,28,z],C.dark);p.terminal(c,`${z<0?'LINE':'LOAD'}-${x/30+2}`,null,[x,36,z],true,'相別名稱按所在面區分；螺絲座標為近似。');}for(const x of [-44,-15,15,44])p.box([3,40,30],[x,39,z],C.white);}
  p.label('Shihlin\nNF100-SN',25,51,[-26,66,0],'#ffffff',C.blue);p.label('3P · 30 A\nMCCB',24,51,[26,66,0],'#ffffff',C.blue);
  p.box([23,3,46],[0,67,0],C.dark);p.label('O\nOFF',18,23,[0,69,-8],'#ffffff',C.green);p.box([17,25,13],[0,80,11],C.blue,[-.2,0,0]);p.label('30 A',15,8,[0,93,11],'#ffffff',C.blue);p.cylinder(4,2,[27,67,32],C.red);p.label('LINE',24,7,[0,63,-39]);p.label('LOAD',24,7,[0,63,39]);
 }
 for(const[index,x]of [[1,112],[2,133]] as const){
  const[c,p]=make(`F${index}`,'卡式保險絲座','fuse','CT-FB101LA · 10 × 38',[x,5,75],'base','照片可讀的是座體型號與 10×38 尺寸；內部熔絲安培數未拍到。教材要求 2A。',[4599,4600]);
  p.box([18,12,60],[0,6,0],C.white);p.box([18,37,43],[0,30,0],C.white);p.box([15,8,28],[0,52,0],C.white);p.label('CT-FB101LA\n10×38',15,18,[0,56,-8]);p.box([12,1,6],[0,56,10],'#b45861');
  for(const z of [-26,26]){p.cylinder(3,1,[0,14,z],C.dark);p.terminal(c,z<0?'SIDE-A':'SIDE-B',null,[0,10,z],true,'座體兩端可見；未指定原廠端號。');}
 }
 {
  const[c,p]=make('MR','交替電驛','ratchet','OMRON G4Q-212S',[207,6,75],'base','透明罩、棘輪機構及型號可辨識；外部底座端號被遮住。八個點僅代表待核對的插座區域，不是已驗證接腳排列。',[4599,4600]);
  p.box([67,12,62],[0,6,0],C.black);p.box([56,47,47],[0,35,0],'#b5a777');p.cylinder(17,35,[0,33,0],'#c89640',[Math.PI/2,0,0]);
  p.box([43,3,41],[0,58,0],C.metal);p.box([14,32,36],[0,53,0],C.metal);for(const x of [-25,25]){p.box([4,65,8],[x,42,-10],C.copper);p.screw([x,72,-10]);}
  p.cylinder(10,6,[0,37,27],C.white,[Math.PI/2,0,0]);p.box([63.5,75,65],[0,57,0],'#c8dfe3',ZERO,.17,'cover');p.label('OMRON\nG4Q-212S',42,17,[0,95,-9]);p.box([6,8,15],[0,6,37],'#b45b26');
  for(let i=0;i<8;i++)p.terminal(c,`SOCKET-POSITION-${i+1}`,null,[(i%4-1.5)*14,9,i<4?-34:34],false,'不可依這個示意位置猜測底座 1–8 號接腳；需底座端號或原廠對應圖。');
 }
 for(const[i,x]of [[1,145],[2,232]] as const){
  const[c,p]=make(`MC${i}`,'電磁接觸器','contactor','Shihlin S-P21',[x,5,192],'base','主端號及 13/14、21/22 輔助接點文字可讀；線圈與深層螺絲端號尚待確認。',[4605,4606,4607,4608,4609]);
  p.box([63,18,78],[0,9,0]);p.box([59,39,62],[0,34,0]);p.box([55,11,46],[0,59,0],C.white);p.box([25,10,26],[0,67,0],C.dark);p.box([17,7,14],[0,71,0],'#434a4f');
  for(const z of [-34,34]){for(const[index,xx]of [-21,0,21].entries()){p.box([16,23,22],[xx,29,z],C.dark);const id=z<0?['1L1','3L2','5L3'][index]:['2T1','4T2','6T3'][index];p.terminal(c,id,id,[xx,43,z],true,'主端子標字清楚，坐標仍為近似。');}for(const xx of [-31,-10,10,31])p.box([2,32,30],[xx,37,z]);}
  p.label('S-P21',19,12,[-17,65,-6]);p.label('1L1       3L2       5L3',51,7,[-2,65,-20]);p.label('2T1       4T2       6T3',51,7,[-2,65,20]);
  p.box([16,42,60],[39,31,0]);p.box([16,7,44],[39,57,0],C.white);p.label('13 NO\n21 NC\n22 NC\n14 NO',14,34,[39,61,0]);
  for(const[id,z,y,visible]of [['13',-30,47,true],['14',30,47,true],['21',-19,29,false],['22',19,29,false]] as const)p.terminal(c,id,id,[39,y,z],visible,'13/14、21/22 標字已見；深層螺絲的精確對應仍需核對。');
  for(const[k,xx]of [-13,13].entries())p.terminal(c,`COIL-POSITION-${k+1}`,null,[xx,18,-49],false,'此處只預留線圈端子區域，不指定 A1/A2。');
  p.label('Shihlin · S-P21',39,16,[-30,31,0],'#253a40',C.white,[0,-Math.PI/2,0]);
  const[t,q]=make(`TH-RY${i}`,'積熱過載電驛','overload','Shihlin TH-P20',[x,5,263],'base','三相主回路與前方控制接點可見；四個控制螺絲的端號被壓接端子與導線遮擋。三條主回路不等於三個加熱素子。',[4608,4609,4610]);
  q.box([67,28,55],[0,14,0]);q.box([26,20,45],[40,33,-5]);q.cylinder(9,3,[37,44,-11],C.white);q.label('2.5  3.3\n4.1',15,12,[37,46,-11]);q.cylinder(5,9,[48,43,10],C.blue);
  for(const z of [-22,22])for(const[k,xx]of [-21,0,21].entries())q.terminal(t,`${z<0?'IN':'OUT'}-${k+1}`,null,[xx,29,z],true,'主回路位置可見，未臆測未拍清楚的原廠印字。');
  for(const[i2,xx,z]of [[0,31,20],[1,47,20],[2,31,35],[3,47,35]] as const)q.terminal(t,`CONTROL-POSITION-${i2+1}`,null,[xx,i2<2?30:12,z],false,'需確認常開／常閉控制接點與端號，不猜 95/96/97/98。');
  for(const xx of [-21,0,21]){q.box([7,2,26],[xx,31,-36],C.metal);q.box([7,12,2],[xx,36,-47],C.metal);}
  q.label('TH-P20',37,15,[-34,19,0],'#24363d',C.white,[0,-Math.PI/2,0]);bp.label(`MC${i} / TH-RY${i}`,61,8,[x,0.3,302],'#476b79',C.board);
 }
 {
  const[c,p]=make('FS','液面控制器（含電驛模組）','level','OMRON 61F-G + 61F-11',[325,5,97],'base','這是一套液面控制器；61F-11 是右側電驛模組，不是第二台 FS。九端子的標字與排列可從近照辨識。',[4597,4598]);
  p.box([93,12,92],[0,6,0],'#b4b4a3');p.box([93,6,109],[0,3,0],'#b4b4a3');for(const x of [-43,43])for(const z of [-45,45])p.screw([x,7,z],2.2);
  for(const x of [-23,23]){p.box([43,53,69],[x,38,-11],'#c0bfab');p.box([40,3,64],[x,66,-11],C.white);p.label(x<0?'OMRON\n61F-G\nFLOATLESS\nLEVEL SWITCH':'OMRON\n61F-11\nRELAY UNIT',36,27,[x,68,-27]);p.label(x<0?'SOURCE 110/220 VAC\n50/60 Hz\nSECONDARY 8 VAC':' ',36,27,[x,68,3],'#ffffff','#353c3e');}
  p.cylinder(2.3,1,[37,68,-37],C.red);p.box([89,12,28],[0,13,37],'#bbbba9');
  const upper=['Ta','Tc','Tb','E2','E1'];for(const[i,id]of upper.entries()){const x=(i-2)*18;p.terminal(c,id,id,[x,21,27],true,'照片可讀，9 點中前排五點。');p.label(id,14,5,[x,23,18]);}
  for(const[i,id]of ['S0','S1','S2','E3'].entries()){const x=(i-1.5)*18;p.terminal(c,id,id,[x,10,48],true,'照片可讀，後排四點；S1 即使未接線仍保留。');p.label(id,13,5,[x,12,39]);}
  bp.label('FS',26,10,[325,.3,33],'#476b79',C.board);
 }
 const strip=(id:string,n:number,pos:Vec3,rot:number,description:string,refs:number[],labels?:string[]):void=>{
  const[c,p]=make(id,'端子台','terminalStrip',`${n}P · 雙側螺絲`,pos,'base',description,refs,[0,rot,0]);const pitch=12.5,len=n*pitch+8;p.box([len,8,32],[0,4,0]);
  for(let i=0;i<n;i++){const x=(i-(n-1)/2)*pitch;p.box([pitch-2,4,28],[x,10,0],C.dark);p.box([1.6,17,36],[x-pitch/2,15,0]);for(const z of [-10,10])p.terminal(c,`${i+1}-${z<0?'A':'B'}`,labels?.[i]??null,[x,12,z],true,'螺絲位置可見；無印字者只使用模型節位編號，不宣稱是現場線號。');p.label(labels?.[i]??String(i+1),9,5,[x,15,0]);}p.box([1.6,17,36],[n*pitch/2,15,0]);
  for(const x of [-len/2-5,len/2+5]){p.box([8,4,38],[x,2,0],C.metal);p.screw([x,5,0],2);}
 };
 strip('TB1',4,[161,6,324],0,'教材列出的第一組 4P 負載端子台。',[4605,4610]);strip('TB2',4,[249,6,324],0,'教材列出的第二組 4P 負載端子台。',[4605,4610]);
 strip('TB3',12,[443,6,252],Math.PI/2,'教材列出的 12P 操作板轉接端子台；最後一節為照片中的備用節位。',[4611]);
 strip('TB-FS',9,[408,6,96],Math.PI/2,'照片額外配置的液面控制器轉接台，不併入教材 TB3。線套可見名稱不是新增元件原廠端號。',[4597,4598],['Ta','Tc','Tb','E2','E1','S0','S1','S2','E3']);
 strip('TB-E',3,[336,6,241],0,'照片額外配置的電極棒三節轉接台；與每支電極的對應尚待核對。',[4592,4595]);
 {
  const[c,p]=make('ELECTRODES','電極棒與固定座','electrode','三棒式液面感測座（型號待確認）',[339,6,307],'base','黑色螺紋座及三支棒可建外觀；E1/E2/E3 對應未拍清楚，不依長短替實物端子命名。',[4613]);
  p.box([75,3,65],[0,2,0],C.metal);for(const x of [-29,29])p.screw([x,5,22]);p.cylinder(37,26,[0,40,0],C.black,[Math.PI/2,0,0],37,40);p.cylinder(30,25,[0,40,24],C.dark,[Math.PI/2,0,0],30,40);
  for(let z=14;z<37;z+=3)p.ring(30,1,[0,40,z],C.black,[0,0,0]);p.cylinder(10,28,[0,81,-4],C.black,ZERO,6);p.box([67,10,47],[0,63,-6]);
  for(const[i,x,y,len]of [[0,-12,41,35],[1,11,38,17],[2,0,26,25]] as const){p.cylinder(2.4,len,[x,y,34+len/2],C.metal,[Math.PI/2,0,0]);c.terminals.push({id:`ROD-${i+1}`,printedId:null,position:[x,y,34+len],exitDirection:[0,0,1],positionVerified:true,identityVerified:false,wiringEnabled:false,note:'僅記錄看得到的棒端區域；E1/E2/E3 與導線映射未確認。'});}
  bp.label('電極棒',48,10,[339,.3,346],'#476b79',C.board);
 }
 {
  const[c,p]=make('PE','接地銅板','earth','四接線點、雙支架',[46,4,325],'base','四個接線螺絲與兩端支架可辨識；不把支架固定螺絲算成接線端子。',[4592,4595]);
  for(const x of [-34,34])p.box([12,10,24],[x,5,0]);p.box([80,3,16],[0,11,0],C.copper);for(const[i,x]of [-23,-8,8,23].entries())p.terminal(c,`PE-${i+1}`,'PE',[x,14,0],true,'四個接線點。');bp.label('PE',24,8,[46,.3,345],'#476b79',C.board);
 }
 for(const[id,x,name,color,photoLabel]of [['RED-LEFT',202,'左側紅色指示燈',C.red,''],['WL',136,'電源指示燈','#e4e7dc','WL'],['RED-RIGHT',70,'右側紅色指示燈',C.red,'RL1']] as const){
  const[c,p]=make(id,name,'lamp','AUSPICIOUS PLR-30',[x,0,169],'operation','燈體正反面與兩個接線端子可見；紅燈實物標籤與教材配置不同，先以左右位置辨識。',[4596,4612]);c.photoLabel=photoLabel;c.logicalRole=id==='WL'?'WL':null;
  p.box([38,33,37],[0,23,0]);p.cylinder(16,12,[0,5,0]);p.ring(17,2,[0,-4,0],C.metal);p.cylinder(15,7,[0,-7,0],color);p.add({type:'sphere',radius:14.2,scale:[1,.3,1]},[0,-11,0],color);p.label(photoLabel||'紅燈（代號待確認）',47,7,[0,-1.2,-24],'#334b53',C.board,[Math.PI/2,0,0]);p.label('AUSPICIOUS\nPLR-30',27,15,[0,40,0]);
  for(const[k,z]of [-11,11].entries())p.terminal(c,`LAMP-${k+1}`,null,[23,25,z],true,'兩端區域可見；未指定原廠端號。');
 }
 for(const[id,x,text]of [['COS1',169,'M  OFF  A'],['COS2',103,'A  OFF  B']] as const){
  const[c,p]=make(id,'三段選擇開關','selector','三段式・中位 OFF・端號待確認',[x,0,242],'operation','三個檔位與背面接點塊可辨識；各螺絲與旋轉方向的導通對應仍須核對。',[4596,4612]);
  p.cylinder(16,14,[0,4,0]);p.ring(18,2,[0,-4,0],C.metal);p.cylinder(16,8,[0,-7,0],C.black);p.box([8,10,27],[0,-15,0],C.dark);p.box([3,1,20],[0,-20.5,0],C.white);p.box([41,33,30],[0,33,0]);p.box([40,3,29],[0,51,0],C.metal);
  for(const[i,x1,z]of [[0,-11,-9],[1,11,-9],[2,-11,9],[3,11,9]] as const)p.terminal(c,`CONTACT-POSITION-${i+1}`,null,[x1,53,z],true,'接點塊上的螺絲可見，但端號與檔位導通配對尚未確認。');
  p.label(`${id}\n${text}`,57,14,[0,-1.2,-29],'#334b53',C.board,[Math.PI/2,0,0]);
 }
 {
  const[c,p]=make('BZ','蜂鳴器','buzzer','AUSPICIOUS · 盤面型（完整型號待確認）',[136,0,91],'operation','正面的發聲柵格、背面灰色外殼與兩端子可辨識。',[4593,4612]);
  p.box([45,40,42],[0,24,0],'#7c8588');p.box([49,4,44],[0,5,0],'#778388');p.cylinder(16,8,[0,-5,0],C.dark);p.ring(18,2,[0,-8,0],C.metal);
  for(const r of [5,10,14])p.ring(r,.9,[0,-10,0],'#748285');for(let i=0;i<6;i++)p.box([1,1,29],[0,-10,0],'#748285',[0,i*Math.PI/3,0]);
  for(const[k,z]of [-25,25].entries())p.terminal(c,`BUZZER-${k+1}`,null,[0,16,z],true,'接線區域清楚；未辨識原廠端號。');p.label('BZ',25,8,[0,-1.2,-27],'#334b53',C.board,[Math.PI/2,0,0]);
 }
 const issues:ModelIssue[]=[
  {id:'mr-socket',title:'1 · MR 底座端號',components:['MR'],severity:'mapping',request:'補底座側面的端號／型號，或同型未接線備品與接腳圖；不要拆示範盤。'},
  {id:'mc-thermal',title:'2 · MC 線圈與 TH 控制接點',components:['MC1','MC2','TH-RY1','TH-RY2'],severity:'mapping',request:'補斜上／斜側近照，讓線圈及較深接點的標字可讀；有同型備品照片也可。'},
  {id:'selectors',title:'3 · COS 接點配置',components:['COS1','COS2'],severity:'mapping',request:'補背面端號、完整型號或接點圖，確認三個檔位對應哪組螺絲。'},
  {id:'electrodes',title:'4 · 電極棒與導線對應',components:['ELECTRODES','TB-E'],severity:'mapping',request:'補 E1/E2/E3 標示或原廠接線圖；目前只確認外觀，不依猜測分配端號。'},
  {id:'lamp-mapping',title:'5 · 左右紅燈代號',components:['RED-LEFT','RED-RIGHT'],severity:'mapping',request:'照片右側標 RL1，而教材配置右側是 RL2。確認現場兩燈對應即可，不必為此通電。'},
  {id:'physical-size',title:'實物尺寸（可選）',components:[],severity:'optional',request:'目前依題目標稱板材尺寸與照片比例建模；只有需要實測 1:1 CAD 時才需補尺度。'}
 ];
 return{version:'Q5-MODEL-V1',examId:'01300-104305B',name:'二台抽水機交替運轉控制',nominalPlateMm:[480,350,2],nominalOperationPlateMm:[270,350,2],measuredFromPhysicalPanel:false,electricalSimulationEnabled:false,routingMode:'unconfigured-no-duct',photos,components,nodes:[base,operation],issues};
}
