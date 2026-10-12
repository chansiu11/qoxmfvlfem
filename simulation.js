import vm from 'node:vm';
import fs from 'node:fs';
const core=fs.readFileSync(new URL('./public/game-core.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('./scripts/server-bridge.js',import.meta.url),'utf8');
const program=new vm.Script(core+'\n'+bridge,{filename:'room-simulation.js'});
// Minimal UI adapter for shared legacy functions. Rendering is never invoked.
export function createSimulation(){
 const elements=new Map(),timers=new Set();
 const noop=()=>{};
 const context2d=new Proxy({measureText:()=>({width:0})},{get:(obj,key)=>obj[key]||noop,set:(obj,key,value)=>(obj[key]=value,true)});
 function element(){return {style:{setProperty:noop},dataset:{},classList:{add:noop,remove:noop,toggle:noop},value:'',textContent:'',clientWidth:800,clientHeight:600,width:800,height:600,addEventListener:noop,removeEventListener:noop,appendChild:noop,replaceChildren:noop,getContext:()=>context2d,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),querySelectorAll:()=>[]};}
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener:noop,querySelectorAll:()=>[],documentElement:element(),body:element()};
 for(const [id,value] of Object.entries({gameModeSelect:'br',aiToggle:'true',aiCountInput:'10',aiDifficultySelect:'very_easy'}))document.getElementById(id).value=value;
 const clear=id=>{clearTimeout(id);clearInterval(id);timers.delete(id);};
 const sandbox={console,performance,document,innerWidth:800,innerHeight:600,addEventListener:noop,requestAnimationFrame:noop,alert:message=>{throw new Error(message);},
 setTimeout:(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;},
 setInterval:(fn,ms)=>{const id=setInterval(fn,ms);timers.add(id);return id;},clearTimeout:clear,clearInterval:clear};
 sandbox.window=sandbox;
 const context=vm.createContext(sandbox);program.runInContext(context,{timeout:2000});
 return {...context.roomAPI,dispose(){for(const t of timers)clear(t);},evaluate:source=>vm.runInContext(source,context)};
}
