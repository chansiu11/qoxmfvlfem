/* Adapter for the existing P2P game. Other modes retain their original behavior. */
let spikeMatch=null,spikeState=null,spikeHeld=false,spikeLastTick=performance.now(),spikeAppliedRound=0;
const spikeActors=()=>[...roomHumans(),...aiBots].filter(p=>!isAssignedSpectator(p.id));
const spikeSpawn=p=>SpikeRules.SPAWNS[p.teamId===`team_${spikeState?.attackTeam||1}`?0:1];
const originalMap=generateMapData;
generateMapData=(mode,seed)=>mode==='spike'?{seed,worldSize:SpikeRules.SIZE,obstacles:SpikeRules.WALLS.map(w=>({...w})),items:[]}:originalMap(mode,seed);
const originalTeam=applyEntityTeam;
applyEntityTeam=p=>{if(selectedMode!=='spike')return originalTeam(p);p.teamId=isAssignedSpectator(p.id)?null:`team_${teamAssignments[p.id]===2?2:1}`;p.team=null;return p;};
const originalPrepare=prepareMatchTeams;
prepareMatchTeams=()=>{if(selectedMode!=='spike')return originalPrepare();spikeActors().forEach((p,i)=>{teamAssignments[p.id]=i%2+1;applyEntityTeam(p);});initialTeamCount=2;};
const originalStartRequest=hostStartGame;
hostStartGame=()=>{
 if(document.getElementById('gameModeSelect').value==='spike'){
  const bots=document.getElementById('aiToggle').value==='true'?Number(document.getElementById('aiCountInput').value)||0:0;
  if(roomHumans().filter(p=>!isAssignedSpectator(p.id)).length+bots<2){alert('일반게임은 양 팀에 참가자가 필요합니다. 다른 플레이어를 초대하거나 봇을 추가해 주세요.');return;}
 }
 originalStartRequest();
};
const originalStart=startGame;
startGame=()=>{
 if(selectedMode!=='spike'){spikeMatch=null;spikeState=null;return originalStart();}
 spikeAppliedRound=0;spikeHeld=false;spikeLastTick=performance.now();
 originalStart();WORLD_SIZE=SpikeRules.SIZE;isSpawnSelecting=false;
 document.getElementById('hudGameMode').textContent='일반게임 · 어센트';
 if(isHost){spikeMatch=new SpikeRules.Match(spikeActors);spikeState=spikeMatch.snapshot();spikeApply(spikeState);}
};
const originalWeaponModal=openDeathmatchWeaponModal;
openDeathmatchWeaponModal=(...args)=>{if(selectedMode!=='spike')return originalWeaponModal(...args);};
const originalBotRespawn=respawnBot;
respawnBot=p=>{if(selectedMode!=='spike')originalBotRespawn(p);};
const originalShoot=shoot;
shoot=(p,spread)=>{if(selectedMode==='spike'&&(!['live','planted'].includes(spikeState?.phase)||p.isDead||p.hp<=0||p._spikeUse))return;return originalShoot(p,spread);};
const originalEntity=networkEntityState;
networkEntityState=p=>{const state=originalEntity(p);if(selectedMode==='spike'){state._spikeUse=p===myPlayer?spikeHeld:!!p._spikeUse;state._spikeRound=spikeAppliedRound;}return state;};
const originalSend=safeSend;
safeSend=(c,data)=>{if(selectedMode==='spike'&&isHost&&data?.type==='SYNC'&&spikeMatch)data={...data,spike:spikeMatch.snapshot(getCombatEntityById(c.playerId)||{teamId:"spectator"})};return originalSend(c,data);};
function spikeApply(state){
 if(!state)return;spikeState=state;
 for(const actor of state.actors||[]){const p=getCombatEntityById(actor.id);if(p)p.teamId=actor.teamId;}
 const me=(state.actors||[]).find(p=>p.id===myPlayer.id);
 if(state.round!==spikeAppliedRound){
  spikeAppliedRound=state.round;spikeHeld=false;bullets.length=0;isRespawning=false;isSpectating=isAssignedSpectator(myPlayer.id);spectateTarget=null;
  if(me){Object.assign(myPlayer,me,state.spawns[myPlayer.id]);resetDownedState(myPlayer);myPlayer.isShooting=false;myPlayer.isReloading=false;camera.x=myPlayer.x;camera.y=myPlayer.y;}
  for(const id of ['spectateHUD','respawnHUD','weaponSelectModal','fullMapOverlay'])document.getElementById(id).style.display='none';
  document.getElementById('statusHUD').style.display='block';if(isMobile)document.getElementById('mobileControls').style.display='block';
 }else if(me){
  myPlayer.hp=me.hp;myPlayer.kills=me.kills;myPlayer.deaths=me.deaths;
  if(me.isDead&&!myPlayer.isDead){myPlayer.isDead=true;startSpectating();}
  if(state.phase==='prep'){myPlayer.weapon=me.weapon;myPlayer.clipAmmo=me.clipAmmo;myPlayer.reserveAmmo=me.reserveAmmo;}
 }
 spikeUI();
}
const originalNetwork=handleNetworkData;
handleNetworkData=data=>{
 if(selectedMode==='spike'&&isHost){
  if(data.type==='SPIKE_WEAPON'){const p=getCombatEntityById(data.player?.id);if(p)spikeMatch?.choose(p,data.weapon);return;}
  if(data.type==='SYNC'&&data.player){
   const p=remotePlayers[data.player.id];if(!p||data.player._spikeRound!==spikeMatch?.round)return;
   if(data.player.isReloading&&!p.isReloading)reloadWeapon(p);
   data={...data,player:{...data.player,isReloading:p.isReloading,_spikeShotAt:p._spikeShotAt,hp:p.hp,maxHp:200,isDead:p.isDead,kills:p.kills,deaths:p.deaths,teamId:p.teamId,weapon:p.weapon,clipAmmo:p.clipAmmo,reserveAmmo:p.reserveAmmo}};
   // Reload stays compatible with the existing client, bounded by this weapon's capacity.
   if(p.weapon&&Number.isFinite(data.player.clipAmmo))data.player.clipAmmo=Math.min(WEAPONS[p.weapon].maxClip,data.player.clipAmmo);
  }
  if(data.type==='SHOOT'){
   const p=remotePlayers[data.player?.id];if(!p||p.isDead||p.hp<=0)return;
   if(Number.isFinite(data.player.angle))p.angle=data.player.angle;
   const now=Date.now();if(now-(p._spikeShotAt||0)<(WEAPONS[p.weapon]?.cooldown||100)-5)return;p._spikeShotAt=now;
   data={...data,player:p};
  }
 }
 if(selectedMode==='spike'&&isHost&&data.type==='SYNC'&&data.player){const p=remotePlayers[data.player.id];Object.assign(p,data.player);p._inputAt=Date.now();return;}
 originalNetwork(data);
 if(data.type==='ROOM_SETTINGS'&&data.mode==='spike')document.getElementById('guestModeVal').textContent='일반게임 · 어센트';
 if(selectedMode==='spike'&&!isHost&&data.spike)spikeApply(data.spike);
};
function spikeChoose(weapon){
 if(selectedMode!=='spike'||spikeState?.phase!=='prep'||!SpikeRules.inside(myPlayer,spikeSpawn(myPlayer)))return;
 if(isHost){spikeMatch.choose(myPlayer,weapon);spikeState=spikeMatch.snapshot();spikeUI();}
 else broadcastData({type:'SPIKE_WEAPON',player:{id:myPlayer.id},weapon});
}
const originalSelect=selectDeathmatchWeapon;
selectDeathmatchWeapon=type=>selectedMode==='spike'?spikeChoose(type):originalSelect(type);
const originalUpdateAI=updateAI;
updateAI=()=>{
 if(selectedMode!=='spike')return originalUpdateAI();
 if(!isHost||!['live','planted'].includes(spikeState?.phase))return;
 originalUpdateAI();
 // Idle bots pursue the objective; combat AI retains priority when enemies are visible.
 const b=spikeMatch.bomb;
 for(const bot of aiBots){
  bot._spikeUse=false;if(bot.isDead||bot.hp<=0)continue;
  const enemies=spikeActors().filter(p=>p.hp>0&&!p.isDead&&!areAllies(bot,p));
  if(enemies.some(p=>Math.hypot(p.x-bot.x,p.y-bot.y)<800&&hasLineOfSight(bot,p)))continue;
  const attack=bot.teamId===`team_${spikeMatch.attackTeam}`;
  const target=b.planted?b:attack?(b.carrier===bot.id?SpikeRules.SITES[(spikeMatch.round-1)%2]:getCombatEntityById(b.carrier)||b):SpikeRules.SITES[Number(bot.id.replace('bot_',''))%2||0];
  const canUse=b.planted?!attack&&Math.hypot(bot.x-b.x,bot.y-b.y)<75:b.carrier===bot.id&&SpikeRules.SITES.some(s=>Math.hypot(bot.x-s.x,bot.y-s.y)<s.r-20);
  if(canUse){bot._spikeUse=true;bot.isMoving=false;bot.isShooting=false;}
  else if(Math.hypot(bot.x-target.x,bot.y-target.y)>90)moveBotToward(bot,target,1.5,'walk');
 }
};
const originalUpdate=update;
update=()=>{
 if(selectedMode!=='spike'||!gameStarted||gameEnded)return originalUpdate();
 const now=performance.now(),dt=Math.min(.1,(now-spikeLastTick)/1000);spikeLastTick=now;
 myPlayer._spikeUse=spikeHeld;
 if(spikeState?.phase==='prep'||spikeState?.phase==='end'||spikeHeld)myPlayer.isShooting=false;
 originalUpdate();
 if(spikeState?.phase==='prep'){const r=spikeSpawn(myPlayer);myPlayer.x=Math.max(r.x+20,Math.min(r.x+r.w-20,myPlayer.x));myPlayer.y=Math.max(r.y+20,Math.min(r.y+r.h-20,myPlayer.y));}
 if(isHost&&spikeMatch){for(const p of Object.values(remotePlayers))if(Date.now()-(p._inputAt||0)>700)p._spikeUse=false;const prev=spikeMatch.round;spikeMatch.tick(dt);spikeState=spikeMatch.snapshot();if(spikeState.phase==='end')bullets.length=0;if(prev!==spikeMatch.round)spikeApply(spikeState);}
 spikeUI();
};
const spikePanel=document.createElement('div');spikePanel.id='spikePanel';
spikePanel.style.cssText='position:absolute;top:65px;left:50%;transform:translateX(-50%);z-index:48;text-align:center;background:#101821dd;border:1px solid #5aaeb6;border-radius:8px;padding:8px 12px;color:white;max-width:75%;display:none;font-size:13px;pointer-events:none';
spikePanel.innerHTML='<div id="spikeStatus"></div><div id="spikeWeaponBar" style="pointer-events:auto;margin-top:6px"><span>총기 선택 </span><button style="width:auto;padding:7px 9px;margin:2px;font-size:12px" onclick="spikeChoose(\'ar\')">돌격소총</button><button style="width:auto;padding:7px 9px;margin:2px;font-size:12px" onclick="spikeChoose(\'sniper\')">저격총</button><button style="width:auto;padding:7px 9px;margin:2px;font-size:12px" onclick="spikeChoose(\'shotgun\')">산탄총</button></div><div id="spikePrompt" style="color:#ffda83;margin-top:4px"></div>';
gameFrame.appendChild(spikePanel);
const spikeButton=document.createElement('div');spikeButton.id='btnSpike';spikeButton.className='mobile-btn touch-zone';spikeButton.textContent='설치 / 해체';spikeButton.style.cssText='bottom:270px;right:40px;width:85px;border-color:#ffcc66;display:none;touch-action:none';document.getElementById('mobileControls').appendChild(spikeButton);
let spikeTouch=null;
spikeButton.addEventListener('touchstart',e=>{if(isEditingKeys||spikeTouch!==null)return;e.preventDefault();spikeTouch=e.changedTouches[0].identifier;spikeHeld=true;},{passive:false});
for(const name of ['touchend','touchcancel'])window.addEventListener(name,e=>{if([...e.changedTouches].some(t=>t.identifier===spikeTouch)){spikeTouch=null;spikeHeld=false;}});
window.addEventListener('keydown',e=>{if(selectedMode==='spike'&&e.key.toLowerCase()==='f'){e.preventDefault();spikeHeld=true;}});
window.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='f')spikeHeld=false;});
window.addEventListener('blur',()=>{spikeHeld=false;spikeTouch=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){spikeHeld=false;spikeTouch=null;}});
function spikeUI(){
 const active=selectedMode==='spike'&&gameStarted&&!gameEnded&&spikeState;spikePanel.style.display=active?'block':'none';spikeButton.style.display=active&&isMobile?'flex':'none';if(!active)return;
 const s=spikeState,b=s.bomb,attacking=myPlayer.teamId===`team_${s.attackTeam}`;
 document.getElementById('spikeStatus').textContent=`어센트 · ${s.round}라운드 | 청록 ${s.score[0]} : ${s.score[1]} 코랄 | ${attacking?'공격':'수비'} | ${s.phase==='prep'?'준비':s.phase==='planted'?'폭발까지':s.phase==='end'?s.result:'라운드'} ${Math.max(0,Math.ceil(s.time))}초`;
 const prep=s.phase==='prep'&&!myPlayer.isDead;document.getElementById('spikeWeaponBar').style.display=prep?'block':'none';
 let hint=prep?'스폰 지역에서 총기를 바꿀 수 있습니다. 준비 후 출발하세요.':s.phase==='end'?s.result:b.planted?`${b.site} 지점 설치됨 · 수비는 F / 설치·해체 버튼 7초 유지`:b.carrier===myPlayer.id?'스파이크 보유 · A/B에서 F / 설치·해체 버튼 4초 유지':attacking?'스파이크 운반자를 엄호하세요. 떨어진 스파이크는 가까이 가면 줍습니다.':'A/B 지점을 방어하세요.';
 if(s.actor&&(b.planted||attacking))hint+=` · ${Math.round(s.progress/(b.planted?7:4)*100)}%`;
 document.getElementById('spikePrompt').textContent=hint;
}
function drawSpikeFloor(context){
 context.save();context.fillStyle='#252c33';context.fillRect(0,0,SpikeRules.SIZE,SpikeRules.SIZE);
 for(const r of SpikeRules.FLOORS){context.fillStyle='#a79e8d';context.fillRect(r.x,r.y,r.w,r.h);}
 context.strokeStyle='rgba(255,245,220,.10)';context.lineWidth=1;
 const left=Math.max(0,Math.floor((camera.x-canvas.width/2)/75)*75),right=Math.min(SpikeRules.SIZE,camera.x+canvas.width/2);
 const top=Math.max(0,Math.floor((camera.y-canvas.height/2)/75)*75),bottom=Math.min(SpikeRules.SIZE,camera.y+canvas.height/2);
 for(let x=left;x<right;x+=75){context.beginPath();context.moveTo(x,top);context.lineTo(x,bottom);context.stroke();}
 for(let y=top;y<bottom;y+=75){context.beginPath();context.moveTo(left,y);context.lineTo(right,y);context.stroke();}
 context.restore();
}
function drawSpikeMap(context,scale=1){
 if(selectedMode!=='spike')return;context.save();context.scale(scale,scale);context.textAlign='center';context.textBaseline='middle';
 for(let i=0;i<2;i++){const r=SpikeRules.SPAWNS[i];context.fillStyle=i?'#4d708533':'#af784333';context.fillRect(r.x,r.y,r.w,r.h);context.strokeStyle=i?'#77beed':'#ffc270';context.lineWidth=3;context.strokeRect(r.x,r.y,r.w,r.h);context.fillStyle='white';context.font='bold 25px sans-serif';context.fillText(i?'수비 스폰':'공격 스폰',r.x+r.w/2,r.y+r.h/2);}
 if(scale>=.2){context.fillStyle='#e8dfce';context.font='bold 22px sans-serif';for(const c of SpikeRules.CALLOUTS)context.fillText(c.name,c.x,c.y);}
 for(const s of SpikeRules.SITES){context.fillStyle='#dbb45422';context.strokeStyle='#ffce67';context.beginPath();context.arc(s.x,s.y,s.r,0,Math.PI*2);context.fill();context.stroke();context.fillStyle='#ffdb8b';context.font='bold 60px sans-serif';context.fillText(s.name,s.x,s.y);}
 const b=spikeState?.bomb;if(b&&!b.hidden&&(b.planted||myPlayer.teamId===`team_${spikeState.attackTeam}`)){context.fillStyle=b.planted?'#ff5757':'#fff5a9';context.fillRect(b.x-12,b.y-12,24,24);}
 context.restore();
}
const oldMini=renderMinimap;
renderMinimap=()=>{oldMini();if(selectedMode==='spike')drawSpikeMap(mCtx,minimapCanvas.width/WORLD_SIZE);};
const oldFull=renderFullMap;
renderFullMap=()=>{oldFull();if(selectedMode==='spike')drawSpikeMap(fCtx,fullMapCanvas.width/WORLD_SIZE);};
const oldReturn=returnToRoomAfterGame;
returnToRoomAfterGame=()=>{spikeMatch=null;spikeState=null;spikeHeld=false;oldReturn();spikeUI();};
