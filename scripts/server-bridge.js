// This file runs after the trusted shared game source in a room-local Node VM.
// No browser, rendering, audio or PeerJS runs on the server.
isHost=true;
myPlayer.id='__server__';myPlayer.hp=0;myPlayer.isDead=true;
spectatorIds.add(myPlayer.id);
roomHumans=()=>Object.values(remotePlayers);
render=()=>{};renderRoomRoles=()=>{};refreshSpectatorControls=()=>{};
updateReviveHUD=()=>{};spawnBloodParticles=()=>{};triggerDamageEffect=()=>{};
startGame=()=>{
 gameStarted=true;gameEnded=false;isSpawnSelecting=selectedMode==='br';
 bullets.length=0;reviveSessions.clear();gunshotEvents.length=0;
 myPlayer.hp=0;myPlayer.isDead=true;isSpectating=true;
 if(isSpawnSelecting)setTimeout(()=>{isSpawnSelecting=false;startBattleRoyaleZoneLogic();},10000);
};
displayRankings=()=>{setTimeout(()=>{
 gameStarted=false;gameEnded=false;aiBots.length=0;bullets.length=0;
 if(zoneTimerInterval)clearInterval(zoneTimerInterval);
 broadcastData({type:'RETURN_TO_ROOM'});publishRoomRoles();
},5000);};
const originalUpdateNetwork=updateNetwork;
updateNetwork=()=>{}; // scheduler sends only once after all physics steps
const originalBroadcast=broadcastData;
broadcastData=data=>{
 if(data.type==='START')globalThis.startPacket=data;
 originalBroadcast(data);
};
globalThis.roomAPI={
 add(id,name,send,buffered){
  const p={...myPlayer,id,name:String(name||'플레이어').slice(0,24),hp:200,maxHp:200,isDead:false,isDowned:false,kills:0,deaths:0,weapon:null,inventory:{scopes:[],armors:[],healing:{bandage:0,medkit:0}}};
  if(remotePlayers[id])return false;
  remotePlayers[id]=p;
  connections[id]={playerId:id,open:true,send,dataChannel:{get bufferedAmount(){return buffered();}}};
  publishRoomRoles();this.settings({});return true;
 },
 remove(id){delete connections[id];delete remotePlayers[id];spectatorIds.delete(id);delete teamAssignments[id];if(!gameStarted)publishRoomRoles();},
 settings(m){
  if(!gameStarted){
   if(m.mode==='br'||m.mode==='normal')selectedMode=m.mode;
   document.getElementById('gameModeSelect').value=selectedMode;
   if(typeof m.aiToggle==='boolean')document.getElementById('aiToggle').value=String(m.aiToggle);
   if(Object.hasOwn(AI_DIFFICULTY,m.aiDiff))document.getElementById('aiDifficultySelect').value=m.aiDiff;
   if(Number.isFinite(Number(m.aiCount)))document.getElementById('aiCountInput').value=String(Math.max(0,Math.min(selectedMode==='br'?100:20,Math.floor(Number(m.aiCount)))));
  }
  onHostSettingsChange();
 },
 start(){hostStartGame();return gameStarted;},
 control(m){if(gameStarted)return;
  if(m.action==='team')setRoomTeam(m.id,m.value);
  if(m.action==='spectator')setRoomSpectator(m.id,!!m.value);
  if(m.action==='teamSize')setTeamMaxSize(m.value);
 },
 receive(id,m){
  const previous=remotePlayers[id];if(!previous)return;
  if(m.type==='SYNC'){
   if(!m.player)return;
   const next={...previous};
   for(const key of NETWORK_ENTITY_KEYS){
    const value=m.player[key];
    if(['id','name','teamId','team','kills','deaths','maxHp'].includes(key))continue;
    if(value===null || typeof value==='boolean' || typeof value==='string' && value.length<40 || typeof value==='number' && Number.isFinite(value))next[key]=value;
   }
   next.x=Math.max(0,Math.min(WORLD_SIZE,Number(next.x)||0));next.y=Math.max(0,Math.min(WORLD_SIZE,Number(next.y)||0));
   next.hp=Math.max(0,Math.min(200,Number(next.hp)||0));
   if(next.weapon&&!Object.hasOwn(WEAPONS,next.weapon))next.weapon=null;
   next.clipAmmo=Math.max(0,Math.min(next.weapon?WEAPONS[next.weapon].maxClip:0,Number(next.clipAmmo)||0));
   next.reserveAmmo=Math.max(0,Math.min(999,Number(next.reserveAmmo)||0));
   // Clients may still select equipment/heal locally, but cannot undo server damage
   // during the damage lock or resurrect a dead/downed player through a snapshot.
   if(previous.isDead||previous.isDowned||Date.now()<(previous._lifeLockUntil||0)){
    for(const key of ['hp','isDead','isDowned','downedUntil','_lifeLockUntil','_downedBy','_downedHits'])next[key]=previous[key];
   }
   if(previous.isDowned||previous.isDead){next.x=previous.x;next.y=previous.y;}
   applyEntityTeam(next);enforceObserver(next);
   handleNetworkData({type:'SYNC',player:next});return;
  }
  if(!gameStarted||gameEnded||isAssignedSpectator(id))return;
  if(m.type==='SHOOT'){
   const weapon=previous.weapon&&WEAPONS[previous.weapon];
   if(!weapon||previous.hp<=0||previous.isDead||previous.isDowned||Date.now()-(previous._serverShotAt||0)<weapon.cooldown-5)return;
   if(Number.isFinite(m.player?.angle))previous.angle=m.player.angle;
   previous._serverShotAt=Date.now();shoot(previous,0);
   broadcastData({type:'SHOOT_EVENT',player:networkEntityState(previous)});return;
  }
  if(m.type==='DOOR_USE')handleNetworkData({type:m.type,doorId:String(m.doorId),player:{id}});
  if(m.type==='PICKUP_ITEM'){
   const item=droppedItems.find(p=>p.id===m.itemId);
   if(item&&Math.hypot(item.x-previous.x,item.y-previous.y)<160)handleNetworkData({type:m.type,itemId:item.id});
  }
  if(m.type==='DROP_ITEM'&&m.item&&Number.isFinite(m.item.x)&&Number.isFinite(m.item.y)&&typeof m.item.id==='string'&&m.item.id.length<80&&typeof m.item.type==='string'&&m.item.type.length<40&&Math.hypot(m.item.x-previous.x,m.item.y-previous.y)<160&&droppedItems.length<10000){
   if(!droppedItems.some(p=>p.id===m.item.id))handleNetworkData({type:m.type,item:{id:m.item.id,x:m.item.x,y:m.item.y,type:m.item.type}});
  }
  if(m.type==='RESPAWN_REMOTE'&&selectedMode==='normal'&&previous.isDead)handleNetworkData({type:m.type,playerId:id,peerId:id});
 },
 tick(){const before=new Map(roomHumans().map(p=>[p.id,p.hp]));update();for(const p of roomHumans())if(p.hp<(before.get(p.id)??p.hp))p._lifeLockUntil=Date.now()+1500;if(gameStarted&&!gameEnded){updateHUD();checkDeathmatchVictory();}},
 sync(){if(gameStarted){lastHostSyncAt=0;originalUpdateNetwork();}},
 state(){return {started:gameStarted,ended:gameEnded,seed:currentMapSeed,bots:aiBots.length,players:roomHumans().map(networkEntityState),zone:{...zone}};}
};
