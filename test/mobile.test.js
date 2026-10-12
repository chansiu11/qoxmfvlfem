import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function surface(){const listeners=new Map();return {style:{},dataset:{},classList:{add(){},remove(){}},clientWidth:1000,clientHeight:700,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700}),getContext:()=>({}),addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},emit(type,event={}){for(const fn of listeners.get(type)||[])fn(event);}};}
test('mobile aiming never shoots; fire button release is independent and cancellation stops fire',()=>{
 const elements=new Map(),window=surface(),document=Object.assign(surface(),{getElementById(id){if(!elements.has(id))elements.set(id,surface());return elements.get(id);},createElement:surface,querySelectorAll:()=>[]});
 const context=vm.createContext({window,document,performance,console,setTimeout,clearTimeout,setInterval,clearInterval});
 vm.runInContext(fs.readFileSync(new URL('../public/game-core.js',import.meta.url),'utf8'),context);
 vm.runInContext('isMobile=true;myPlayer.weapon="sniper";myPlayer.clipAmmo=5;initMobileControls();',context);
 const touch=(id)=>({identifier:id,clientX:600,clientY:250});
 const emit=(target,type,id)=>target.emit(type,{changedTouches:[touch(id)],preventDefault(){},stopPropagation(){}});
 const aim=elements.get('aimTouchArea'),fire=elements.get('btnFire');
 emit(aim,'touchstart',1);assert.equal(vm.runInContext('myPlayer.isAiming&&!myPlayer.isShooting',context),true);
 emit(fire,'touchstart',2);assert.equal(vm.runInContext('myPlayer.isShooting',context),true);
 emit(window,'touchend',1);assert.equal(vm.runInContext('myPlayer.isShooting&&!myPlayer.isAiming&&myPlayer.clipAmmo===5',context),true);
 emit(window,'touchcancel',2);assert.equal(vm.runInContext('myPlayer.isShooting',context),false);
 emit(fire,'touchstart',3);window.emit('blur');assert.equal(vm.runInContext('myPlayer.isShooting',context),false);
});
