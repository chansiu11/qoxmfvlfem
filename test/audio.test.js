import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../public/game-audio.js',import.meta.url),'utf8');
function harness(){
 let now=1000;const started=[],listeners={},handlers={},panners=[];
 const param=()=>({value:0,setValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}});
 const node=()=>({gain:param(),frequency:param(),pan:param(),threshold:param(),ratio:param(),connect(){},disconnect(){},start(){started.push(this)},stop(t){this.stopAt=t;this.onended?.()}});
 class Audio{constructor(){this.state='running';this.currentTime=0;this.sampleRate=1000;}createGain(){return node()}createDynamicsCompressor(){return node()}createBiquadFilter(){return node()}createBufferSource(){return node()}createOscillator(){return node()}createPanner(){const n={...node(),positionX:param(),positionY:param(),positionZ:param()};panners.push(n);return n;}createStereoPanner(){return node()}createBuffer(){return {getChannelData:()=>new Float32Array(800)}}}
 const el=()=>({style:{},setAttribute(){},appendChild(){}});
 const c=vm.createContext({window:{AudioContext:Audio},document:{hidden:false,addEventListener:(k,v)=>{(handlers[k]||=[]).push(v);listeners[k]=(e={type:k})=>handlers[k].forEach(f=>f(e));},createElement:el,body:el()},localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>now},isHost:true,safeSend:(c,d)=>c.send(d),handleNetworkData(){},myPlayer:{id:'me',x:0,y:0,hp:200,clipAmmo:0,kills:0,teamId:'team_1'},isSpectating:false,spectateTarget:null,hasLineOfSight:()=>true,getCombatEntityById:()=>({weapon:'ar'}),addGunshotEvent(){},playNearbyStep(){},update(){},gameStarted:true,gameEnded:false,zoneStage:1,selectedMode:'normal',spikeState:null});
 vm.runInContext(code,c);return {c,started,listeners,panners,run:s=>vm.runInContext(s,c),advance:()=>now+=1000};
}
test('audio waits for gesture, supports all effects, limits distance, mute and hidden tabs',()=>{
 const h=harness();h.run("GameAudio.emit('ar')");assert.equal(h.started.length,0);assert(h.listeners.keydown&&h.listeners.touchstart);h.listeners.pointerdown();
 for(const effect of ['click','select','open','close','error','empty','equip','drop','heal','revive','cancel','door','break','glass','impact','hit','tick','ar','sniper','shotgun','reload','ready','hurt','kill','death','step','pickup','start','end','warning','plant','use','half','defuse','beep','explode']){const n=h.started.length;h.advance();h.run(`GameAudio.emit('${effect}')`);assert(h.started.length>n,effect);}
 let n=h.started.length;h.advance();h.run("GameAudio.emit('ar',{x:2000,y:0})");assert.equal(h.started.length,n);
 h.run("GameAudio.setVolume(0);GameAudio.emit('ar')");assert.equal(h.started.length,n);
 h.run("GameAudio.setVolume(.5);document.hidden=true;GameAudio.emit('ar')");assert.equal(h.started.length,n);
});
test('poll generates damage, reload, mode transitions and half-defuse effects',()=>{
 const h=harness();h.listeners.keydown();const pulse=()=>{h.advance();h.run('GameAudio.poll()');};pulse();
 for(const change of ["myPlayer.hp=150","myPlayer.isReloading=true","myPlayer.isReloading=false;myPlayer.clipAmmo=30","myPlayer.kills=1","selectedMode='br';zoneStage=2","selectedMode='spike';spikeState={round:1,phase:'prep',bomb:{},attackTeam:1}","spikeState.phase='live'","spikeState.phase='planted';spikeState.time=40;spikeState.bomb={x:0,y:0,planted:true}","spikeState.bomb.defuseCheckpoint=3.5","spikeState.phase='end';spikeState.result='스파이크 해체'"]){const n=h.started.length;h.run(change);pulse();assert(h.started.length>n,change);}
});
test('headphone HRTF preserves left/right and front/back, follows spectated listener, and centres UI sounds',()=>{
 const h=harness();h.listeners.keydown();
 for(const [x,y,axis,sign] of [[-200,0,'positionX',-1],[200,0,'positionX',1],[0,-200,'positionZ',-1],[0,200,'positionZ',1]]){
  h.advance();h.run(`GameAudio.emit('ready',{x:${x},y:${y}})`);const p=h.panners.at(-1);assert.equal(p.panningModel,'HRTF');assert.equal(Math.sign(p[axis].value),sign);
 }
 h.advance();h.run("isSpectating=true;spectateTarget={x:300,y:0};GameAudio.emit('ready',{x:200,y:0})");assert(h.panners.at(-1).positionX.value<0);
 const count=h.panners.length;h.advance();h.run("GameAudio.emit('click')");assert.equal(h.panners.length,count);
});
test('button, mobile button and setting feedback handles one input without duplicate click',()=>{
 const h=harness(),target={closest(){return this},matches:()=>false};
 h.listeners.click({type:'click',target});assert(h.started.length>0);
 h.advance();const before=h.started.length;h.listeners.click({type:'click',target:{...target,disabled:true}});assert.equal(h.started.length,before);
 const mobile={...target,matches:()=>true};h.listeners.pointerdown({type:'pointerdown',target:mobile});assert(h.started.length>before);
 const once=h.started.length;h.listeners.click({type:'click',target:mobile});assert.equal(h.started.length,once);
 h.advance();h.listeners.change({type:'change',target});assert(h.started.length>once);
});
test('world impacts piggyback existing sync, deduplicate on guests, and expire',()=>{
 const h=harness();h.listeners.keydown();h.run("globalThis.packets=[];globalThis.conn={send:d=>packets.push(d)};GameAudio.world('impact',{x:100,y:0});safeSend(conn,{type:'SYNC'});");
 assert.equal(h.run('packets.length'),1);assert.equal(h.run('packets[0].sfx.length'),1);
 h.advance();h.run('isHost=false;handleNetworkData(packets[0])');const heard=h.started.length;
 h.advance();h.run('handleNetworkData(packets[0])');assert.equal(h.started.length,heard);
 h.run("isHost=true;safeSend(conn,{type:'SYNC'})");assert.equal(h.run('packets[1].sfx'),undefined);
});

