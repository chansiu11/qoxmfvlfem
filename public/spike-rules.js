/* Shared objective rules; no DOM, timers or transport dependencies. */
(function(root){
 const SIZE=2400;
 // Hand-built 2D adaptation of Riot's official Ascent overhead layout.
 // Reference: https://playvalorant.com/en-gb/maps/#ascent
 // Coordinates below use the 640px reference; runtime geometry is 2400 units.
 const SCALE=SIZE/640;
 const rect=([x,y,w,h])=>({x:x*SCALE,y:y*SCALE,w:w*SCALE,h:h*SCALE});
 const MAP_NAME='어센트 · ASCENT';
 const SPAWNS=[[344,116,80,64],[260,528,64,56]].map(rect);
 const SITES=[{name:'A',x:128*SCALE,y:424*SCALE,r:32*SCALE},{name:'B',x:496*SCALE,y:440*SCALE,r:34*SCALE}];
 const FLOORS=[
  // Attacker spawn and the split toward A lobby / B lobby.
  [336,48,60,64],[336,108,96,84],[212,136,220,44],[220,176,24,48],
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
  [256,500,76,88],[248,508,188,24],[412,456,24,60],[272,472,60,40],[308,448,24,36]
 ].map(rect);
 const COVERS=[
  [108,408,12,12],[144,416,8,24], // A generator / default cover
  [280,316,16,12],[332,348,12,12], // Mid courtyard angles
  [468,420,12,12],[488,452,20,12],[520,476,12,12], // B default / logs
  [440,264,12,12],[248,148,12,12] // Lobby / spawn cover outside buy zones
 ].map(r=>({...rect(r),type:'wall',cover:true}));
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
 const alive=p=>p&&p.hp>0&&!p.isDead&&!p.spectator;
 const inside=(p,r)=>p.x>=r.x+20&&p.x<=r.x+r.w-20&&p.y>=r.y+20&&p.y<=r.y+r.h-20;
 class Match{
  constructor(actors){this.actors=actors;this.round=0;this.score=[0,0];this.phase='prep';this.time=0;this.result='';this.progress=0;this.actor=null;this.begin();}
  team(p){return p.teamId==='team_2'?2:1;}
  spawn(p){return SPAWNS[this.team(p)===this.attackTeam?0:1];}
  begin(){
   this.round++;this.attackTeam=this.round%2?1:2;this.phase='prep';this.time=15;this.result='';this.actor=null;this.progress=0;this.anchor=null;
   const indexes=[0,0];this.spawns={};
   for(const p of this.actors()){
    if(p.spectator)continue;const team=this.team(p),r=this.spawn(p),i=indexes[team-1]++;
    const cols=Math.max(1,Math.floor((r.w-40)/55)),rows=Math.max(1,Math.floor((r.h-40)/55));
    p.x=r.x+35+(i%cols)*55;p.y=r.y+35+(Math.floor(i/cols)%rows)*55;
    p.hp=200;p.maxHp=200;p.isDead=false;p.isDowned=false;p.isMoving=false;p.isShooting=false;p._spikeUse=false;p.isReloading=false;
    p.weapon=['ar','sniper','shotgun'].includes(p.weapon)?p.weapon:'ar';
    p.clipAmmo={ar:30,sniper:5,shotgun:8}[p.weapon];p.reserveAmmo=p.clipAmmo*4;p.equippedBodyArmor=null;p.equippedHelmet=null;
    this.spawns[p.id]={x:p.x,y:p.y};
   }
   const attackers=this.actors().filter(p=>alive(p)&&this.team(p)===this.attackTeam);
   const carrier=attackers.find(p=>!p.id.startsWith('bot_'))||attackers[0];
   this.bomb={carrier:carrier?.id||null,x:carrier?.x||250,y:carrier?.y||1200,planted:false,site:null,timer:45,defuseCheckpoint:0};
  }
  choose(p,weapon){if(this.phase!=='prep'||!alive(p)||!inside(p,this.spawn(p))||!['ar','sniper','shotgun'].includes(weapon))return false;p.weapon=weapon;p.clipAmmo={ar:30,sniper:5,shotgun:8}[weapon];p.reserveAmmo=p.clipAmmo*4;p.isReloading=false;return true;}
  finish(team,reason){if(!['live','planted'].includes(this.phase))return;this.score[team-1]++;this.phase='end';this.time=6;this.result=reason;this.progress=0;this.actor=null;for(const p of this.actors()){p.isShooting=false;p._spikeUse=false;}}
  tick(dt){
   dt=Math.max(0,Math.min(.1,dt));this.time-=dt;
   if(this.phase==='end'){if(this.time<=0)this.begin();return;}
   if(this.phase==='prep'){
    for(const p of this.actors())if(alive(p)){const r=this.spawn(p);p.x=Math.max(r.x+20,Math.min(r.x+r.w-20,p.x));p.y=Math.max(r.y+20,Math.min(r.y+r.h-20,p.y));p.isShooting=false;}
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
     b.planted=true;b.carrier=null;b.x=user.x;b.y=user.y;b.site=SITES.find(s=>Math.hypot(user.x-s.x,user.y-s.y)<s.r).name;b.timer=45;this.phase='planted';this.time=45;this.actor=null;this.progress=0;
    }
   }else{this.actor=null;this.progress=b.planted?(b.defuseCheckpoint||0):0;this.anchor=null;}
   const attackers=players.filter(p=>alive(p)&&this.team(p)===this.attackTeam),defenders=players.filter(p=>alive(p)&&this.team(p)!==this.attackTeam);
   if(b.planted){b.timer=this.time;if(this.time<=0)this.finish(this.attackTeam,'스파이크 폭발 · 공격 승리');else if(!defenders.length)this.finish(this.attackTeam,'수비팀 전멸 · 공격 승리');}
   else if(!attackers.length)this.finish(3-this.attackTeam,'공격팀 전멸 · 수비 승리');
   else if(!defenders.length)this.finish(this.attackTeam,'수비팀 전멸 · 공격 승리');
   else if(this.time<=0)this.finish(3-this.attackTeam,'시간 초과 · 수비 승리');
  }
  snapshot(viewer){const visible=!viewer||this.bomb.planted||viewer.teamId===`team_${this.attackTeam}`;return {round:this.round,phase:this.phase,time:this.time,score:this.score,attackTeam:this.attackTeam,result:this.result,bomb:visible?{...this.bomb}:{planted:false,hidden:true},progress:visible?this.progress:0,actor:visible?this.actor:null,spawns:this.spawns,actors:this.actors().map(p=>({id:p.id,teamId:p.teamId,hp:p.hp,isDead:p.isDead,kills:p.kills||0,deaths:p.deaths||0,weapon:p.weapon,clipAmmo:p.clipAmmo,reserveAmmo:p.reserveAmmo}))};}
 }
 root.SpikeRules={Match,SIZE,SPAWNS,SITES,WALLS,FLOORS,COVERS,CALLOUTS,MAP_NAME,inside};
})(globalThis);
