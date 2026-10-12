import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../public/game-audio.js',import.meta.url),'utf8');
function harness(){
 let now=1000;const started=[],listeners={};
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),pan:param(),threshold:param(),ratio:param(),connect(){},disconnect(){},start(){started.push(this)},stop(){this.onended?.()}});
 class Audio{constructor(){this.state='running';this.currentTime=0;this.sampleRate=1000;}createGain(){return node()}createDynamicsCompressor(){return node()}createBiquadFilter(){return node()}createBufferSource(){return node()}createOscillator(){return node()}createStereoPanner(){return node()}createBuffer(){return {getChannelData:()=>new Float32Array(800)}}}
 const el=()=>({style:{},setAttribute(){},appendChild(){}});
 const c=vm.createContext({window:{AudioContext:Audio},document:{hidden:false,addEventListener:(k,v)=>listeners[k]=v,createElement:el,body:el()},localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now},myPlayer:{id:'me',x:0,y:0,hp:200,clipAmmo:0,kills:0,teamId:'team_1'},isSpectating:false,spectateTarget:null,hasLineOfSight:()=>true,getCombatEntityById:()=>({weapon:'ar'}),addGunshotEvent(){},playNearbyStep(){},update(){},gameStarted:true,gameEnded:false,zoneStage:1,selectedMode:'normal',spikeState:null});
 vm.runInContext(code,c);return {c,started,listeners,run:s=>vm.runInContext(s,c),advance:()=>now+=1000};
}
test('audio waits for gesture, supports all effects, limits distance, mute and hidden tabs',()=>{
 const h=harness();h.run("GameAudio.emit('ar')");assert.equal(h.started.length,0);assert(h.listeners.keydown&&h.listeners.touchstart);h.listeners.pointerdown();
 for(const effect of ['ar','sniper','shotgun','reload','ready','hurt','kill','death','step','pickup','start','end','warning','plant','use','half','defuse','beep','explode']){const n=h.started.length;h.advance();h.run(`GameAudio.emit('${effect}')`);assert(h.started.length>n,effect);}
 let n=h.started.length;h.advance();h.run("GameAudio.emit('ar',{x:2000,y:0})");assert.equal(h.started.length,n);
 h.run("GameAudio.setVolume(0);GameAudio.emit('ar')");assert.equal(h.started.length,n);
 h.run("GameAudio.setVolume(.5);document.hidden=true;GameAudio.emit('ar')");assert.equal(h.started.length,n);
});
test('poll generates damage, reload, mode transitions and half-defuse effects',()=>{
 const h=harness();h.listeners.keydown();const pulse=()=>{h.advance();h.run('GameAudio.poll()');};pulse();
 for(const change of ["myPlayer.hp=150","myPlayer.isReloading=true","myPlayer.isReloading=false;myPlayer.clipAmmo=30","myPlayer.kills=1","selectedMode='br';zoneStage=2","selectedMode='spike';spikeState={round:1,phase:'prep',bomb:{},attackTeam:1}","spikeState.phase='live'","spikeState.phase='planted';spikeState.time=40;spikeState.bomb={x:0,y:0,planted:true}","spikeState.bomb.defuseCheckpoint=3.5","spikeState.phase='end';spikeState.result='스파이크 해체'"]){const n=h.started.length;h.run(change);pulse();assert(h.started.length>n,change);}
});
