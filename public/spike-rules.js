/* Shared objective rules; no DOM, timers or transport dependencies. */
(function(root){
 // Metre convention for this 2D adaptation; geometry is approximate, not a 1:1 port.
 const UNITS_PER_METER=40, SIZE=4800;
 const MOVE_MPS=5.4, QUIET_MPS=3.24;
 const weaponSpeed=id=>root.SpikeCatalog?.weapons[id]?.moveMps||MOVE_MPS;
 const movementDistance=(dt,quiet=false,weapon=null)=>weaponSpeed(weapon)*(quiet?.6:1)*UNITS_PER_METER*Math.max(0,Math.min(.05,dt));
 // Two fixed joystick speeds with a small neutral zone; direction stays analog.
 function mobileMove(x,y){const magnitude=Math.hypot(x,y);if(magnitude<=.08)return {x:0,y:0,quiet:false};return {x:x/magnitude,y:y/magnitude,quiet:magnitude<=.6};}
 function movingSpread(p){
  const w=root.SpikeCatalog?.weapons[p.weapon];if(!w)return 0;
  const base=w.spread;if(!p.isMoving)return base;
  const speed=Number.isFinite(p.moveSpeed)?p.moveSpeed:weaponSpeed(p.weapon)*(p.movementMode==='stealth'?.6:1);
  const ratio=Math.max(0,Math.min(1,speed/weaponSpeed(p.weapon)));
  // Walking is one quarter of the full movement penalty; analog input blends continuously.
  const factor=ratio<=.6?Math.max(0,(ratio-.08)/.52)*.25:.25+(ratio-.6)/.4*.75;
  return base+w.movingSpreadDegrees*Math.PI/180*factor;
 }
 // Hand-built 2D adaptation of Riot's official Ascent overhead layout.
 // Reference: https://playvalorant.com/en-gb/maps/#ascent
 // Coordinates below use the 640px reference; runtime geometry is 4800 units.
 const SCALE=SIZE/640;
 const rect=([x,y,w,h])=>({x:x*SCALE,y:y*SCALE,w:w*SCALE,h:h*SCALE});
 const MAP_NAME='어센트 · ASCENT';
 // Official Ascent callout coordinates, rotated counterclockwise to match this map.
 // Riot map metadata: x' = 640*(-0.00007*worldX + 0.573242),
 // y' = 640*(1 - (0.00007*worldY + 0.813895)).
 const SPAWN_ANCHORS=[{x:364*SCALE,y:117*SCALE},{x:278*SCALE,y:556*SCALE}];
 // Buy zones are the walkable rooms surrounding those callouts, not arbitrary map boxes.
 const SPAWNS=[[336,96,96,96],[240,508,92,80]].map(rect);
 const SITES=[{name:'A',x:128*SCALE,y:424*SCALE,r:32*SCALE},{name:'B',x:496*SCALE,y:440*SCALE,r:34*SCALE}];
 const FLOORS=[
  // Attacker spawn and the split toward A lobby / B lobby.
  [336,48,60,64],[396,96,36,12],[336,108,96,84],[212,136,220,44],[220,176,24,48],
  [408,176,24,112],[408,248,84,80],[464,320,28,60],
  // A lobby, A main and the wine pocket.
  [168,200,48,112],[184,300,28,40],[64,316,148,24],[80,336,92,120],
  // Mid top / catwalk and courtyard. Walls separate the parallel routes.
  [212,212,96,28],[268,236,40,64],[212,288,72,32],
  [268,280,92,80],[356,284,48,44],[396,276,20,52],
  // A link (Tree), garden and window / rafters defender approach.
  [168,360,80,40],[224,316,24,64],[192,396,32,64],[192,436,56,24],
  [64,456,152,24],[148,440,24,32],[168,476,24,52],[168,508,88,24],
  [232,448,24,88],
  // Mid bottom, pizza and market into B.
  [236,360,124,32],[304,388,32,52],[308,416,80,44],[368,436,40,24],
  // B main, lane, site and boathouse.
  [396,364,84,28],[448,380,32,36],[392,400,144,92],[532,424,36,68],
  // Defender spawn and rotation behind the two sites.
  [256,500,76,88],[240,508,16,80],[248,508,188,24],[412,456,24,60],[272,472,60,40],[308,448,24,36]
 ].map(rect);
 const COVERS=[
  [108,408,12,12],[144,416,8,24], // A generator / default cover
  [280,316,16,12],[332,348,12,12], // Mid courtyard angles
  [468,420,12,12],[488,452,20,12],[520,476,12,12], // B default / logs
  [440,264,12,12],[248,148,12,12] // Lobby / spawn cover outside buy zones
 ].map(r=>({...rect(r),type:'wall',cover:true}));
 // Buy-phase playable sides follow corridors up to the approach barriers.
 const PREP_AREAS=[
  [[336,48,60,64],[396,96,36,12],[336,108,96,84],[212,136,220,44],[220,176,24,48],
   [408,176,24,112],[408,248,84,80],[464,320,28,40],[168,200,48,112],[184,300,28,40],
   [64,316,148,20],[212,212,96,28],[268,236,40,28]],
  [[80,336,92,120],[168,360,80,40],[224,336,24,44],[192,396,32,64],[192,436,56,24],
   [64,456,152,24],[148,440,24,32],[168,476,24,52],[168,508,88,24],[232,448,24,88],
   [236,360,124,32],[304,388,32,52],[308,416,80,44],[368,436,40,24],
   [448,392,32,24],[392,400,144,92],[532,424,36,68],[256,500,76,88],[240,508,16,80],
   [248,508,188,24],[412,456,24,60],[272,472,60,40],[308,448,24,36]]
 ].map(side=>side.map(rect));
 const PREP_BARRIERS=[[80,336,132,0],[268,264,40,0],[408,276,0,52],[464,360,28,0],
  [224,336,24,0],[236,360,124,0],[448,392,32,0]].map(rect);
 function prepContains(p,side,radius=15){
  const areas=PREP_AREAS[side];if(!areas)return false;
  const point=(x,y)=>areas.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
  if(!point(p.x,p.y))return false;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!point(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius))return false;}
  return true;
 }
 function constrainPrep(p,side){
  if(prepContains(p,side)){p._prepSafe={x:p.x,y:p.y};return;}
  const safe=p._prepSafe;
  const fallback=safe&&prepContains(safe,side)?safe:SPAWN_ANCHORS[side];p.x=fallback.x;p.y=fallback.y;
 }
 const CALLOUTS=[['A MAIN',152,326],['A LOBBY',191,250],['MID TOP',250,224],
  ['CATWALK',237,304],['MID',312,342],['TREE',203,380],['GARDEN',207,422],
  ['RAFTERS',116,468],['MARKET',350,442],['MID LINK',377,310],
  ['B LOBBY',447,301],['B MAIN',427,379],['BOATHOUSE',550,465]]
  .map(([name,x,y])=>({name,x:x*SCALE,y:y*SCALE}));
 // Merge solid cells into rectangles once, so drawing, bullets, fog and bot
 // navigation all use the same boundaries without a per-frame tile scan.
 const WALLS=[],GRID=160,CELL=SIZE/GRID;
 let previous=new Map();
 for(let row=0;row<GRID;row++){
  const runs=new Map();let start=-1;
  for(let col=0;col<=GRID;col++){
   const x=(col+.5)*CELL,y=(row+.5)*CELL;
   const solid=col<GRID&&!FLOORS.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
   if(solid&&start<0)start=col;
   if(!solid&&start>=0){const key=start+':'+col;let w=previous.get(key);
    if(w)w.h+=CELL;else{w={type:'wall',x:start*CELL,y:row*CELL,w:(col-start)*CELL,h:CELL};WALLS.push(w);}
    runs.set(key,w);start=-1;
   }
  }
  previous=runs;
 }
 WALLS.push(...COVERS);
 const catalog=()=>root.SpikeCatalog.weapons;
 const gear=()=>root.SpikeCatalog.armor;
 const credit=(p,n)=>p.credits=Math.min(9000,Math.max(0,(p.credits||0)+n));
 const copy=x=>x==null?null:JSON.parse(JSON.stringify(x));
 function equip(p,slot){
  const item=p.loadout?.[slot];if(!item||!catalog()[item.id])return false;
  if(p.weapon&&p.activeSlot&&p.loadout[p.activeSlot])Object.assign(p.loadout[p.activeSlot],{clip:p.clipAmmo,reserve:p.reserveAmmo});
  p.activeSlot=slot;p.weapon=item.id;p.clipAmmo=item.clip;p.reserveAmmo=item.reserve;p.isReloading=false;p.reloadStartedAt=0;p._reloadToken=(p._reloadToken||0)+1;return true;
 }
 const fresh=id=>({id,clip:catalog()[id].maxClip,reserve:catalog()[id].maxClip*4});
 function shieldDamage(p,damage){const a=gear()[p.shieldType],blocked=a?Math.min(p.shield||0,damage*a.absorb):0;p.shield=Math.max(0,(p.shield||0)-blocked);p._shieldDelay=3;return damage-blocked;}
 function bulletDamage(b,p){const w=catalog()[b.weapon];if(!w)return b.damage;const d=Math.hypot(p.x-b.startX,p.y-b.startY)/UNITS_PER_METER;return (w.damageRanges.find(r=>d<r.rangeEndMeters)||w.damageRanges.at(-1)).bodyDamage;}
 const alive=p=>p&&p.hp>0&&!p.isDead&&!p.spectator;
 const inside=(p,r)=>p.x>=r.x+15&&p.x<=r.x+r.w-15&&p.y>=r.y+15&&p.y<=r.y+r.h-15;
 class Match{
  constructor(actors){this.actors=actors;this.round=0;this.score=[0,0];this.phase='prep';this.time=0;this.result='';this.progress=0;this.actor=null;this.begin();}
  team(p){return p.teamId==='team_2'?2:1;}
  spawn(p){return SPAWNS[this.team(p)===this.attackTeam?0:1];}
  begin(){
   this.round++;this.attackTeam=this.round%2?1:2;this.phase='prep';this.time=30;this.result='';this.winnerTeam=null;this.actor=null;this.progress=0;this.anchor=null;
   const indexes=[0,0];this.spawns={};
   for(const p of this.actors()){
    if(p.spectator)continue;const team=this.team(p),r=this.spawn(p),i=indexes[team-1]++;
    // Start on the map's attacker/defender spawn callout, then spread teammates
    // across the same room so five players do not appear on one coordinate.
    const anchor=SPAWN_ANCHORS[this.team(p)===this.attackTeam?0:1];
    const slots=[anchor];
    for(let y=r.y+15;y<=r.y+r.h-15;y+=30)for(let x=r.x+15;x<=r.x+r.w-15;x+=30){
     if(Math.hypot(x-anchor.x,y-anchor.y)>=30)slots.push({x,y});
    }
    slots.splice(1,slots.length-1,...slots.slice(1).sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)));
    const spot=slots[i%slots.length];p.x=spot.x;p.y=spot.y;
    const lost=p.isDead||p.hp<=0||this.round===1||!p.loadout;
    if(this.round===1){p.credits=800;p.lossStreak=0;}
    if(lost){p.loadout={primary:null,secondary:fresh('v_classic')};p.shieldType=null;p.shield=0;p.shieldPool=0;}
    for(const slot of ['primary','secondary'])if(p.loadout?.[slot])p.loadout[slot]=fresh(p.loadout[slot].id);
    p.weapon=null;p.activeSlot=null;equip(p,p.loadout.primary?'primary':'secondary');p.purchases={};p._shieldDelay=0;
    p._prepSafe={x:p.x,y:p.y};p.hp=100;p.maxHp=100;p.isDead=false;p.isDowned=false;p.isMoving=false;p.isShooting=false;p._spikeUse=false;p.isReloading=false;
    p.equippedBodyArmor=null;p.equippedHelmet=null;
    this.spawns[p.id]={x:p.x,y:p.y};
   }
   const attackers=this.actors().filter(p=>alive(p)&&this.team(p)===this.attackTeam);
   const carrier=attackers.find(p=>!p.id.startsWith('bot_'))||attackers[0];
   this.bomb={carrier:carrier?.id||null,x:carrier?.x||250,y:carrier?.y||1200,planted:false,site:null,timer:45,defuseCheckpoint:0};
  }
  canBuy(p){return this.phase==='prep'&&alive(p)&&prepContains(p,this.team(p)===this.attackTeam?0:1);}
  choose(p,id){return this.buy(p,id);}
  buy(p,id){
   if(!this.canBuy(p))return false;const w=catalog()[id],a=gear()[id];if(!w&&!a)return false;
   const slot=w?w.slot:'armor',old=p.purchases[slot],refund=old?.cost||0,cost=(w||a).cost;
   if(w&&p.loadout[slot]?.id===id)return false;
   if(a&&p.shieldType===id&&p.shield===a.capacity&&p.shieldPool===a.pool)return false;
   if(p.credits+refund<cost)return false;
   const before=old?old.before:copy(w?p.loadout[slot]:{type:p.shieldType,shield:p.shield,pool:p.shieldPool});
   credit(p,refund-cost);p.purchases[slot]={id,cost,before};
   if(w){if(p.activeSlot===slot)p.activeSlot=null;p.loadout[slot]=fresh(id);equip(p,slot);}
   else{p.shieldType=id;p.shield=a.capacity;p.shieldPool=a.pool;p._shieldDelay=0;}return true;
  }
  sell(p,slot){
   if(!this.canBuy(p)||!['primary','secondary','armor'].includes(slot)||!p.purchases[slot])return false;
   const r=p.purchases[slot];credit(p,r.cost);delete p.purchases[slot];
   if(slot==='armor'){p.shieldType=r.before.type;p.shield=r.before.shield;p.shieldPool=r.before.pool;}
   else{p.activeSlot=null;p.loadout[slot]=r.before;equip(p,p.loadout.primary?'primary':'secondary');}return true;
  }
  switch(p,slot){if(!alive(p)||!['prep','live','planted'].includes(this.phase)||p._spikeUse)return false;return equip(p,slot);}
  rewardKill(id){const p=this.actors().find(p=>p.id===id);if(p&&['live','planted'].includes(this.phase))credit(p,200);}
  finish(team,reason){if(!['live','planted'].includes(this.phase))return;for(const p of this.actors()){if(this.team(p)===team){p.lossStreak=0;credit(p,3000);}else{p.lossStreak=Math.min(3,(p.lossStreak||0)+1);credit(p,[0,1900,2400,2900][p.lossStreak]);}}this.score[team-1]++;this.winnerTeam=team;this.phase=this.score[team-1]>=13?'finished':'end';this.time=this.phase==='finished'?10:6;this.result=reason;this.progress=0;this.actor=null;for(const p of this.actors()){p.isShooting=false;p._spikeUse=false;}}
  tick(dt){
   dt=Math.max(0,Math.min(.1,dt));this.time-=dt;
   for(const p of this.actors())if(alive(p)&&p.shieldType==='regen'){p._shieldDelay=Math.max(0,(p._shieldDelay||0)-dt);if(p._shieldDelay===0){const n=Math.min(25-(p.shield||0),p.shieldPool||0,25*dt);p.shield+=n;p.shieldPool-=n;}}
   if(this.phase==='finished')return;
   if(this.phase==='end'){if(this.time<=0)this.begin();return;}
   if(this.phase==='prep'){
    for(const p of this.actors())if(alive(p)){constrainPrep(p,this.team(p)===this.attackTeam?0:1);p.isShooting=false;}
    if(this.time<=0){this.phase='live';this.time=100;}return;
   }
   const players=this.actors(),b=this.bomb;
   const carrier=players.find(p=>p.id===b.carrier);
   if(!b.planted){
    if(!carrier)b.carrier=null;
    if(carrier){b.x=carrier.x;b.y=carrier.y;if(!alive(carrier))b.carrier=null;}
    if(!b.carrier){const pick=players.find(p=>alive(p)&&this.team(p)===this.attackTeam&&Math.hypot(p.x-b.x,p.y-b.y)<55);if(pick)b.carrier=pick.id;}
   }
   const eligible=p=>alive(p)&&p._spikeUse&&!p.isShooting&&!p.isMoving&&(b.planted?this.team(p)!==this.attackTeam&&Math.hypot(p.x-b.x,p.y-b.y)<85:b.carrier===p.id&&SITES.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<s.r));
   const user=players.find(p=>p.id===this.actor&&eligible(p))||players.find(eligible);
   if(user){
    if(this.actor!==user.id||!this.anchor||Math.hypot(user.x-this.anchor.x,user.y-this.anchor.y)>3){this.actor=user.id;this.progress=b.planted?(b.defuseCheckpoint||0):0;this.anchor={x:user.x,y:user.y};}
    this.progress+=dt;
    if(b.planted&&this.progress>=3.5)b.defuseCheckpoint=3.5;
    if(this.progress>=(b.planted?7:4)){
     if(b.planted){this.finish(this.team(user),'스파이크 해체 · 수비 승리');return;}
     for(const p of players)if(this.team(p)===this.attackTeam)credit(p,300);
     b.planted=true;b.carrier=null;b.x=user.x;b.y=user.y;b.site=SITES.find(s=>Math.hypot(user.x-s.x,user.y-s.y)<s.r).name;b.timer=45;this.phase='planted';this.time=45;this.actor=null;this.progress=0;
    }
   }else{this.actor=null;this.progress=b.planted?(b.defuseCheckpoint||0):0;this.anchor=null;}
   const attackers=players.filter(p=>alive(p)&&this.team(p)===this.attackTeam),defenders=players.filter(p=>alive(p)&&this.team(p)!==this.attackTeam);
   if(b.planted){b.timer=this.time;if(this.time<=0)this.finish(this.attackTeam,'스파이크 폭발 · 공격 승리');else if(!defenders.length)this.finish(this.attackTeam,'수비팀 전멸 · 공격 승리');}
   else if(!attackers.length)this.finish(3-this.attackTeam,'공격팀 전멸 · 수비 승리');
   else if(!defenders.length)this.finish(this.attackTeam,'수비팀 전멸 · 공격 승리');
   else if(this.time<=0)this.finish(3-this.attackTeam,'시간 초과 · 수비 승리');
  }
  snapshot(viewer){const visible=!viewer||this.bomb.planted||viewer.teamId===`team_${this.attackTeam}`;return {round:this.round,phase:this.phase,time:this.time,score:this.score,attackTeam:this.attackTeam,result:this.result,winnerTeam:this.winnerTeam,targetScore:13,bomb:visible?{...this.bomb}:{planted:false,hidden:true},progress:visible?this.progress:0,actor:visible?this.actor:null,spawns:this.spawns,actors:this.actors().map(p=>({id:p.id,teamId:p.teamId,hp:p.hp,isDead:p.isDead,kills:p.kills||0,deaths:p.deaths||0,weapon:p.weapon,clipAmmo:p.clipAmmo,reserveAmmo:p.reserveAmmo,maxHp:p.maxHp,credits:p.credits,shield:p.shield,shieldType:p.shieldType,shieldPool:p.shieldPool,activeSlot:p.activeSlot,loadout:copy(p.loadout),purchases:copy(p.purchases)}))};}
 }
 root.SpikeRules={mobileMove,weaponSpeed,movingSpread,equip,shieldDamage,bulletDamage,Match,SIZE,UNITS_PER_METER,MOVE_MPS,QUIET_MPS,movementDistance,SPAWNS,SPAWN_ANCHORS,PREP_AREAS,PREP_BARRIERS,prepContains,constrainPrep,SITES,WALLS,FLOORS,COVERS,CALLOUTS,MAP_NAME,inside};
})(globalThis);
