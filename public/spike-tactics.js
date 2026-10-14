/* General-mode team tactics and human-style movement; observations, not enemy world state, drive decisions. */
(function(root){
 const live=p=>p.hp>0&&!p.isDead;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function quietApproach(phase,time,nearSite,nearThreat,combat=false){return !combat&&['live','planted'].includes(phase)&&time>(phase==='planted'?14:22)&&(nearSite||nearThreat);}
 // Stable tendencies per identity; decisions vary by situation rather than frame jitter.
 function profile(id){let seed=2166136261;for(const c of String(id)){seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;}
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  return {role:['entry','support','flank','anchor'][Math.floor(next()*4)],tempo:.88+next()*.12,
   preferredRange:.8+next()*.4,reaction:.8+next()*.45,cycle:850+next()*650,step:120+next()*130,settle:75+next()*100,
   caution:22+next()*24,closeRange:100+next()*100,spacing:60+next()*110,angle:next()*Math.PI*2,
   startDelay:next()*.8,hold:2200+next()*3000,quietRange:600+next()*450,peekSide:next()<.5?-1:1};
 }
 const traits=bot=>bot._tacticPersonality||(bot._tacticPersonality=profile(bot.id));
 function splitRole(bot,index,style,carrier){if(carrier===bot.id)return false;const p=traits(bot);return style==='split'?p.role==='flank'||index%2===1:style==='default'&&p.role==='flank';}
 class Planner{
  constructor(round,attackTeam){this.round=round;this.attackTeam=attackTeam;this.site=(round-1)%2;this.style=['group','split','default'][(round-1)%3];this.started=0;this.changed=0;this.contacts=new Map();}
  report(team,enemy,now){this.contacts.set(team+':'+enemy.id,{team,id:enemy.id,x:enemy.x,y:enemy.y,time:now});}
  known(team,now){return [...this.contacts.values()].filter(c=>c.team===team&&now-c.time<4500);}
  decide(now,remaining,sites){if(!this.started)this.started=now;for(const [key,c] of this.contacts)if(now-c.time>4500)this.contacts.delete(key);
   if(remaining>24&&now-this.started>12000&&now-this.changed>10000){const seen=this.known(this.attackTeam,now),counts=sites.map(s=>seen.filter(c=>distance(c,s)<650).length);if(counts[this.site]>=2&&counts[1-this.site]<counts[this.site]){this.site=1-this.site;this.style='rotate';this.changed=now;}}
   if(remaining<28)this.style='group';return {site:this.site,style:this.style};
  }
 }
 let planner=null;
 const call=name=>SpikeRules.CALLOUTS.find(c=>c.name===name);
 const aliveActors=()=>spikeActors().filter(live);
 const teamNumber=p=>p.teamId==='team_2'?2:1;
 const stop=(bot,brain)=>{bot.isMoving=false;bot.moveSpeed=0;brain.movementRequested=false;};
 const traffic=new Map();let trafficClock=0;
 function routeCost(bot,point){const crowd=bot._navCrowd||aliveActors().filter(p=>p.id!==bot.id&&teamNumber(p)===teamNumber(bot));let cost=0;
  for(const p of crowd){const d=distance(p,point);if(d<85)cost+=(85-d)*.13;}
  const key=teamNumber(bot)+':'+Math.floor(point.x/80)+':'+Math.floor(point.y/80),entry=traffic.get(key);
  if(entry&&entry.id!==bot.id&&entry.age>trafficClock-5)cost+=Math.min(5,entry.count*.6);
  return Math.min(22,cost);
 }
 function nearestGoal(bot,goal){if(!checkBotNavigationCollision(goal.x,goal.y,20))return goal;
  const candidates=[];for(const r of [30,60,100])for(let i=0;i<12;i++){const a=i*Math.PI/6,p={x:goal.x+Math.cos(a)*r,y:goal.y+Math.sin(a)*r};if(!checkBotNavigationCollision(p.x,p.y,20))candidates.push(p);}
  return candidates.sort((a,b)=>distance(a,goal)+distance(a,bot)*.05-distance(b,goal)-distance(b,bot)*.05)[0]||null;
 }
 function move(bot,brain,goal,quiet=false){if(!goal)return;
  const dt=Math.max(.001,spikeFrameDt),clock=bot._navClock=(bot._navClock||0)+dt,original={x:bot.x,y:bot.y};
  bot._navCrowd=aliveActors().filter(p=>p.id!==bot.id&&teamNumber(p)===teamNumber(bot));
  const target=nearestGoal(bot,goal);if(!target){stop(bot,brain);return;}
  const state=bot._navigation||(bot._navigation={goal:null,path:[],replan:0,blocked:0,lastTurn:bot.moveAngle||bot.angle||0});
  if(!state.goal||distance(state.goal,target)>65){state.goal={...target};state.path=[];state.replan=0;state.blocked=0;}
  if(distance(bot,target)<20){stop(bot,brain);state.blocked=0;return;}
  const direct=botSegmentClear(bot,target);
  if(!direct&&(!state.path.length||!botSegmentClear(bot,state.path[0]))&&clock>=state.replan){
   spikeNavActor=bot;try{state.path=planBotRoute(bot,target)||[];}finally{spikeNavActor=null;}
   state.replan=clock+.65;
  }
  while(state.path.length&&distance(bot,state.path[0])<18)state.path.shift();
  if(state.path.length)for(let i=Math.min(5,state.path.length-1);i>0;i--)if(botSegmentClear(bot,state.path[i])){state.path.splice(0,i);break;}
  let next=direct?target:state.path[0];
  if(!next){state.blocked+=dt;brain.state='route_reconsider';stop(bot,brain);if(state.blocked>.8){bot._tacticRoute=null;state.replan=0;}if(state.blocked>1.5&&clock>(bot._laneSwapAt||0)){bot._requestLaneSwap=true;bot._laneSwapAt=clock+8;state.blocked=0;}return;}
  let angle=Math.atan2(next.y-bot.y,next.x-bot.x),rx=0,ry=0;
  // Personal space affects only local steering. Teammates are not solid walls.
  for(const ally of aliveActors()){if(ally.id===bot.id||teamNumber(ally)!==teamNumber(bot))continue;const d=distance(bot,ally);if(d<75){const a=d>1?Math.atan2(bot.y-ally.y,bot.x-ally.x):traits(bot).angle;const weight=(75-d)/75;rx+=Math.cos(a)*weight;ry+=Math.sin(a)*weight;}}
  const preferred=Math.atan2(Math.sin(angle)+ry*.8,Math.cos(angle)+rx*.8);
  const budget=SpikeRules.movementDistance(dt,quiet,bot.weapon)*traits(bot).tempo;
  let chosen=null,best=Infinity;
  for(const offset of [0,.3,-.3,.6,-.6,1,-1]){const a=preferred+offset,p={x:bot.x+Math.cos(a)*Math.max(budget,12),y:bot.y+Math.sin(a)*Math.max(budget,12)};if(!botSegmentClear(bot,p)||checkBotNavigationCollision(p.x,p.y,18))continue;
   const score=distance(p,next)+Math.abs(botAngleDelta(a,state.lastTurn))*3+Math.abs(botAngleDelta(a,preferred))*12+routeCost(bot,p)*.8;if(score<best){best=score;chosen=a;}}
  brain.movementRequested=true;bot.movementMode=quiet?'stealth':'walk';
  if(chosen!==null){const length=Math.min(budget,distance(bot,next)),n=Math.max(1,Math.ceil(length/2));for(let i=0;i<n;i++){const x=bot.x+Math.cos(chosen)*length/n,y=bot.y+Math.sin(chosen)*length/n;if(checkBotNavigationCollision(x,y,15))break;bot.x=x;bot.y=y;}state.lastTurn=chosen;}
  const moved=distance(bot,original);bot.isMoving=moved>.01;bot.moveSpeed=moved/dt/40;if(bot.isMoving)bot.moveAngle=Math.atan2(bot.y-original.y,bot.x-original.x);
  // Use elapsed simulation time, and keep the chosen escape stable instead of zigzagging every frame.
  const progress=distance(original,next)-distance(bot,next);
  state.blocked=progress>.05?Math.max(0,state.blocked-dt*2):state.blocked+dt;
  if(state.blocked>.65){state.path=[];state.replan=0;bot._route=null;if(state.blocked>1.5){bot._tacticRoute=null;state.goal=null;state.blocked=0;}}
  const key=teamNumber(bot)+':'+Math.floor(bot.x/80)+':'+Math.floor(bot.y/80);if(bot._trafficCell!==key){const prior=traffic.get(key);traffic.set(key,{id:bot.id,age:trafficClock,count:(prior?.count||0)+1});bot._trafficCell=key;if(traffic.size>800)traffic.delete(traffic.keys().next().value);}
 }
 function safePosition(bot,point,offset=0){const p=traits(bot),angle=p.angle+offset;
  const candidates=[1,.55,-.55].map(f=>({x:point.x+Math.cos(angle)*p.spacing*f,y:point.y+Math.sin(angle)*p.spacing*f}));candidates.push(point);
  return candidates.find(candidate=>!checkBotNavigationCollision(candidate.x,candidate.y,18)&&botSegmentClear(point,candidate))||point;
 }
 function route(bot,brain,points,key,quiet){
  if(bot._tacticRoute?.key!==key)bot._tacticRoute={key,index:0,points:points.filter(Boolean).map((p,i,all)=>i===all.length-1&&bot.id===spikeMatch.bomb.carrier?p:safePosition(bot,p,i*.8))};
  const path=bot._tacticRoute.points,state=bot._tacticRoute;
  if(state.index===0){let closest=0;for(let i=1;i<path.length;i++)if(distance(bot,path[i])+100<distance(bot,path[closest]))closest=i;state.index=closest;}
  while(state.index<path.length-1&&distance(bot,path[state.index])<70)state.index++;
  const goal=path[Math.min(state.index,path.length-1)];
  if(goal&&distance(bot,goal)>35)move(bot,brain,goal,quiet);return goal;
 }
 function watch(bot,brain,point,dt){if(point)turnBotAim(bot,brain,Math.atan2(point.y-bot.y,point.x-bot.x),dt);}
 // Reserve tactical lanes, not just slightly different points around the same site centre.
 function angleOptions(site){const k=SpikeRules.SIZE/640,point=(x,y)=>({x:x*k,y:y*k});
  const rows=site==='A'?[
   ['main',115,365,152,326],['tree',175,380,203,380],['catwalk',232,371,237,304],
   ['garden',202,450,207,422],['rafters',149,469,116,468]
  ]:site==='B'?[
   ['main',459,419,427,379],['market',405,437,350,442],['lane',513,445,480,399],
   ['boathouse',548,449,550,465],['link',467,407,377,310]
  ]:[['mid',318,380,312,342],['market',351,439,377,310],['pizza',318,420,304,388]];
  return rows.map(([id,x,y,tx,ty])=>({id,position:point(x,y),target:point(tx,ty)}));
 }
 function assignAngle(bot,key,options,friends){
  const used=new Set(friends.filter(p=>p.id!==bot.id&&live(p)&&p._angleHold?.key===key).map(p=>p._angleHold.id));
  const valid=options.filter(p=>!oldBotCollision(p.position.x,p.position.y,18));
  const old=bot._angleHold;
  const humanCost=slot=>friends.filter(p=>!p.id.startsWith('bot_')&&p.id!==bot.id&&live(p)&&distance(p,slot.position)<650).reduce((n,p)=>n+(Math.abs(botAngleDelta(Math.atan2(slot.target.y-p.y,slot.target.x-p.x),p.angle||0))<.22?1500:0),0);
  if(old?.key===key&&!used.has(old.id)&&valid.some(p=>p.id===old.id)&&humanCost(old)===0)return old;
  const free=valid.filter(p=>!used.has(p.id));
  const selected=(free.length?free:valid).sort((a,b)=>humanCost(a)-humanCost(b)+distance(bot,a.position)*.1-distance(bot,b.position)*.1)[0];
  if(!selected)return null;
  const rank=friends.filter(p=>p.id.startsWith('bot_')).sort((a,b)=>a.id.localeCompare(b.id)).findIndex(p=>p.id===bot.id);
  // With more players than entrances, use a separate crossfire position along that lane.
  const slot=free.length?selected:{...selected,id:selected.id+':cross:'+rank,position:safePosition(bot,selected.position,rank*.7)};
  bot._angleHold={...slot,key};return bot._angleHold;
 }
 function holdAngle(bot,key,site,friends){return assignAngle(bot,key,angleOptions(site),friends);}
 function combat(bot,brain,enemy,now,dt){
  const diff=AI_DIFFICULTY[aiDifficulty]||AI_DIFFICULTY.easy,p=traits(bot);
  if(brain.targetId!==enemy.id||now-brain.lastSeenAt>900){brain.targetId=enemy.id;brain.reactionUntil=now+Math.max(180,Math.min(650,diff.delay*.5*p.reaction)) + Math.random()*140;brain.burstLeft=0;brain.burstPauseUntil=0;bot._duelStart=now;}
  brain.lastSeenAt=now;brain.lastKnown={x:enemy.x,y:enemy.y};brain.enemyVx=0;brain.enemyVy=0;
  const w=WEAPONS[bot.weapon];if(!w)return;
  const hurt=bot.hp<brain.lastHp;brain.lastHp=bot.hp;
  if(bot.isReloading||bot.clipAmmo<=0||bot.hp<p.caution||hurt){
   if(bot.clipAmmo<=0&&bot.reserveAmmo>0&&!bot.isReloading)reloadWeapon(bot);
   if(now>(bot._coverSearchAt||0)){bot._duelCover=findBotCoverPoint(bot,enemy);bot._coverSearchAt=now+1200;}
   if(bot._duelCover&&distance(bot,bot._duelCover)>22){brain.state='tactical_disengage';move(bot,brain,bot._duelCover);watch(bot,brain,enemy,dt);return;}
  }
  const engagementAge=now-(bot._duelStart||now),range=getBotWeaponRange(bot);
  if(engagementAge>900&&!bot.isReloading&&p.role==='entry'&&distance(bot,enemy)>range.ideal*p.preferredRange*1.35){brain.state='pressure_entry';move(bot,brain,enemy);watch(bot,brain,enemy,dt);return;}
  // A short lateral step, then a deliberate stop before a controlled burst.
  const age=now-(bot._duelStart||now),cycle=age%p.cycle,close=distance(bot,enemy)<p.closeRange;
  if(age>650&&cycle<p.step&&!close&&!bot.isReloading){
   brain.state='tactical_reposition';const side=(Math.floor(age/p.cycle)%2?1:-1)*p.peekSide;const a=Math.atan2(enemy.y-bot.y,enemy.x-bot.x)+side*Math.PI/2;
   const x=bot.x,y=bot.y;move(bot,brain,{x:bot.x+Math.cos(a)*60,y:bot.y+Math.sin(a)*60});watch(bot,brain,enemy,dt);return;
  }
  stop(bot,brain);brain.state='tactical_burst';
  if(cycle<p.step+p.settle&&age>650)brain.reactionUntil=Math.max(brain.reactionUntil,now+p.settle);
  if(brain.burstLeft<=0&&now>=brain.burstPauseUntil)brain.burstLeft=w.category==='Rifle'||w.category==='SMG'?2+Math.floor(Math.random()*2):1;
  updateHumanBotAim(bot,brain,enemy,{...diff,spread:Math.min(.22,diff.spread)},now,dt);
 }
 function tick(){
  if(!isHost||!spikeMatch||!['prep','live','planted'].includes(spikeState?.phase))return;
  const now=Date.now(),dt=Math.max(.001,spikeFrameDt),actors=aliveActors(),bomb=spikeMatch.bomb;
  if(!planner||planner.round!==spikeMatch.round){planner=new Planner(spikeMatch.round,spikeMatch.attackTeam);traffic.clear();trafficClock=0;for(const bot of aiBots){bot._angleHold=null;bot._tacticRoute=null;bot._navigation=null;bot._requestLaneSwap=false;bot._laneSwapAt=0;bot._trafficCell=null;bot._retakeWaitAt=0;bot._duelStart=0;bot._duelCover=null;const brain=ensureBotBrain(bot);brain.observed=null;brain.scanAt=0;brain.targetId=null;brain.lastSeenAt=0;brain.burstLeft=0;brain.burstPauseUntil=0;bot.investigateTarget=null;}}
  trafficClock+=dt;
  for(const bot of aiBots){if(bot._tacticPhase!==spikeState.phase){bot._tacticPhase=spikeState.phase;bot._phaseAge=0;}bot._phaseAge=(bot._phaseAge||0)+dt;}
  if(spikeState.phase==='prep'){
   planner.started=0;
   const carrier=actors.find(p=>p.id===bomb.carrier),human=carrier&&!carrier.id.startsWith('bot_');
   const chosen=human?SpikeRules.SITES.reduce((a,b)=>distance(carrier,a)<distance(carrier,b)?a:b):SpikeRules.SITES[planner.site];
   const siteIndex=SpikeRules.SITES.indexOf(chosen);
   for(const bot of aiBots){if(!live(bot))continue;const brain=ensureBotBrain(bot),team=teamNumber(bot),attack=team===planner.attackTeam;
    const friends=actors.filter(p=>teamNumber(p)===team).sort((a,b)=>a.id.localeCompare(b.id)),index=friends.findIndex(p=>p.id===bot.id);
    const split=splitRole(bot,index,planner.style,bomb.carrier);
    const base=attack?SpikeRules.PREP_STAGING.attack[split?2:siteIndex]:SpikeRules.PREP_STAGING.defense[index%3===2?2:index%2];
    const p=traits(bot),angle=p.angle+index*.8;const candidates=[{x:base.x+Math.cos(angle)*42,y:base.y+Math.sin(angle)*42},{x:base.x-Math.cos(angle)*24,y:base.y-Math.sin(angle)*24},{x:base.x+(index%3-1)*35,y:base.y+Math.floor(index/3)*35},base];
    const goal=candidates.find(p=>SpikeRules.prepContains(p,attack?0:1)&&!oldBotCollision(p.x,p.y,18))||base;
    bot._prepGoal=goal;bot._spikeUse=false;bot.isShooting=false;stop(bot,brain);brain.state=attack?(split?'prep_split':'prep_entry'):'prep_hold';
    if(distance(bot,goal)>25&&bot._phaseAge>traits(bot).startDelay){spikePrepActor=bot;try{move(bot,brain,goal);}finally{spikePrepActor=null;}}
    const prepAngles=angleOptions(attack?chosen.name:index%3===2?'MID':index%2?'B':'A');
    const prepAngle=assignAngle(bot,'prep:'+team+':'+(attack?chosen.name:index%3===2?'MID':index%2?'B':'A'),prepAngles.map(p=>({...p,position:goal})),friends);watch(bot,brain,prepAngle?.target||(attack?chosen:call(index%2?'B MAIN':'A MAIN')),dt);
   }
   return;
  }
  // Vision uses the existing field of view and wall test. Shared reports retain last seen positions only.
  const observed=new Map();
  for(const bot of aiBots){if(!live(bot))continue;const brain=ensureBotBrain(bot);bot._spikeUse=false;bot.isShooting=false;const enemy=chooseBotEnemy(bot,brain);if(enemy){observed.set(bot.id,enemy);planner.report(teamNumber(bot),enemy,now);}}
  const plan=planner.decide(now,spikeState.time,SpikeRules.SITES),site=SpikeRules.SITES[plan.site];
  const defenders=actors.filter(p=>teamNumber(p)!==planner.attackTeam);
  const humanDefusing=defenders.some(p=>!p.id.startsWith('bot_')&&p._spikeUse&&distance(p,bomb)<85);
  const defuser=!humanDefusing&&bomb.planted?defenders.filter(p=>p.id.startsWith('bot_')).sort((a,b)=>distance(a,bomb)-distance(b,bomb)||a.id.localeCompare(b.id))[0]:null;
  for(const bot of aiBots){if(!live(bot))continue;const brain=ensureBotBrain(bot),team=teamNumber(bot),attack=team===planner.attackTeam;
   brain.movementRequested=false;stop(bot,brain);bot._spikeMoveBudget=SpikeRules.movementDistance(dt,false,bot.weapon);
   const enemy=observed.get(bot.id),friends=actors.filter(p=>teamNumber(p)===team).sort((a,b)=>a.id.localeCompare(b.id)),index=friends.findIndex(p=>p.id===bot.id);
   if(enemy){combat(bot,brain,enemy,now,dt);continue;}
   if(bot.clipAmmo<=0&&bot.reserveAmmo>0&&!bot.isReloading)reloadWeapon(bot);
   let goal=null;const known=planner.known(team,now),recent=known.sort((a,b)=>b.time-a.time)[0];
   const tradeBuddy=friends.find(p=>p.id!==bot.id&&observed.has(p.id)&&distance(bot,p)<420);
   if(tradeBuddy&&recent&&now-recent.time<1000&&bomb.carrier!==bot.id&&!bomb.planted){brain.state='trade_support';move(bot,brain,safePosition(bot,tradeBuddy,index*2.4));watch(bot,brain,recent,dt);continue;}
   if(bomb.planted){
    if(attack){brain.state='postplant_hold';const angle=holdAngle(bot,'postplant:'+team+':'+bomb.site,bomb.site,friends);goal=angle?.position||safePosition(bot,bomb,index*2.4);if(distance(bot,goal)>45)move(bot,brain,goal,quietApproach('planted',spikeState.time,true,false));watch(bot,brain,angle?.target||call(bomb.site==='A'?'TREE':'MARKET'),dt);}
    else {
     const closeFriends=friends.filter(p=>distance(p,bomb)<600).length;
     if(bot===defuser&&distance(bot,bomb)<70){brain.state='defuse';bot._spikeUse=true;stop(bot,brain);}
     else{brain.state=bot===defuser?'retake_entry':'retake_support';const angle=bot!==defuser?holdAngle(bot,'retake:'+team+':'+bomb.site,bomb.site,friends):null;goal=bot===defuser?bomb:angle?.position||safePosition(bot,bomb,index*2.4);
      // Wait briefly for a teammate at the entrance, but never waste the last defuse window.
      const wait=distance(bot,bomb)<450&&distance(bot,bomb)>160&&closeFriends<Math.min(2,friends.length)&&spikeState.time>13;
      if(wait&&!bot._retakeWaitAt)bot._retakeWaitAt=now;
      if(!wait||now-(bot._retakeWaitAt||now)>1800)move(bot,brain,goal,quietApproach('planted',spikeState.time,distance(bot,bomb)<650,!!recent));watch(bot,brain,angle?.target||recent||bomb,dt);
     }
    }
   }else if(attack){
    if(!bomb.carrier){brain.state='recover_spike';goal=bomb;move(bot,brain,goal);watch(bot,brain,recent||goal,dt);}
    else if(bomb.carrier===bot.id&&SpikeRules.SITES.some(s=>distance(bot,s)<s.r-25)){brain.state='plant';bot._spikeUse=true;stop(bot,brain);}
    else{
     const carrier=actors.find(p=>p.id===bomb.carrier),humanCarrier=carrier&&!carrier.id.startsWith('bot_');
     const chosen=humanCarrier?SpikeRules.SITES.reduce((a,b)=>distance(carrier,a)<distance(carrier,b)?a:b):site;
     const siteIndex=SpikeRules.SITES.indexOf(chosen);
     const choiceKey=spikeMatch.round+':'+siteIndex+':'+plan.style;
     if(bot._laneChoice?.key!==choiceKey||bot._requestLaneSwap||bot._navigation?.blocked>.8&&(bot._tacticRoute?.index||0)<=1){const main=call(siteIndex?'B MAIN':'A MAIN'),middle=call(siteIndex?'MARKET':'TREE');
      const preferred=splitRole(bot,index,plan.style,bomb.carrier),mainBusy=friends.filter(p=>p.id!==bot.id&&distance(p,main)<450).length,midBusy=friends.filter(p=>p.id!==bot.id&&distance(p,middle)<450).length;
      const alternate=bot._requestLaneSwap?!bot._laneChoice?.split:bomb.carrier!==bot.id&&(preferred||mainBusy>=2&&midBusy<mainBusy);bot._laneChoice={key:choiceKey,split:alternate};bot._requestLaneSwap=false;
     }
     const split=bot._laneChoice.split;
     const points=siteIndex===0?(split?[call('MID TOP'),call('CATWALK'),call('TREE'),chosen]:[call('A LOBBY'),call('A MAIN'),chosen]):(split?[call('MID TOP'),call('MID'),call('MARKET'),chosen]:[call('B LOBBY'),call('B MAIN'),chosen]);
     brain.state=plan.style==='rotate'?'site_rotation':split?'split_entry':plan.style==='default'?'default_control':'group_entry';
     const point=points.filter(Boolean)[bot._tacticRoute?.index||0]||chosen;
     const spread=safePosition(bot,point,index*2.4),nearMate=friends.find(p=>p.id!==bot.id&&distance(bot,p)<38);
     const elapsed=now-planner.started,stage=plan.style==='default'&&elapsed<traits(bot).hold;
     if(bot._phaseAge<traits(bot).startDelay&&spikeState.time>30){watch(bot,brain,points[1],dt);}
     else if(stage&&distance(bot,points[0])<95){watch(bot,brain,recent||points[1],dt);}
     else if(nearMate&&index>0&&(now+traits(bot).cycle)%traits(bot).cycle<traits(bot).step){watch(bot,brain,recent||point,dt);}
     else{goal=route(bot,brain,points,'attack:'+siteIndex+':'+split,quietApproach('live',spikeState.time,distance(bot,chosen)<traits(bot).quietRange,!!recent&&distance(bot,recent)<950||!!bot.investigateTarget&&now-bot.investigateTarget.time<1500));watch(bot,brain,recent||goal||spread,dt);}
    }
   }else{
    const assigned=index%3===2?call('MARKET'):SpikeRules.SITES[index%2];
    const contact=recent&&distance(recent,SpikeRules.SITES[0])<650?SpikeRules.SITES[0]:recent&&distance(recent,SpikeRules.SITES[1])<650?SpikeRules.SITES[1]:null;
    const anchor=index<2,respond=contact&&(!anchor||distance(bot,contact)<1000||spikeState.time<35);
    const heldSite=respond?contact:assigned,area=heldSite.name==='A'||heldSite.name==='B'?heldSite.name:'MID';const angle=holdAngle(bot,'defend:'+team+':'+area,area,friends);goal=angle?.position||safePosition(bot,heldSite,index*2.4);brain.state=respond?'defense_support':'hold_angle';
    if(distance(bot,goal)>55)move(bot,brain,goal,quietApproach('live',spikeState.time,false,!!recent&&distance(bot,recent)<950||!!bot.investigateTarget&&now-bot.investigateTarget.time<1500));watch(bot,brain,angle?.target||recent||call(index%2?'B MAIN':'A MAIN'),dt);
   }
   // Approximate sound direction may change the watched angle; it never gives a live enemy position.
   listenForBotThreats(bot,brain,now);listenForBotFootsteps(bot,brain,now);
   if(bot.investigateTarget&&now-bot.investigateTarget.time<1500)watch(bot,brain,bot.investigateTarget,dt);
  }
 }
 root.SpikeTactics={Planner,profile,quietApproach,routeCost,move,angleOptions,assignAngle,tick};
})(globalThis);
