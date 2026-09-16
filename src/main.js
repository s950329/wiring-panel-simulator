import './style.css';
import {startProjectApp} from './project/app.js';
import {installLocalization} from './i18n/browser.ts';
const localization = installLocalization(document.querySelector('#app'));
function exposeLocale(){
 Object.assign(window.wiringLab,{getLocale:()=>localization.controller.locale.id,setLocale:locale=>localization.controller.setPreference(locale)});
 const dispose=window.wiringLab.dispose;
 window.wiringLab.dispose=()=>{localization.dispose();dispose?.();};
}
// Historical component snapshots retain an explicit compatibility entry point.
if(location.pathname.endsWith('/mc1.html')||['legacy','inspect'].some(key=>new URLSearchParams(location.search).get(key)==='MC1')){
 import('./legacy-inspector.js').then(exposeLocale);
}else { startProjectApp(); exposeLocale(); }
