/* Adapter for the existing P2P game. Other modes retain their original behavior. */
Object.assign(WEAPONS,SpikeCatalog.weapons);
let spikeFrameDt=1/60;
let spikeMatch=null,spikeState=null,spikeHeld=false,spikeLastTick=performance.now(),spikeAppliedRound=0;
const spikeActors=()=>[...roomHumans(),...aiBots].filter(p=>!isAssignedSpectator(p.id));
const spikeSpawn=p=>SpikeRules.SPAWNS[p.teamId===`team_${spikeState?.attackTeam||1}`?0:1];
function spikePrepHidden(entity,viewer=isSpectating&&spectateTarget?spectateTarget:myPlayer){return selectedMode==='spike'&&!['live','planted','end','finished'].includes(spikeState?.phase)&&entity&&viewer&&entity.id!==viewer.id&&!areAllies(viewer,entity);}
function spikeCanHearStep(viewer,event){const owner=event&&getCombatEntityById(event.entityId);return selectedMode!=='spike'||['live','planted','end','finished'].includes(spikeState?.phase)||!!owner&&(owner.id===viewer?.id||viewer&&areAllies(viewer,owner));}
const originalVisibleEntity=shouldRenderCombatEntityToLocal;
shouldRenderCombatEntityToLocal=entity=>!spikePrepHidden(entity)&&originalVisibleEntity(entity);
function spikeBotCanFire(bot){const target=getCombatEntityById(bot._brain?.targetId);if(!target||target.hp<=0||target.isDead||areAllies(bot,target))return false;
 const d=Math.hypot(target.x-bot.x,target.y-bot.y),angle=Math.atan2(target.y-bot.y,target.x-bot.x);
 return d<=getBotWeaponRange(bot).max&&Math.abs(botAngleDelta(angle,bot.angle))<Math.PI*.42&&hasLineOfSight(bot,target);
}
const spikePrepSide=p=>p.teamId===`team_${spikeState?.attackTeam||1}`?0:1;
let spikePrepActor=null,spikeNavActor=null;
const oldPlayerCollision=checkObstacleCollision;
checkObstacleCollision=(x,y,r=15)=>oldPlayerCollision(x,y,r)||(selectedMode==='spike'&&spikeState?.phase==='prep'&&!SpikeRules.prepContains({x,y},spikePrepSide(myPlayer),r));
const oldBotCollision=checkBotNavigationCollision;
checkBotNavigationCollision=(x,y,r=15)=>oldBotCollision(x,y,r)||(spikePrepActor&&!SpikeRules.prepContains({x,y},spikePrepSide(spikePrepActor),r));
const oldBotSegment=botSegmentClear;
botSegmentClear=(a,b)=>{if(!oldBotSegment(a,b))return false;if(spikeNavActor){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/15);for(let i=0;i<=n;i++){const t=i/Math.max(1,n);const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,margin=15+Math.min(4,Math.hypot(x-spikeNavActor.x,y-spikeNavActor.y)/10);if(oldBotCollision(x,y,margin))return false;}}if(spikePrepActor){const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/20);for(let i=0;i<=n;i++){const t=i/Math.max(1,n);if(!SpikeRules.prepContains({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},spikePrepSide(spikePrepActor)))return false;}}return true;};
const originalMap=generateMapData;
generateMapData=(mode,seed)=>mode==='spike'?{seed,worldSize:SpikeRules.SIZE,obstacles:SpikeRules.WALLS.map(w=>({...w})),items:[]}:originalMap(mode,seed);
const originalTeam=applyEntityTeam;
applyEntityTeam=p=>{if(selectedMode!=='spike')return originalTeam(p);p.teamId=isAssignedSpectator(p.id)?null:`team_${teamAssignments[p.id]===2?2:1}`;p.team=null;return p;};
const oldNormalizeTeams=normalizeRoomTeams;
normalizeRoomTeams=(roster=roomTeamRoster())=>{
 if(selectedMode!=='spike')return oldNormalizeTeams(roster);
 const counts=[0,0];for(const p of roster)if(!isAssignedSpectator(p.id)&&[1,2].includes(teamAssignments[p.id]))counts[teamAssignments[p.id]-1]++;
 for(const p of roster){if(!isAssignedSpectator(p.id)&&![1,2].includes(teamAssignments[p.id])){const t=counts[0]<=counts[1]?1:2;teamAssignments[p.id]=t;counts[t-1]++;}applyEntityTeam(p);}
};
const oldSetRoomTeam=setRoomTeam;
setRoomTeam=(id,value)=>{if(selectedMode!=='spike')return oldSetRoomTeam(id,value);const t=Number(value);if(!isHost||gameStarted||isAssignedSpectator(id)||![1,2].includes(t)||!roomTeamRoster().some(p=>p.id===id))return false;teamAssignments[id]=t;publishRoomRoles();return true;};
const originalPrepare=prepareMatchTeams;
prepareMatchTeams=()=>{if(selectedMode!=='spike')return originalPrepare();normalizeRoomTeams(spikeActors());spikeActors().forEach(applyEntityTeam);initialTeamCount=2;};
const originalStartRequest=hostStartGame;
hostStartGame=()=>{
 if(document.getElementById('gameModeSelect').value==='spike'){
  const bots=document.getElementById('aiToggle').value==='true'?Number(document.getElementById('aiCountInput').value)||0:0;
  if(roomHumans().filter(p=>!isAssignedSpectator(p.id)).length+bots<2){alert('일반게임은 양 팀에 참가자가 필요합니다. 다른 플레이어를 초대하거나 봇을 추가해 주세요.');return;}
 }
 if(document.getElementById('gameModeSelect').value==='spike'){selectedMode='spike';normalizeRoomTeams();const teams=new Set(roomTeamRoster().filter(p=>!isAssignedSpectator(p.id)).map(p=>teamAssignments[p.id]));if(teams.size<2){alert('양 팀에 최소 한 명씩 배정해 주세요.');return;}}
 originalStartRequest();
};
const originalStart=startGame;
startGame=()=>{
 if(selectedMode!=='spike'){spikeMatch=null;spikeState=null;myPlayer.maxHp=200;spikeToggleShop(false);return originalStart();}
 spikeAppliedRound=0;spikeShopRound=0;spikeHeld=false;spikeLastTick=performance.now();
 originalStart();WORLD_SIZE=SpikeRules.SIZE;isSpawnSelecting=false;
 document.getElementById('hudGameMode').textContent='일반게임 · 어센트';
 if(isHost){spikeMatch=new SpikeRules.Match(spikeActors);spikeState=spikeMatch.snapshot();spikeApply(spikeState);}
};
const originalWeaponModal=openDeathmatchWeaponModal;
openDeathmatchWeaponModal=(...args)=>{if(selectedMode!=='spike')return originalWeaponModal(...args);};
const originalBotRespawn=respawnBot;
respawnBot=p=>{if(selectedMode!=='spike')originalBotRespawn(p);};
const originalShoot=shoot;
shoot=(p,spread,shotId)=>{if(selectedMode==='spike'&&p.id?.startsWith('bot_')&&!spikeBotCanFire(p))return;if(selectedMode==='spike'&&(!['live','planted'].includes(spikeState?.phase)||p.isDead||p.hp<=0||p._spikeUse))return;if(selectedMode==='spike'&&p===myPlayer&&WEAPONS[p.weapon]?.semi&&p.isShooting&&p._semiLatch)return;const ammo=p.clipAmmo;const result=originalShoot(p,spread,shotId);if(selectedMode==='spike'&&p===myPlayer&&WEAPONS[p.weapon]?.semi&&p.isShooting&&p.clipAmmo<ammo)p._semiLatch=true;return result;};
// Mouse release must be handled even when it happens over a HUD or outside the canvas.
window.addEventListener('mouseup',e=>{if(isMobile)return;if(e.button===0){myPlayer.isShooting=false;myPlayer._semiLatch=false;}if(e.button===2)myPlayer.isAiming=false;});
window.addEventListener('blur',()=>{myPlayer.isShooting=false;myPlayer.isAiming=false;myPlayer._semiLatch=false;});
const originalEntity=networkEntityState;
networkEntityState=p=>{const state=originalEntity(p);if(selectedMode==='spike'){state._spikeUse=p===myPlayer?spikeHeld:!!p._spikeUse;state._spikeRound=spikeAppliedRound;state.moveSpeed=Number.isFinite(p.moveSpeed)?p.moveSpeed:undefined;}return state;};
const originalSend=safeSend;
safeSend=(c,data)=>{if(selectedMode==='spike'&&isHost&&data?.type==='SYNC'&&spikeMatch){const viewer=getCombatEntityById(c.playerId)||{teamId:'spectator'};data={...data,spike:spikeMatch.snapshot(viewer)};
 if(spikeMatch.phase==='prep'){const conceal=p=>p.id===viewer.id||p.teamId===viewer.teamId?p:{id:p.id,name:p.name,teamId:p.teamId,hp:p.hp,maxHp:p.maxHp,isDead:p.isDead,kills:p.kills,deaths:p.deaths,x:-10000,y:-10000,angle:0,isMoving:false,hiddenPrep:true};
  if(data.players)data.players=data.players.map(conceal);if(data.aiBots)data.aiBots=data.aiBots.map(conceal);
 }
 }return originalSend(c,data);};
