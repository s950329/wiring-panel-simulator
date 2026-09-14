import './style.css';
import {startProjectApp} from './project/app.js';
// Historical component snapshots retain an explicit compatibility entry point.
if(location.pathname.endsWith('/mc1.html')||['legacy','inspect'].some(key=>new URLSearchParams(location.search).get(key)==='MC1')){
 import('./legacy-inspector.js');
}else startProjectApp();
