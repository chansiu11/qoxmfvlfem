/* Procedural game SFX. No downloads, external samples or additional network traffic. */
(function(root){
 let context=null,master=null,noise=null,volume=.55,voices=0;
 const limits=new Map();
 try{const saved=localStorage.getItem('game-sfx-volume');if(saved!==null)volume=Math.max(0,Math.min(1,Number(saved)||0));}catch{}
 function unlock(){
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   if(!context){context=new Audio();master=context.createGain();master.gain.value=volume*.55;
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-18;compressor.ratio.value=6;master.connect(compressor);compressor.connect(context.destination);
    noise=context.createBuffer(1,Math.ceil(context.sampleRate*.8),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }
   if(context.state==='suspended')context.resume().catch(()=>{});
  }catch{context=null;}
 }
 for(const event of ['pointerdown','touchstart','keydown'])document.addEventListener(event,unlock,{passive:true});
 function layer(type,freq,end,duration,gain,pan=0,delay=0){
  if(!context||context.state!=='running'||!master||volume===0||document.hidden||voices>=28)return;
  const t=context.currentTime+delay,amp=context.createGain(),filter=context.createBiquadFilter();
  const source=type==='noise'?context.createBufferSource():context.createOscillator();
  filter.type='lowpass';filter.frequency.value=type==='noise'?freq:8000;
  if(type==='noise')source.buffer=noise;else{source.type=type;source.frequency.setValueAtTime(freq,t);source.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);}
  amp.gain.setValueAtTime(.0001,t);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.004);amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(amp);let spatial=null;
  if(context.createStereoPanner){spatial=context.createStereoPanner();spatial.pan.value=pan;amp.connect(spatial);spatial.connect(master);}else amp.connect(master);
  voices++;source.onended=()=>{voices--;source.disconnect();filter.disconnect();amp.disconnect();spatial?.disconnect();};source.start(t);source.stop(t+duration+.02);
 }
 function emit(kind,position=null,strength=1,key=kind){
  if(!context||context.state!=='running'||volume===0||document.hidden)return;
  const now=performance.now(),gap=kind==='ar'?65:kind==='step'?110:90;if(now-(limits.get(key)||-Infinity)<gap)return;
  let gain=strength,pan=0;
  const listener=isSpectating&&spectateTarget?spectateTarget:myPlayer;
  if(position&&listener){const distance=Math.hypot(position.x-listener.x,position.y-listener.y),range=kind==='step'?320:kind==='beep'?1100:1500;if(distance>=range)return;gain*=Math.pow(1-distance/range,1.5);pan=Math.max(-.85,Math.min(.85,(position.x-listener.x)/650));if(!hasLineOfSight(listener,position))gain*=.32;}
  limits.set(key,now);if(limits.size>128)limits.delete(limits.keys().next().value);
  const tone=(f,e,d,g=.2,delay=0)=>layer('triangle',f,e,d,g*gain,pan,delay);
  const burst=(f,d,g=.3)=>layer('noise',f,f,d,g*gain,pan);
  switch(kind){
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
 const panel=document.createElement('div');panel.style.cssText='position:fixed;left:10px;bottom:10px;z-index:10000;display:flex;align-items:center;gap:6px;background:#101820cc;padding:5px 8px;border-radius:8px;color:#ddd;font:12px sans-serif';
 const button=document.createElement('button'),slider=document.createElement('input');button.type='button';button.textContent=volume?'소리 켜짐':'음소거';button.style.cssText='background:transparent;border:0;color:inherit;font:inherit;cursor:pointer';
 slider.type='range';slider.min='0';slider.max='100';slider.value=String(volume*100);slider.style.width='60px';slider.setAttribute('aria-label','효과음 볼륨');
 button.onclick=()=>{unlock();setVolume(volume?0:.55);slider.value=String(volume*100);button.textContent=volume?'소리 켜짐':'음소거';};slider.oninput=()=>{unlock();setVolume(slider.value/100);button.textContent=volume?'소리 켜짐':'음소거';};panel.appendChild(button);panel.appendChild(slider);document.body.appendChild(panel);
 const shot=addGunshotEvent;addGunshotEvent=(x,y,id,weapon)=>{shot(x,y,id);const p=getCombatEntityById(id);emit(weapon||p?.weapon||'ar',{x,y},1,'shot:'+id);};
 playNearbyStep=(distance,range)=>emit('step',null,Math.max(0,1-distance/range),'nearby-step');
 let previous=null,lastTick=0,lastBeep=0,lastStep=0;
 function poll(){
  const now=performance.now();if(now-lastTick<40)return;lastTick=now;
  if(!gameStarted){previous=null;return;}
  const s=selectedMode==='spike'?spikeState:null;
  const state={hp:myPlayer.hp,kills:myPlayer.kills||0,dead:!!myPlayer.isDead,down:!!myPlayer.isDowned,reload:!!myPlayer.isReloading,clip:myPlayer.clipAmmo,weapon:myPlayer.weapon,ended:gameEnded,zone:zoneStage,round:s?.round,phase:s?.phase,actor:s?.actor,half:s?.bomb?.defuseCheckpoint||0};
  if(!previous)emit('start');else{
   if(state.round!==previous.round){emit('start');lastBeep=0;}
   else{
    if(state.hp<previous.hp&&!state.dead)emit('hurt');
    if(state.dead&&!previous.dead)emit('death');
    if(!state.dead&&previous.dead)emit('start');
    if(state.kills>previous.kills)emit('kill');
    if(state.reload&&!previous.reload)emit('reload');
    if(!state.reload&&previous.reload&&state.clip>previous.clip)emit('ready');
    if(state.weapon!==previous.weapon&&state.weapon)emit('pickup');
    if(state.down&&!previous.down)emit('warning');
    if(!state.down&&previous.down&&!state.dead)emit('ready');
    if(selectedMode==='br'&&state.zone>previous.zone)emit('warning');
    if(state.phase==='live'&&previous.phase==='prep')emit('start');
    if(state.phase==='planted'&&previous.phase!=='planted')emit('plant',s.bomb);
    if(state.actor&&state.actor!==previous.actor&&(s.bomb.planted||myPlayer.teamId===`team_${s.attackTeam}`))emit('use');
    if(state.half>previous.half)emit('half');
    if(state.phase==='end'&&previous.phase!=='end')emit(s.result.includes('폭발')?'explode':s.result.includes('해체')?'defuse':'end');
   }
   if(state.ended&&!previous.ended)emit('end');
  }
  if(!state.ended&&!state.dead){
   if(myPlayer.isMoving&&!myPlayer.isDowned&&now-lastStep>(myPlayer.movementMode==='sprint'?280:myPlayer.movementMode==='stealth'?600:420)){lastStep=now;emit('step',null,myPlayer.movementMode==='stealth'?.15:.35,'own-step');}
   if(s?.phase==='planted'&&now-lastBeep>(s.time<5?180:s.time<10?350:950)){lastBeep=now;emit('beep',s.bomb);}
  }
  previous=state;
 }
 const tick=update;update=(...args)=>{const result=tick(...args);poll();return result;};
 root.GameAudio.poll=poll;
})(globalThis);