function spikeApply(state){
 if(!state)return;spikeState=state;
 for(const actor of state.actors||[]){const p=getCombatEntityById(actor.id);if(p){p.teamId=actor.teamId;if(!isHost){p.credits=actor.credits;p.shield=actor.shield;p.shieldType=actor.shieldType;p.shieldPool=actor.shieldPool;}}}
 const me=(state.actors||[]).find(p=>p.id===myPlayer.id);
 if(state.round!==spikeAppliedRound){
  spikeAppliedRound=state.round;spikeHeld=false;bullets.length=0;isRespawning=false;isSpectating=isAssignedSpectator(myPlayer.id);spectateTarget=null;
  if(me){Object.assign(myPlayer,me,state.spawns[myPlayer.id]);resetDownedState(myPlayer);myPlayer.isShooting=false;myPlayer.isReloading=false;camera.x=myPlayer.x;camera.y=myPlayer.y;}
  for(const id of ['spectateHUD','respawnHUD','weaponSelectModal','fullMapOverlay'])document.getElementById(id).style.display='none';
  document.getElementById('statusHUD').style.display='block';if(isMobile)document.getElementById('mobileControls').style.display='block';
 }else if(me){
  myPlayer.credits=me.credits;myPlayer.shield=me.shield;myPlayer.shieldType=me.shieldType;myPlayer.shieldPool=me.shieldPool;myPlayer.loadout=me.loadout;myPlayer.purchases=me.purchases;myPlayer.activeSlot=me.activeSlot;myPlayer.hp=me.hp;myPlayer.kills=me.kills;myPlayer.deaths=me.deaths;
  if(me.isDead&&!myPlayer.isDead){myPlayer.isDead=true;startSpectating();}
  if(state.phase==='prep'||myPlayer.weapon!==me.weapon){myPlayer.isReloading=false;myPlayer._reloadToken=(myPlayer._reloadToken||0)+1;myPlayer.weapon=me.weapon;myPlayer.clipAmmo=me.clipAmmo;myPlayer.reserveAmmo=me.reserveAmmo;}
 }
 spikeUI();
}
const originalNetwork=handleNetworkData;
handleNetworkData=data=>{
 if(selectedMode==='spike'&&isHost){
  if(['SPIKE_BUY','SPIKE_SELL','SPIKE_SWITCH','SPIKE_WEAPON'].includes(data.type)){
   const p=remotePlayers[data.player?.id];if(!p||!spikeMatch||data.round!==spikeMatch.round||!Number.isSafeInteger(data.seq)||data.seq<=(p._shopSeq||0))return;
   p._shopSeq=data.seq;
   if(data.type==='SPIKE_BUY')spikeMatch.buy(p,data.item);
   if(data.type==='SPIKE_SELL')spikeMatch.sell(p,data.slot);
   if(data.type==='SPIKE_SWITCH')spikeMatch.switch(p,data.slot);
   return;
  }
  if(data.type==='SYNC'&&data.player){
   const p=remotePlayers[data.player.id];if(!p||data.player._spikeRound!==spikeMatch?.round)return;
   if(data.player.isReloading&&!p.isReloading)reloadWeapon(p);
   data={...data,player:{...data.player,isReloading:p.isReloading,_spikeShotAt:p._spikeShotAt,hp:p.hp,maxHp:100,credits:p.credits,loadout:p.loadout,purchases:p.purchases,activeSlot:p.activeSlot,shield:p.shield,shieldType:p.shieldType,shieldPool:p.shieldPool,equippedBodyArmor:null,equippedHelmet:null,isDead:p.isDead,kills:p.kills,deaths:p.deaths,teamId:p.teamId,weapon:p.weapon,clipAmmo:p.clipAmmo,reserveAmmo:p.reserveAmmo}};
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
let spikeShopSeq=0;
function spikeShopAction(type,value){
 if(selectedMode!=='spike'||!spikeState||myPlayer.isDead)return;
 if(isHost){const ok=type==='buy'?spikeMatch.buy(myPlayer,value):type==='sell'?spikeMatch.sell(myPlayer,value):spikeMatch.switch(myPlayer,value);spikeState=spikeMatch.snapshot();spikeApply(spikeState);if(typeof GameAudio!=='undefined')GameAudio.emit(ok?'equip':'error');}
 else broadcastData({type:type==='buy'?'SPIKE_BUY':type==='sell'?'SPIKE_SELL':'SPIKE_SWITCH',player:{id:myPlayer.id},item:value,slot:value,round:spikeState.round,seq:++spikeShopSeq});
}
function spikeChoose(weapon){spikeShopAction('buy',weapon);}
const spikeOriginalKill=addKill;
addKill=id=>{spikeOriginalKill(id);if(selectedMode==='spike'&&isHost)spikeMatch?.rewardKill(id);};
const spikeOldInventory=toggleInventory;
toggleInventory=()=>{if(selectedMode==='spike')return spikeToggleShop();return spikeOldInventory();};
const spikeOldUnequip=unequipWeapon;
unequipWeapon=()=>{if(selectedMode!=='spike')spikeOldUnequip();};
const originalSelect=selectDeathmatchWeapon;
selectDeathmatchWeapon=type=>selectedMode==='spike'?spikeChoose(type):originalSelect(type);
const originalUpdateAI=updateAI;
updateAI=()=>{if(selectedMode!=='spike')return originalUpdateAI();return SpikeTactics.tick();};
const oldBotWeaponRange=getBotWeaponRange;
getBotWeaponRange=bot=>{
 if(selectedMode!=='spike')return oldBotWeaponRange(bot);
 const category=WEAPONS[bot.weapon]?.category;
 return category==='Sniper'?{ideal:1050,min:450,max:1900,vision:2100}:category==='Shotgun'?{ideal:160,min:60,max:480,vision:1100}:{ideal:600,min:160,max:1300,vision:1500};
};
let spikeFootstepPhase=null;
const originalUpdate=update;
update=()=>{
 if(selectedMode==='spike'&&spikeState?.phase!==spikeFootstepPhase){footstepEvents.length=0;footstepTracks.clear();spikeFootstepPhase=spikeState?.phase;}
 if(!myPlayer.isShooting)myPlayer._semiLatch=false;
 if(selectedMode!=='spike'||!gameStarted||gameEnded)return originalUpdate();
 if(spikeShopOpen){myPlayer.isShooting=false;myPlayer.isAiming=false;mobileMoveVec.x=0;mobileMoveVec.y=0;for(const k of ['w','a','s','d'])keys[k]=false;}
 const now=performance.now(),dt=Math.min(.1,(now-spikeLastTick)/1000);spikeLastTick=now;spikeFrameDt=Math.max(0,Math.min(.05,dt));
 myPlayer._spikeUse=spikeHeld;
 if(spikeState?.phase==='prep'||['end','finished'].includes(spikeState?.phase)||spikeHeld)myPlayer.isShooting=false;
 originalUpdate();
 if(isHost&&spikeMatch?.phase==='prep')for(const bot of aiBots)if(bot._boughtRound!==spikeMatch.round){bot._boughtRound=spikeMatch.round;for(const id of [...(Number(bot.id.replace(/\D/g,''))%3===1?['v_bucky']:Number(bot.id.replace(/\D/g,''))%3===2?['v_operator']:[]),'v_vandal'])if(spikeMatch.buy(bot,id))break;spikeMatch.buy(bot,bot.credits>=1000?'heavy':'light');}
 if(spikeState?.phase==='prep')SpikeRules.constrainPrep(myPlayer,spikePrepSide(myPlayer));
 if(isHost&&spikeMatch){for(const p of Object.values(remotePlayers))if(Date.now()-(p._inputAt||0)>700)p._spikeUse=false;const prev=spikeMatch.round;spikeMatch.tick(dt);spikeState=spikeMatch.snapshot();if(['end','finished'].includes(spikeState.phase))bullets.length=0;if(prev!==spikeMatch.round)spikeApply(spikeState);}
 spikeUI();
 if(isHost&&spikeState?.phase==='finished'&&spikeState.time<=0)returnToRoomAfterGame();
};
const spikePanel=document.createElement('div');spikePanel.id='spikePanel';
spikePanel.style.cssText='position:absolute;top:8px;left:8px;transform:none;z-index:48;text-align:center;background:#101821dd;border:1px solid #5aaeb6;border-radius:8px;padding:5px 7px;color:white;max-width:29%;display:none;font-size:10px;pointer-events:none';
spikePanel.innerHTML='<div id="spikeStatus"></div><div id="spikeWeaponBar" style="pointer-events:auto;margin-top:6px"><button style="width:auto;padding:4px 8px;margin:2px;font-size:11px" onclick="spikeToggleShop()">B · 장비 구매</button></div><div id="spikeHealthBar" style="height:6px;background:#17222b;display:flex;margin:4px 0;overflow:hidden;border-radius:3px"><div id="spikeShieldFill" style="height:100%;background:repeating-linear-gradient(135deg,#8ed2ff 0px,#8ed2ff 2px,#216bc4 2px,#216bc4 5px)"></div><div id="spikeHealthFill" style="height:100%;background:#00ffcc"></div></div><div id="spikeEconomy" style="color:#e8bd69;margin:5px"></div><div style="pointer-events:auto"><button style="width:auto;padding:3px 6px;font-size:10px" onclick="spikeShopAction(\'switch\',\'primary\')">1 · 주무기</button> <button style="width:auto;padding:3px 6px;font-size:10px" onclick="spikeShopAction(\'switch\',\'secondary\')">2 · 권총</button></div><div id="spikePrompt" style="color:#ffda83;margin-top:4px"></div>';

gameFrame.appendChild(spikePanel);
const spikeButton=document.createElement('div');spikeButton.id='btnSpike';spikeButton.className='mobile-btn touch-zone';spikeButton.textContent='설치 / 해체';spikeButton.style.cssText='bottom:180px;right:12px;width:64px;height:48px;font-size:11px;border-color:#ffcc66;display:none;touch-action:none';document.getElementById('mobileControls').appendChild(spikeButton);
let spikeTouch=null;
spikeButton.addEventListener('touchstart',e=>{if(isEditingKeys||spikeTouch!==null)return;e.preventDefault();spikeTouch=e.changedTouches[0].identifier;spikeHeld=true;},{passive:false});
for(const name of ['touchend','touchcancel'])window.addEventListener(name,e=>{if([...e.changedTouches].some(t=>t.identifier===spikeTouch)){spikeTouch=null;spikeHeld=false;}});
window.addEventListener('keydown',e=>{if(selectedMode==='spike'&&e.key.toLowerCase()==='f'){e.preventDefault();spikeHeld=true;}});
window.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='f')spikeHeld=false;});
window.addEventListener('blur',()=>{spikeHeld=false;spikeTouch=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){spikeHeld=false;spikeTouch=null;}});
const spikeBanner=document.createElement('div');spikeBanner.id='spikeBanner';spikeBanner.style.cssText='position:absolute;left:50%;top:6px;transform:translateX(-50%);z-index:70;width:min(350px,36%);text-align:center;padding:5px 8px;border-top:3px solid #66e4d0;background:linear-gradient(90deg,transparent,#101923f2 15%,#101923f2 85%,transparent);color:white;pointer-events:none;display:none';spikeBanner.setAttribute('aria-live','polite');gameFrame.appendChild(spikeBanner);
let spikeBannerKey='',spikeBannerUntil=0;
function spikeRoundBanner(){
 const s=spikeState;if(selectedMode!=='spike'||!gameStarted||!s){spikeBanner.style.display='none';spikeBannerKey='';return;}
 const key=s.round+':'+s.phase,now=performance.now();if(key!==spikeBannerKey){spikeBannerKey=key;spikeBannerUntil=now+(s.phase==='live'?2200:s.phase==='planted'?2400:Infinity);}
 if(now>spikeBannerUntil){spikeBanner.style.display='none';return;}
 const observer=isAssignedSpectator(myPlayer.id),win=myPlayer.teamId===`team_${s.winnerTeam}`;
 let title='',sub='',color='#66e4d0';
 if(s.phase==='prep'){title=s.round===1?'게임 시작 · 준비 시간':`${s.round}라운드 준비`;sub=`${Math.ceil(Math.max(0,s.time))}초 후 시작 · 준비 구역에서 구매 · 진입로에 대기 · 13점 선승`;}
 if(s.phase==='live'){title='라운드 시작';sub=myPlayer.teamId===`team_${s.attackTeam}`?'공격 · A/B에 스파이크를 설치하세요':'수비 · 설치를 막고 스파이크를 해체하세요';}
 if(s.phase==='planted'){title='스파이크 설치됨';sub=`${s.bomb.site} 지점 · 폭발까지 ${Math.ceil(s.time)}초`;color='#ffc56a';}
 if(['end','finished'].includes(s.phase)){title=(s.phase==='finished'?'게임 종료 · ':'라운드 ')+(observer?`팀 ${s.winnerTeam} 승리`:win?'승리':'패배');color=observer||win?'#66e4d0':'#ff7684';sub=`${s.result} · ${s.score[0]} : ${s.score[1]} · ${Math.ceil(Math.max(0,s.time))}초 후 ${s.phase==='finished'?'대기실 복귀':'다음 라운드'}`;}
 spikeBanner.style.display=title?'block':'none';spikeBanner.style.borderColor=color;spikeBanner.innerHTML=`<div style="font-size:clamp(13px,1.8vw,20px);font-weight:900;color:${color}">${title}</div><div style="margin-top:3px;font-size:10px">${sub}</div>`;
}
const spikeAction=document.createElement('div');spikeAction.id='spikeAction';spikeAction.style.cssText='position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:66;width:min(250px,36vw);color:#fff;text-align:center;pointer-events:none;display:none;text-shadow:0 2px 5px #000';
spikeAction.innerHTML='<div id="spikeActionTitle" style="font-size:12px;letter-spacing:1px;font-weight:800;margin-bottom:10px"></div><div id="spikeActionTrack" role="progressbar" aria-label="스파이크 진행" aria-valuemin="0" aria-valuemax="100" style="height:12px;padding:3px;border:1px solid #ffffffaa;background:#101820b8;position:relative"><div id="spikeActionFill" style="height:100%;width:0;background:#f2f3e5;transition:width 65ms linear"></div><div id="spikeActionHalf" style="display:none;position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:#fff"></div></div><div style="display:flex;justify-content:space-between;font-size:12px;margin-top:9px"><span id="spikeActionKey"></span><span id="spikeActionTime"></span></div><div id="spikeActionSaved" style="color:#72edce;font-size:12px;margin-top:6px"></div>';
gameFrame.appendChild(spikeAction);
function updateSpikeAction(){
 const s=spikeState;if(selectedMode!=='spike'||!gameStarted||gameEnded||!s||!['live','planted'].includes(s.phase)){spikeAction.style.display='none';return;}
 const viewer=isSpectating&&spectateTarget?spectateTarget:myPlayer,b=s.bomb,attacker=viewer.teamId===`team_${s.attackTeam}`,actor=getCombatEntityById(s.actor);
 const canSeeActor=actor&&(b.planted?areAllies(viewer,actor):attacker);
 const near=viewer.hp>0&&!viewer.isDead&&(b.planted?!attacker&&Math.hypot(viewer.x-b.x,viewer.y-b.y)<85:b.carrier===viewer.id&&SpikeRules.SITES.some(site=>Math.hypot(viewer.x-site.x,viewer.y-site.y)<site.r));
 if(!canSeeActor&&!near){spikeAction.style.display='none';return;}
 const defuse=b.planted,duration=defuse?7:4,progress=Math.max(0,Math.min(duration,canSeeActor?s.progress:defuse?(b.defuseCheckpoint||0):0)),active=!!canSeeActor;
 spikeAction.style.display='block';
 document.getElementById('spikeActionTitle').textContent=active?(actor.id===viewer.id?'':'팀원 ')+(defuse?'스파이크 해체 중':'스파이크 설치 중'):(defuse?'스파이크 해체':'스파이크 설치');
 document.getElementById('spikeActionFill').style.width=(progress/duration*100)+'%';
 document.getElementById('spikeActionFill').style.background=defuse?'#72edce':'#f2f3e5';
 document.getElementById('spikeActionTrack').setAttribute('aria-valuenow',String(Math.round(progress/duration*100)));
 document.getElementById('spikeActionHalf').style.display=defuse?'block':'none';
 document.getElementById('spikeActionKey').textContent=actor&&actor.id!==viewer.id?'팀원 진행 상황':isMobile?'설치 / 해체 버튼 유지':'[ F ] 누르고 있기';
 document.getElementById('spikeActionTime').textContent=(duration-progress).toFixed(1)+'초';
 document.getElementById('spikeActionSaved').textContent=defuse?(b.defuseCheckpoint>=3.5?'반해체 완료 · 50% 저장됨':'중앙 지점 도달 시 50% 저장'):active?'이동하거나 손을 떼면 설치 취소':'';
}
function spikeUI(){
 spikeRoundBanner();updateSpikeAction();if(typeof spikeShopRefresh==='function')spikeShopRefresh();
 document.getElementById('btnSprint').style.display=selectedMode==='spike'?'none':'';
 if(selectedMode==='spike')mobileSprintHeld=false;
 const active=selectedMode==='spike'&&gameStarted&&!gameEnded&&spikeState;spikePanel.style.display=active?'block':'none';spikeButton.style.display=active&&isMobile?'flex':'none';if(!active)return;
 document.getElementById('statusHUD').style.display='none';
 const s=spikeState,b=s.bomb,attacking=myPlayer.teamId===`team_${s.attackTeam}`;
 document.getElementById('spikeStatus').textContent=`어센트 · ${s.round}라운드 | 청록 ${s.score[0]} : ${s.score[1]} 코랄 | ${attacking?'공격':'수비'} | ${s.phase==='prep'?'준비':s.phase==='planted'?'폭발까지':['end','finished'].includes(s.phase)?s.result:'라운드'} ${Math.max(0,Math.ceil(s.time))}초`;
 const capacity=SpikeCatalog.armor[myPlayer.shieldType]?.capacity||0,total=(myPlayer.maxHp||100)+capacity;
 document.getElementById('spikeHealthFill').style.width=(Math.max(0,myPlayer.hp)/total*100)+'%';
 document.getElementById('spikeShieldFill').style.width=(Math.max(0,myPlayer.shield||0)/total*100)+'%';
 document.getElementById('spikeEconomy').textContent=`${WEAPONS[myPlayer.weapon]?.name||''} ${myPlayer.clipAmmo||0}/${myPlayer.reserveAmmo||0} · ¤ ${myPlayer.credits||0} · HP ${Math.ceil(myPlayer.hp)} · 방어구 ${Math.ceil(myPlayer.shield||0)}${myPlayer.shieldType==='regen'?' / 재생 '+Math.ceil(myPlayer.shieldPool||0):''}`;
 const prep=s.phase==='prep'&&!myPlayer.isDead;document.getElementById('spikeWeaponBar').style.display=prep?'block':'none';
 let hint=prep?'B / 구매 버튼 · 준비 구역에서 장비 구매 · 1 주무기 / 2 보조무기':['end','finished'].includes(s.phase)?s.result:b.planted?`${b.site} 지점 설치됨 · 수비는 F / 설치·해체 버튼 7초 유지`:b.carrier===myPlayer.id?'스파이크 보유 · A/B에서 F / 설치·해체 버튼 4초 유지':attacking?'스파이크 운반자를 엄호하세요. 떨어진 스파이크는 가까이 가면 줍습니다.':'A/B 지점을 방어하세요.';
 if(b.planted&&b.defuseCheckpoint>=3.5)hint+=' · 반해체 완료 (50% 저장)';

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
 if(spikeState?.phase==='prep'){for(let side=0;side<2;side++){context.fillStyle=side?'#4d708522':'#af784322';for(const r of SpikeRules.PREP_AREAS[side])context.fillRect(r.x,r.y,r.w,r.h);}context.strokeStyle='#7cddff';context.lineWidth=7;for(const r of SpikeRules.PREP_BARRIERS){context.beginPath();context.moveTo(r.x,r.y);context.lineTo(r.x+r.w,r.y+r.h);context.stroke();}}
 for(let i=0;i<2;i++){const r=SpikeRules.SPAWNS[i];context.fillStyle=i?'#4d708533':'#af784333';context.fillRect(r.x,r.y,r.w,r.h);context.strokeStyle=i?'#77beed':'#ffc270';context.lineWidth=3;context.strokeRect(r.x,r.y,r.w,r.h);context.fillStyle='white';context.font='bold 25px sans-serif';context.fillText(i?'수비 스폰':'공격 스폰',SpikeRules.SPAWN_ANCHORS[i].x,SpikeRules.SPAWN_ANCHORS[i].y);}
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

// Hide enemy tracers behind walls, including their previous endpoint and trail.
function spikeBulletVisible(b){
 if(selectedMode!=='spike')return true;
 const viewer=isSpectating&&spectateTarget?spectateTarget:myPlayer;
 const owner=getCombatEntityById(b.ownerId);
 if(b.ownerId===viewer?.id||(owner&&viewer&&areAllies(viewer,owner)))return true;
 if(!viewer)return false;
 const prev={x:Number.isFinite(b.prevX)?b.prevX:b.x,y:Number.isFinite(b.prevY)?b.prevY:b.y};
 return hasLineOfSight(viewer,b)&&hasLineOfSight(viewer,prev)&&hasLineOfSight(viewer,{x:(prev.x+b.x)/2,y:(prev.y+b.y)/2});
}