test('footsteps share event range and do not disappear at the old 320-unit cutoff',()=>{
 const h=harness();h.listeners.keydown();h.run("selectedMode='spike';playNearbyStep(1000,1600,{entityId:'enemy',x:1000,y:0})");assert(h.started.length>0);
 const n=h.started.length;h.advance();h.run("playNearbyStep(1600,1600,{entityId:'enemy',x:1600,y:0})");assert.equal(h.started.length,n);
 h.advance();h.run("playNearbyStep(10,0,{entityId:'quiet',x:10,y:0})");assert.equal(h.started.length,n);
 h.run("myPlayer.isMoving=true;myPlayer.movementMode='stealth';GameAudio.poll()");const afterStart=h.started.length;h.advance();h.run('GameAudio.poll()');assert.equal(h.started.length,afterStart);
});

test('every weapon emits a distinct firing signature through the network sound hook',()=>{
 const h=harness();h.listeners.keydown();const ids=['ar','sniper','shotgun','v_classic','v_shorty','v_frenzy','v_ghost','v_bandit','v_sheriff','v_stinger','v_spectre','v_bucky','v_judge','v_bulldog','v_guardian','v_phantom','v_vandal','v_warden','v_marshal','v_outlaw','v_operator','v_ares','v_odin'];const signatures=new Set();
 for(const id of ids){h.advance();const n=h.started.length;h.run(`addGunshotEvent(0,0,'other','${id}')`);const voices=h.started.slice(n);assert.equal(voices.length,3,id);signatures.add(JSON.stringify(voices.map(v=>[v.type,v.frequency.value,v.stopAt])));}
 assert.equal(signatures.size,ids.length);
});
