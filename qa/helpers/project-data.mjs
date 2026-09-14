export const ep = (component, terminal) => ({component, terminal});
export function minimalProject() {
  return {format:'wiring-panel-project',schemaVersion:1,name:'測試專案',configuration:{
    units:{position:'scene-units',rotation:'degrees'},board:{id:'base',width:800,depth:640,thickness:7},
    operationPanel:null,rails:[],ducts:[{id:'main-duct',mountId:'base',position:[501,.5,208],rotationY:0,length:416,width:43}],
    components:[
      {id:'breaker',definitionId:'shihlin-t20',definitionVersion:1,placement:{mountId:'base',position:[732,7,70],rotationY:-90},state:{on:true}},
      {id:'coil',definitionId:'shihlin-sp16',definitionVersion:1,placement:{mountId:'base',position:[356,7,86],rotationY:-90}},
    ],assemblies:[],panelGateway:null},connections:[]};
}
export function withAssembly() {
  const p=minimalProject();
  p.configuration.assemblies.push({id:'drive',definitionId:'shihlin-sp16-accessories',definitionVersion:1,hostId:'coil'});
  p.configuration.components.push(
    {id:'aux',definitionId:'shihlin-ap22',definitionVersion:1,placement:{assemblyId:'drive',slot:'auxiliary'}},
    {id:'thermal',definitionId:'shihlin-th20',definitionVersion:1,placement:{assemblyId:'drive',slot:'overload'},parameters:{current:15},state:{trip:false}});
  return p;
}
