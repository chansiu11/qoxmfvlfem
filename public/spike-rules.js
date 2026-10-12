/* Shared objective rules; no DOM, timers or transport dependencies. */
(function(root){
 const SIZE=2400;
 const SPAWNS=[{x:70,y:850,w:260,h:700},{x:2070,y:850,w:260,h:700}];
 const SITES=[{name:'A',x:1400,y:600,r:130},{name:'B',x:1400,y:1800,r:130}];
 // A fixed connected maze: at most two onward choices, with dead ends.
 const LINKS=[],WALLS=[];
 const parent=Array.from({length:36},(_,i)=>i),degree=Array(36).fill(0);
 const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 const join=(a,b)=>{if(find(a)===find(b)||degree[a]>=3||degree[b]>=3)return;parent[find(a)]=find(b);degree[a]++;degree[b]++;LINKS.push([a,b]);};
 join(12,18);join(17,23); // Keep both spawn rooms unobstructed.
 let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const edges=[];
 for(let y=0;y<6;y++)for(let x=0;x<6;x++){const n=y*6+x;if(x<5)edges.push([n,n+1,random()]);if(y<5)edges.push([n,n+6,random()]);}
 edges.sort((a,b)=>a[2]-b[2]);for(const [a,b] of edges)join(a,b);
 const wall=(x,y,w,h)=>WALLS.push({type:'wall',x,y,w,h});
 wall(0,0,SIZE,40);wall(0,SIZE-40,SIZE,40);wall(0,0,40,SIZE);wall(SIZE-40,0,40,SIZE);
 for(let y=0;y<6;y++)for(let x=0;x<6;x++){
  const n=y*6+x,open=m=>LINKS.some(([a,b])=>a===n&&b===m||b===n&&a===m);
  if(x<5){const xx=(x+1)*400-30;if(open(n+1)){wall(xx,y*400,60,80);wall(xx,y*400+320,60,80);}else wall(xx,y*400,60,400);}
  if(y<5){const yy=(y+1)*400-30;if(open(n+6)){if(n!==12&&n!==17){wall(x*400,yy,80,60);wall(x*400+320,yy,80,60);}}else wall(x*400,yy,400,60);}
 }
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
    p.x=r.x+60+(Math.floor(i/8)%3)*60;p.y=r.y+65+(i%8)*78;
    p.hp=200;p.maxHp=200;p.isDead=false;p.isDowned=false;p.isMoving=false;p.isShooting=false;p._spikeUse=false;p.isReloading=false;
    p.weapon=['ar','sniper','shotgun'].includes(p.weapon)?p.weapon:'ar';
    p.clipAmmo={ar:30,sniper:5,shotgun:8}[p.weapon];p.reserveAmmo=p.clipAmmo*4;p.equippedBodyArmor=null;p.equippedHelmet=null;
    this.spawns[p.id]={x:p.x,y:p.y};
   }
   const attackers=this.actors().filter(p=>alive(p)&&this.team(p)===this.attackTeam);
   const carrier=attackers.find(p=>!p.id.startsWith('bot_'))||attackers[0];
   this.bomb={carrier:carrier?.id||null,x:carrier?.x||250,y:carrier?.y||1200,planted:false,site:null,timer:45};
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
    if(this.actor!==user.id||!this.anchor||Math.hypot(user.x-this.anchor.x,user.y-this.anchor.y)>3){this.actor=user.id;this.progress=0;this.anchor={x:user.x,y:user.y};}
    this.progress+=dt;
    if(this.progress>=(b.planted?7:4)){
     if(b.planted){this.finish(this.team(user),'스파이크 해체 · 수비 승리');return;}
     b.planted=true;b.carrier=null;b.x=user.x;b.y=user.y;b.site=SITES.find(s=>Math.hypot(user.x-s.x,user.y-s.y)<s.r).name;b.timer=45;this.phase='planted';this.time=45;this.actor=null;this.progress=0;
    }
   }else{this.actor=null;this.progress=0;this.anchor=null;}
   const attackers=players.filter(p=>alive(p)&&this.team(p)===this.attackTeam),defenders=players.filter(p=>alive(p)&&this.team(p)!==this.attackTeam);
   if(b.planted){b.timer=this.time;if(this.time<=0)this.finish(this.attackTeam,'스파이크 폭발 · 공격 승리');else if(!defenders.length)this.finish(this.attackTeam,'수비팀 전멸 · 공격 승리');}
   else if(!attackers.length)this.finish(3-this.attackTeam,'공격팀 전멸 · 수비 승리');
   else if(!defenders.length)this.finish(this.attackTeam,'수비팀 전멸 · 공격 승리');
   else if(this.time<=0)this.finish(3-this.attackTeam,'시간 초과 · 수비 승리');
  }
  snapshot(viewer){const visible=!viewer||this.bomb.planted||viewer.teamId===`team_${this.attackTeam}`;return {round:this.round,phase:this.phase,time:this.time,score:this.score,attackTeam:this.attackTeam,result:this.result,bomb:visible?{...this.bomb}:{planted:false,hidden:true},progress:visible?this.progress:0,actor:visible?this.actor:null,spawns:this.spawns,actors:this.actors().map(p=>({id:p.id,teamId:p.teamId,hp:p.hp,isDead:p.isDead,kills:p.kills||0,deaths:p.deaths||0,weapon:p.weapon,clipAmmo:p.clipAmmo,reserveAmmo:p.reserveAmmo}))};}
 }
 root.SpikeRules={Match,SIZE,SPAWNS,SITES,WALLS,LINKS,inside};
})(globalThis);
