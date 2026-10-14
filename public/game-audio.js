/* Procedural game SFX. No downloads, external samples or additional network traffic. */
(function(root){
 let context=null,master=null,noise=null,volume=.55,voices=0;
 const limits=new Map(),activeSpatial=new Set();
 let headphones=true;
 try{headphones=localStorage.getItem('game-sfx-headphones')!=='off';}catch{}
 try{const saved=localStorage.getItem('game-sfx-volume');if(saved!==null)volume=Math.max(0,Math.min(1,Number(saved)||0));}catch{}
 function unlock(){
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   if(!context){context=new Audio();master=context.createGain();master.gain.value=volume*.55;
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=6;master.connect(compressor);compressor.connect(context.destination);
    noise=context.createBuffer(1,Math.ceil(context.sampleRate*.8),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }
   if(context.state==='suspended')return context.resume().catch(()=>{});
  }catch{context=null;}
 }
 for(const event of ['pointerdown','touchstart','keydown'])document.addEventListener(event,unlock,{passive:true});
 function layer(type,freq,end,duration,gain,pan=0,delay=0,position=null,occluded=false){
  if(!context||context.state!=='running'||!master||volume===0||document.hidden||voices>=28)return;
  const t=context.currentTime+delay,amp=context.createGain(),filter=context.createBiquadFilter();
  const source=type==='noise'?context.createBufferSource():context.createOscillator();
  filter.type='lowpass';filter.frequency.value=occluded?Math.min(650,freq):type==='noise'?freq:8000;
  if(type==='noise')source.buffer=noise;else{source.type=type;source.frequency.setValueAtTime(freq,t);source.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);}
  amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.004);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(amp);let spatial=null;
  if(position&&headphones&&context.createPanner){
   spatial=context.createPanner();spatial.panningModel='HRTF';spatial.distanceModel='inverse';spatial.refDistance=1;spatial.rolloffFactor=0;
   updateSpatial(spatial,position);activeSpatial.add({node:spatial,position:{x:position.x,y:position.y}});amp.connect(spatial);spatial.connect(master);
  }else if(position&&context.createStereoPanner){spatial=context.createStereoPanner();spatial.pan.value=pan;amp.connect(spatial);spatial.connect(master);}else amp.connect(master);
  voices++;source.onended=()=>{voices--;source.disconnect();filter.disconnect();amp.disconnect();spatial?.disconnect();for(const item of activeSpatial)if(item.node===spatial)activeSpatial.delete(item);};source.start(t);source.stop(t+duration+.02);
 }
 function updateSpatial(node,position){
  const listener=isSpectating&&spectateTarget?spectateTarget:myPlayer;if(!listener)return;
  // Fixed top-down camera: screen right = right ear; screen up = in front.
  const x=(position.x-listener.x)/100,z=(position.y-listener.y)/100;
  if(node.positionX){node.positionX.value=x;node.positionY.value=0;node.positionZ.value=z;}
  else node.setPosition(x,0,z);
 }
 // Each weapon has its own transient, low body and mechanical tail.
 // [noise cutoff, noise duration, body pitch, body duration, gain, tail pitch]
 const gunVoices={
  ar:[2900,.085,170,.09,.40,760],sniper:[1900,.32,105,.32,.60,410],shotgun:[1300,.24,85,.22,.65,260],
  v_classic:[2700,.055,235,.075,.32,940],v_shorty:[950,.14,92,.16,.45,340],
  v_frenzy:[3600,.038,265,.052,.27,1250],v_ghost:[1150,.045,310,.065,.24,780],
  v_bandit:[2400,.07,185,.105,.36,620],v_sheriff:[2200,.14,125,.19,.49,480],
  v_stinger:[4100,.028,290,.04,.25,1500],v_spectre:[1450,.035,245,.048,.23,1020],
  v_bucky:[850,.20,68,.24,.58,210],v_judge:[1750,.12,105,.15,.47,380],
  v_bulldog:[3300,.065,205,.082,.35,890],v_guardian:[2550,.12,140,.17,.45,550],
  v_phantom:[1550,.052,220,.072,.29,720],v_vandal:[3100,.095,155,.12,.41,680],
  v_warden:[2250,.13,118,.18,.46,510],v_marshal:[3900,.16,180,.22,.44,1110],
  v_outlaw:[1350,.24,78,.28,.56,310],v_operator:[1100,.38,55,.43,.65,180],
  v_ares:[2600,.07,128,.10,.38,580],v_odin:[1800,.095,88,.14,.43,440]
 };
 function emit(kind,position=null,strength=1,key=kind){
  if(!context||context.state!=='running'||volume===0||document.hidden)return;
  const gun=gunVoices[kind];
  const now=performance.now(),gap=gun?35:kind==='step'?110:kind==='click'?35:90;if(now-(limits.get(key)||-Infinity)<gap)return;
  let gain=strength,pan=0,occluded=false;
  const listener=isSpectating&&spectateTarget?spectateTarget:myPlayer;
  if(position&&listener){const distance=Math.hypot(position.x-listener.x,position.y-listener.y),range=kind==='step'?(position.range??(selectedMode==='spike'?1600:320)):kind==='beep'?1100:1500;if(distance>=range)return;gain*=kind==='step'?Math.pow(1-distance/range,.65):Math.pow(1-distance/range,1.5);pan=Math.max(-.85,Math.min(.85,(position.x-listener.x)/650));occluded=!hasLineOfSight(listener,position);if(occluded)gain*=.32;}
  limits.set(key,now);if(limits.size>128)limits.delete(limits.keys().next().value);
  const tone=(f,e,d,g=.2,delay=0)=>layer('triangle',f,e,d,g*gain,pan,delay,position,occluded);
  const burst=(f,d,g=.3)=>layer('noise',f,f,d,g*gain,pan,0,position,occluded);
  if(gun){
   const [cut,duration,pitch,body,loud,tail]=gun;
   burst(cut,duration,loud);tone(pitch,Math.max(28,pitch*.27),body,loud*.7);
   tone(tail,tail*.55,.027,loud*.13,Math.min(.08,duration*.55));return;
  }
  switch(kind){
   case 'click':tone(950,650,.035,.09);break;
   case 'select':tone(580,850,.07,.1);break;
   case 'open':tone(350,650,.10,.12);break;
   case 'close':tone(600,300,.09,.1);break;
   case 'error':tone(160,120,.10,.14);tone(160,120,.10,.12,.12);break;
   case 'empty':burst(2200,.025,.12);tone(450,220,.035,.1);break;
   case 'equip':burst(1700,.08,.13);tone(480,720,.08,.1,.08);break;
   case 'drop':burst(550,.12,.17);tone(140,65,.12,.12);break;
   case 'heal':burst(1800,.18,.07);tone(420,740,.25,.13);break;
   case 'revive':tone(400,550,.16,.13);tone(600,850,.25,.15,.17);break;
   case 'cancel':tone(380,180,.09,.1);break;
   case 'door':burst(500,.17,.18);tone(160,85,.15,.13);break;
   case 'break':burst(1700,.32,.35);tone(110,40,.22,.2);break;
   case 'glass':burst(7000,.22,.26);tone(2600,1800,.15,.07);tone(3300,2200,.18,.06,.06);break;
   case 'whizz':burst(4200,.07,.12);tone(1500,500,.08,.08);break;
   case 'impact':burst(2400,.045,.12);tone(750,250,.04,.08);break;
   case 'hit':burst(950,.06,.15);tone(1000,750,.06,.08);break;
   case 'tick':tone(700,700,.045,.1);break;
   case 'ar':burst(2900,.085,.4);tone(170,50,.09,.28);break;
   case 'sniper':burst(1900,.32,.6);tone(105,30,.32,.48);break;
   case 'shotgun':burst(1300,.24,.65);tone(85,30,.22,.4);tone(240,110,.09,.1,.26);break;
   case 'reload':burst(2200,.07,.13);tone(420,190,.10,.12,.15);break;
   case 'ready':burst(3200,.06,.13);tone(620,400,.06,.12);break;
   case 'hurt':burst(650,.12,.22);tone(95,45,.16,.3);break;
   case 'kill':tone(740,980,.09,.2);tone(1100,1400,.13,.18,.09);break;
   case 'death':tone(260,45,.45,.3);break;
   case 'step':burst(420,.065,.15);tone(100,45,.065,.1);break;
   case 'pickup':tone(520,820,.10,.14);break;
   case 'start':tone(440,440,.12);tone(660,660,.12,.2,.14);tone(880,880,.2,.2,.28);break;
   case 'end':tone(660,440,.2);tone(440,330,.3,.2,.22);break;
   case 'warning':tone(420,420,.16,.16);tone(420,420,.16,.16,.23);break;
   case 'plant':tone(500,1000,.25,.18);tone(1200,1200,.15,.18,.27);break;
   case 'use':tone(350,600,.14,.1);break;
   case 'half':tone(720,900,.14,.18);break;
   case 'defuse':tone(1200,900,.18);tone(900,650,.25,.2,.20);break;
   case 'beep':tone(1600,1600,.065,.13);break;
   case 'explode':burst(450,.75,.8);tone(75,25,.65,.6);break;
  }
 }
 function setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));if(master)master.gain.value=volume*.55;try{localStorage.setItem('game-sfx-volume',String(volume));}catch{}}
 root.GameAudio={emit,unlock,setVolume,get volume(){return volume;}};
 function uiFeedback(event){
  const target=event.target?.closest?.('button,[role="button"],.mobile-btn,.inv-item,select,input[type="checkbox"],input[type="radio"],input[type="range"]');
  if(!target||target.disabled||target.getAttribute?.('aria-disabled')==='true')return;
  if(event.type==='pointerdown'&&!target.matches?.('.mobile-btn'))return;
  if(event.type==='click'&&target.matches?.('.mobile-btn'))return;
  const pending=unlock(),play=()=>emit(['change','input'].includes(event.type)?'select':'click',null,1,'ui');
  if(pending?.then)pending.then(play);else play();
 }
 document.addEventListener('click',uiFeedback,true);document.addEventListener('change',uiFeedback,true);document.addEventListener('input',uiFeedback,true);document.addEventListener('pointerdown',uiFeedback,true);
 const panel=document.createElement('div');panel.style.cssText='position:fixed;left:10px;bottom:10px;z-index:10000;display:flex;flex-wrap:wrap;max-width:calc(100vw - 36px);align-items:center;gap:6px;background:#101820cc;padding:5px 8px;border-radius:8px;color:#ddd;font:12px sans-serif';
 const button=document.createElement('button'),slider=document.createElement('input');button.type='button';button.textContent=volume?'소리 켜짐':'음소거';button.style.cssText='width:auto;margin:0;padding:3px;flex:none;background:transparent;border:0;color:inherit;font:inherit;cursor:pointer';
 slider.type='range';slider.min='0';slider.max='100';slider.value=String(volume*100);slider.style.width='60px';slider.setAttribute('aria-label','효과음 볼륨');
 button.onclick=()=>{unlock();setVolume(volume?0:.55);slider.value=String(volume*100);button.textContent=volume?'소리 켜짐':'음소거';};slider.oninput=()=>{unlock();setVolume(slider.value/100);button.textContent=volume?'소리 켜짐':'음소거';};panel.appendChild(button);panel.appendChild(slider);
 const spatialButton=document.createElement('button');spatialButton.type='button';spatialButton.style.cssText=button.style.cssText;
 const spatialLabel=()=>spatialButton.textContent=headphones?'헤드셋 3D':'스테레오';spatialLabel();
 spatialButton.onclick=()=>{headphones=!headphones;try{localStorage.setItem('game-sfx-headphones',headphones?'on':'off');}catch{}spatialLabel();};
 spatialButton.title='화면 위쪽=앞, 아래쪽=뒤 / 좌우는 화면 기준';panel.appendChild(spatialButton);
 const testButton=document.createElement('button');testButton.type='button';testButton.textContent='방향 테스트';testButton.style.cssText=button.style.cssText;
 let testGeneration=0;testButton.onclick=()=>{const generation=++testGeneration;Promise.resolve(unlock()).then(()=>{
  [[-250,0,'왼쪽'],[250,0,'오른쪽'],[0,-250,'앞'],[0,250,'뒤']].forEach(([dx,dy,label],i)=>setTimeout(()=>{
   if(generation!==testGeneration||document.hidden)return;const listener=isSpectating&&spectateTarget?spectateTarget:myPlayer;
   testButton.textContent=label;emit('ready',{x:listener.x+dx,y:listener.y+dy},1,'direction-test');
   if(i===3)setTimeout(()=>{if(generation===testGeneration)testButton.textContent='방향 테스트';},700);
  },i*850));
 });};panel.appendChild(testButton);document.body.appendChild(panel);
 const shot=addGunshotEvent;addGunshotEvent=(x,y,id,weapon)=>{shot(x,y,id);const p=getCombatEntityById(id);const kind=weapon||p?.weapon||'ar';emit(kind,{x,y},1,'shot:'+id);};
 playNearbyStep=(distance,range,event)=>{const listener=isSpectating&&spectateTarget?spectateTarget:myPlayer;if(typeof spikeCanHearStep==='function'&&!spikeCanHearStep(listener,event))return;if(range<=0||distance>=range)return;emit('step',event?{x:event.x,y:event.y,range}:null,event?.entityId===myPlayer.id ? .35 : 1,event?'step:'+event.entityId:'nearby-step');};
 let previous=null,lastTick=0,lastBeep=0,lastStep=0;const remoteAudio=new Map();
 function poll(){
  for(const item of activeSpatial)updateSpatial(item.node,item.position);
  const now=performance.now();if(now-lastTick<40)return;lastTick=now;
  if(!gameStarted){previous=null;remoteAudio.clear();return;}
  const s=selectedMode==='spike'?spikeState:null;
  const state={shield:myPlayer.shield||0,hp:myPlayer.hp,kills:myPlayer.kills||0,dead:!!myPlayer.isDead,down:!!myPlayer.isDowned,reload:!!myPlayer.isReloading,clip:myPlayer.clipAmmo,weapon:myPlayer.weapon,ended:gameEnded,zone:zoneStage,round:s?.round,phase:s?.phase,actor:s?.actor,half:s?.bomb?.defuseCheckpoint||0,reviving:(myPlayer.reviveProgress||0)>0,scope:myPlayer.equippedScope,armor:myPlayer.equippedBodyArmor,helmet:myPlayer.equippedHelmet,countdown:s?.phase==='prep'?Math.ceil(s.time):null};
  if(!previous)emit('start');else{
   if(state.round!==previous.round){emit('start');lastBeep=0;}
   else{
    if((state.hp<previous.hp||state.shield<previous.shield)&&!state.dead)emit('hurt');
    if(state.dead&&!previous.dead)emit('death');
    if(!state.dead&&previous.dead)emit('start');
    if(state.kills>previous.kills)emit('kill');
    if(state.reload&&!previous.reload)emit('reload');
    if(!state.reload&&previous.reload&&state.clip>previous.clip)emit('ready');
    if(state.weapon!==previous.weapon&&state.weapon)emit('pickup');
    if(state.down&&!previous.down)emit('warning');
    if(!state.down&&previous.down&&!state.dead)emit('revive');
    if(state.reviving&&!previous.reviving)emit('use');
    if(state.scope!==previous.scope||state.armor!==previous.armor||state.helmet!==previous.helmet)emit('equip');
    if(state.countdown&&state.countdown<=3&&state.countdown!==previous.countdown)emit('tick');
    if(selectedMode==='br'&&state.zone>previous.zone)emit('warning');
    if(state.phase==='live'&&previous.phase==='prep')emit('start');
    if(state.phase==='planted'&&previous.phase!=='planted')emit('plant',s.bomb);
    if(state.actor&&state.actor!==previous.actor&&(s.bomb.planted||myPlayer.teamId===`team_${s.attackTeam}`))emit('use',s.bomb?.planted?s.bomb:getCombatEntityById(state.actor));
    if(state.half>previous.half)emit('half',s.bomb);
    if(previous.actor===myPlayer.id&&!state.actor&&state.phase===previous.phase)emit('cancel');
    if(['end','finished'].includes(state.phase)&&!['end','finished'].includes(previous.phase))emit(s.result.includes('폭발')?'explode':s.result.includes('해체')?'defuse':'end');
   }
   if(state.ended&&!previous.ended)emit('end');
  }
  if(!state.ended&&(!state.dead||isSpectating)){
   if(s?.phase==='planted'&&now-lastBeep>(s.time<5?180:s.time<10?350:950)){lastBeep=now;emit('beep',s.bomb);}
  }
  const listener=isSpectating&&spectateTarget?spectateTarget:myPlayer;
  if(listener&&!state.ended&&typeof bullets!=='undefined')for(const b of bullets){
   if(b.ownerId!==listener.id&&Math.hypot(b.x-listener.x,b.y-listener.y)<95&&hasLineOfSight(listener,b))emit('whizz',b,.5,'near-miss');
  }
  const aliveIds=new Set();
  for(const p of [...Object.values(typeof remotePlayers==='undefined'?{}:remotePlayers),...(typeof aiBots==='undefined'?[]:aiBots)]){
   aliveIds.add(p.id);const prev=remoteAudio.get(p.id);
   if(prev&&!p.isDead&&!(typeof spikePrepHidden==='function'&&spikePrepHidden(p))){if(p.isReloading&&!prev.reload)emit('reload',p,.7,'reload:'+p.id);if(!p.isReloading&&prev.reload&&p.clipAmmo>prev.clip)emit('ready',p,.7,'ready:'+p.id);if(p.hp<prev.hp)emit('hit',p,.5,'hit:'+p.id);}
   remoteAudio.set(p.id,{reload:!!p.isReloading,clip:p.clipAmmo,hp:p.hp});
  }
  for(const id of remoteAudio.keys())if(!aliveIds.has(id))remoteAudio.delete(id);
  previous=state;
 }
 function hook(name,before,after){const original=root[name];if(typeof original!=='function')return;root[name]=function(...args){const saved=before?.(...args),result=original.apply(this,args);after(saved,result,...args);return result;};}
 hook('useHealingItem',()=>myPlayer.hp,hp=>{emit(myPlayer.hp>hp?'heal':'error');});
 hook('pickupItem',()=>new Set(droppedItems.map(p=>p.id)),ids=>{if([...ids].some(id=>!droppedItems.some(p=>p.id===id)))emit('pickup',null,1,'pickup');});
 hook('unequipWeapon',()=>myPlayer.weapon,weapon=>{if(weapon&&!myPlayer.weapon)emit('drop');});
 for(const name of ['toggleInventory','toggleFullMap','openSettings','closeSettings','setSpectateTargetById'])hook(name,null,()=>emit(name==='closeSettings'?'close':'open'));
 const doorState=h=>h?{hp:h.doorHp,open:h.doorOpen}:null;
 const doorSound=(before,result,h)=>{if(before&&h&&(before.hp!==h.doorHp||before.open!==h.doorOpen))emit(h.doorHp<=0?'break':'door',getHouseDoorCenterPoint(h),1,'door:'+h.doorId);};
 hook('setHouseDoor',doorState,doorSound);hook('damageHouseDoor',doorState,doorSound);
 hook('applyDoorState',state=>{const h=obstacles.find(o=>o.doorId===state.doorId);return {h,before:doorState(h)};},saved=>doorSound(saved.before,null,saved.h));
 hook('breakWindow',null,(_,result,h,id,x,y)=>{if(result)emit('glass',{x:Number.isFinite(x)?x:h.x+h.w/2,y:Number.isFinite(y)?y:h.y+h.h/2},1,'glass:'+h.seed+':'+id);});
 hook('shoot',p=>p===myPlayer&&p.weapon&&p.clipAmmo<=0&&!p.isReloading&&!p.isDead&&(!spikeState||selectedMode!=='spike'||['live','planted'].includes(spikeState.phase)),empty=>{if(empty)emit('empty',null,1,'empty');});
 // Reuse existing state packets for rare world impacts; no additional sends.
 let soundSequence=0;const worldSounds=[],heard=new Set();
 root.GameAudio.world=(kind,position)=>{
  emit(kind,position,.7,'world:'+kind);
  if(typeof isHost!=='undefined'&&isHost){worldSounds.push({id:++soundSequence,kind,x:position.x,y:position.y,at:performance.now()});while(worldSounds.length>12)worldSounds.shift();}
 };
 const send=root.safeSend;if(typeof send==='function')root.safeSend=(c,data)=>{
  if(isHost&&data?.type==='SYNC'){const now=performance.now(),sfx=worldSounds.filter(e=>now-e.at<250).map(({id,kind,x,y})=>({id,kind,x,y}));if(sfx.length)data={...data,sfx};}
  return send(c,data);
 };
 hook('handleNetworkData',null,(_,result,data)=>{
  if(isHost||!gameStarted||data?.type!=='SYNC'||!Array.isArray(data.sfx))return;
  for(const e of data.sfx.slice(0,12)){if(!['impact'].includes(e.kind)||!Number.isFinite(e.x)||!Number.isFinite(e.y)||!Number.isFinite(e.id)||heard.has(e.id))continue;heard.add(e.id);emit(e.kind,{x:e.x,y:e.y},.7,'world:'+e.kind);}
  while(heard.size>128)heard.delete(heard.values().next().value);
 });
 hook('returnToRoomAfterGame',null,()=>{heard.clear();worldSounds.length=0;emit('close');});
 const alertUser=root.alert;if(typeof alertUser==='function')root.alert=(...args)=>{emit('error');return alertUser(...args);};
 const tick=update;update=(...args)=>{const result=tick(...args);poll();return result;};
 root.GameAudio.poll=poll;
})(globalThis);
