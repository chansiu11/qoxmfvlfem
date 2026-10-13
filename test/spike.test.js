import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';
import '../public/spike-catalog.js';
import '../public/spike-rules.js';
const {Match,SITES,SPAWNS}=globalThis.SpikeRules;
const actors=()=>[{id:'a',teamId:'team_1',hp:200,weapon:'ar'},{id:'b',teamId:'team_2',hp:200,weapon:'ar'}];
function tick(m,n){for(let i=0;i<Math.ceil(n/.05);i++)m.tick(.05);}
function live(){const p=actors(),m=new Match(()=>p);tick(m,30.1);return {p,m};}
test('30-second prep confines teams to spawn and only permits valid pre-round weapons',()=>{const p=actors(),m=new Match(()=>p);p[0].credits=5000;assert(m.choose(p[0],'v_operator'));assert.equal(p[0].clipAmmo,5);p[0].x=900;assert.equal(m.choose(p[0],'v_bucky'),false);m.tick(.05);assert(p[0].x<=SPAWNS[0].x+SPAWNS[0].w-20);tick(m,30.1);assert.equal(m.phase,'live');assert.equal(m.choose(p[0],'v_vandal'),false);});
test('plant requires carrying the spike, a site and four seconds without moving',()=>{const {p,m}=live();const a=p[0];a._spikeUse=true;tick(m,5);assert(!m.bomb.planted);Object.assign(a,{x:SITES[0].x,y:SITES[0].y});tick(m,2);a.isMoving=true;m.tick(.05);assert.equal(m.progress,0);a.isMoving=false;tick(m,4.1);assert(m.bomb.planted);assert.equal(m.bomb.site,'A');assert.equal(m.phase,'planted');});
test('seven-second defuse wins, next round respawns both teams and switches sides',()=>{const {p,m}=live();Object.assign(p[0],{x:SITES[1].x,y:SITES[1].y,_spikeUse:true});tick(m,4.1);Object.assign(p[1],{x:m.bomb.x,y:m.bomb.y,_spikeUse:true});tick(m,7.1);assert.equal(m.phase,'end');assert.equal(m.score[1],1);p[0].hp=0;p[0].isDead=true;tick(m,6.1);assert.equal(m.round,2);assert.equal(m.phase,'prep');assert.equal(m.attackTeam,2);assert.equal(p[0].hp,100);assert.equal(p[0].isDead,false);});
test('planted spike survives attackers dying, explodes; no-plant timeout favors defenders',()=>{let {p,m}=live();Object.assign(p[0],{x:SITES[0].x,y:SITES[0].y,_spikeUse:true});tick(m,4.1);p[0].hp=0;p[0].isDead=true;tick(m,1);assert.equal(m.phase,'planted');tick(m,45);assert.equal(m.score[0],1);({m}=live());tick(m,100.1);assert.equal(m.score[1],1);});
test('dead/disconnected carrier drops spike for living attacking teammate',()=>{const p=actors();p.push({id:'c',teamId:'team_1',hp:200});const m=new Match(()=>p);tick(m,30.1);const {x,y}=p[0];p[0].hp=0;Object.assign(p[2],{x,y});m.tick(.05);assert.equal(m.bomb.carrier,'c');p.splice(2,1);m.tick(.05);assert.equal(m.bomb.carrier,null);});
function harness(){
 const elements=new Map(),noop=()=>{},ctx=new Proxy({measureText:()=>({width:0})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
 function el(){return {style:{setProperty:noop},dataset:{},classList:{add:noop,remove:noop},setAttribute:noop,value:'',clientWidth:1000,clientHeight:600,addEventListener:noop,appendChild:noop,replaceChildren:noop,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};}
 const document={getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,querySelectorAll:()=>[],addEventListener:noop,body:el(),documentElement:el()};
 const sandbox={console,performance,document,setTimeout:noop,setInterval:noop,clearTimeout:noop,clearInterval:noop,requestAnimationFrame:noop,addEventListener:noop,alert:s=>{throw Error(s);}};sandbox.window=sandbox;
 const c=vm.createContext(sandbox);
 const packed=Array.from({length:10},(_,i)=>fs.readFileSync(new URL(`../public/game-data/part${String(i+1).padStart(2,'0')}.txt`,import.meta.url),'utf8').trim()).join('');
 const html=zlib.gunzipSync(Buffer.from(packed,'base64')).toString();
 const code=html.slice(html.indexOf('<script>\nlet WORLD_SIZE')+8,html.lastIndexOf('</script>'));
 // Only the inline game script; the objective adapter is a separate asset.
 vm.runInContext(code.slice(0,code.indexOf('</script>')<0?undefined:code.indexOf('</script>')),c);
 vm.runInContext(fs.readFileSync(new URL('../public/spike-catalog.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../public/spike-rules.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../public/spike-mode.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../public/spike-shop.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../public/game-audio.js',import.meta.url),'utf8'),c);
 vm.runInContext('render=()=>{};updateHUD=()=>{};',c);
 return {run:s=>vm.runInContext(s,c),html};
}
test('actual packed game starts objective match; other map modes and original mobile controls remain',()=>{
 const h=harness();assert(h.html.includes('value="spike"'));assert(!h.html.includes('id="btnFire"'));
 h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='1';document.getElementById('aiDifficultySelect').value='easy';hostStartGame();`);
 assert.equal(h.run('gameStarted'),true);assert.equal(h.run('WORLD_SIZE'),4800);assert.equal(h.run('spikeMatch.phase'),'prep');assert.equal(h.run('spikeActors().length'),2);
 h.run(`myPlayer.credits=5000;spikeChoose('v_operator')`);assert.equal(h.run('myPlayer.weapon'),'v_operator');
 assert.equal(h.run(`generateMapData('normal',123).worldSize`),2400);assert(h.run(`generateMapData('br',123).obstacles.some(o=>o.type==='house')`));
 h.run(`spikeMatch.time=0;spikeMatch.tick(.05);spikeState=spikeMatch.snapshot();handleNetworkData({type:'SPIKE_WEAPON',player:{id:myPlayer.id},weapon:'ar'});`);assert.equal(h.run('myPlayer.weapon'),'v_operator');
 h.run('returnToRoomAfterGame()');assert.equal(h.run('spikeMatch'),null);
});
test('host/guest snapshots agree on spawn, weapon choice, locked combat health and next-round respawn',()=>{
 const host=harness(),guest=harness();
 host.run(`globalThis.out=[];isHost=true;myPlayer.id='host';remotePlayers.guest={...myPlayer,id:'guest',name:'Guest'};connections.guest={open:true,playerId:'guest',dataChannel:{bufferedAmount:0},send:p=>out.push(JSON.stringify(p))};document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='false';document.getElementById('aiCountInput').value='0';hostStartGame();lastHostSyncAt=0;updateNetwork();`);
 guest.run(`isHost=false;myPlayer.id='guest';`);
 const packets=host.run('out.slice()');for(const data of packets)guest.run(`handleNetworkData(${data})`);
 assert.equal(guest.run('selectedMode'),'spike');assert.equal(guest.run('spikeAppliedRound'),1);
 assert.equal(guest.run('myPlayer.teamId'),'team_2');assert(guest.run('SpikeRules.inside(myPlayer,SpikeRules.SPAWNS[1])'));
 host.run(`remotePlayers.guest.credits=1000;handleNetworkData({type:'SPIKE_BUY',round:1,seq:1,player:{id:'guest'},item:'v_bucky'});lastHostSyncAt=0;updateNetwork();`);
 guest.run(`handleNetworkData(${host.run('out.at(-1)')})`);assert.equal(guest.run('myPlayer.weapon'),'v_bucky');
 host.run(`remotePlayers.guest.hp=80;handleNetworkData({type:'SYNC',player:{id:'guest',_spikeRound:1,x:2100,y:1200,hp:200,isDead:false}});`);assert.equal(host.run('remotePlayers.guest.hp'),80);
 host.run(`spikeMatch.begin();spikeState=spikeMatch.snapshot();spikeApply(spikeState);lastHostSyncAt=0;updateNetwork();`);
 guest.run(`myPlayer.isDead=true;isSpectating=true;handleNetworkData(${host.run('out.at(-1)')})`);
 assert.equal(guest.run('spikeAppliedRound'),2);assert.equal(guest.run('myPlayer.hp'),100);assert.equal(guest.run('isSpectating'),false);assert(guest.run('SpikeRules.inside(myPlayer,SpikeRules.SPAWNS[0])'));
});
test('unplanted spike and planting progress are private to attackers; planted spike is public',()=>{
 const {p,m}=live();m.actor=p[0].id;m.progress=2;
 assert.equal(m.snapshot(p[0]).bomb.carrier,'a');
 for(const viewer of [p[1],{teamId:'spectator'}]){const s=m.snapshot(viewer);assert.equal(s.bomb.hidden,true);assert.equal(s.bomb.x,undefined);assert.equal(s.bomb.carrier,undefined);assert.equal(s.actor,null);assert.equal(s.progress,0);}
 m.bomb.planted=true;assert.equal(m.snapshot(p[1]).bomb.x,m.bomb.x);
 m.begin();assert.equal(m.snapshot(p[0]).bomb.hidden,true);assert.equal(m.snapshot(p[1]).bomb.carrier,'b');
});
test('Ascent routes, spawn rooms and both sites are traversable at player radius',()=>{
 const {WALLS,SITES,SPAWNS,CALLOUTS,SIZE}=SpikeRules;
 const clear=(x,y)=>WALLS.every(w=>x+25<=w.x||x-25>=w.x+w.w||y+25<=w.y||y-25>=w.y+w.h);
 const step=15,n=SIZE/step,seen=new Set(),queue=[];
 const key=(x,y)=>y*n+x;
 const first={x:Math.round((SPAWNS[0].x+50)/step),y:Math.round((SPAWNS[0].y+50)/step)};
 seen.add(key(first.x,first.y));queue.push(first);
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=key(x,y);if(x>0&&y>0&&x<n&&y<n&&!seen.has(k)&&clear(x*step,y*step)){seen.add(k);queue.push({x,y});}}}
 for(const p of [...SITES,...CALLOUTS,...SPAWNS.map(r=>({x:r.x+r.w/2,y:r.y+r.h/2}))])assert(seen.has(key(Math.round(p.x/step),Math.round(p.y/step))),`unreachable ${p.name||'spawn'}`);
 for(const r of SPAWNS)for(let x=r.x+25;x<=r.x+r.w-25;x+=15)for(let y=r.y+25;y<=r.y+r.h-25;y+=15)assert(clear(x,y));
 const p=Array.from({length:24},(_,i)=>({id:'p'+i,teamId:i%2?'team_2':'team_1',hp:200}));new Match(()=>p);for(const a of p)assert(clear(a.x,a.y));
 assert(WALLS.length<100,'merged geometry stays small for mobile');
});
test('host rendering hides preplant marker for defenders and shows it after planting',()=>{
 const h=harness();h.run(`selectedMode='spike';myPlayer.teamId='team_2';spikeState={attackTeam:1,bomb:{x:900,y:900,planted:false}};globalThis.marks=0;globalThis.mapctx={save(){},restore(){},scale(){},fillRect(x,y,w,h){if(w===24&&h===24)marks++},strokeRect(){},fillText(){},beginPath(){},arc(){},fill(){},stroke(){}};drawSpikeMap(mapctx);`);assert.equal(h.run('marks'),0);
 h.run(`spikeState.bomb.planted=true;drawSpikeMap(mapctx)`);assert.equal(h.run('marks'),1);
});
test('general movement is time based at 30/60/120 FPS, with no sprint or diagonal bonus',()=>{
 const h=harness();h.run(`gameStarted=true;gameEnded=false;isHost=false;isMobile=false;obstacles=[];keys['d']=true;updateAI=()=>{};updateNetwork=()=>{};myPlayer.isDead=false;myPlayer.hp=200;selectedMode='spike';`);
 for(const fps of [30,60,120])for(const stance of ['walk','sprint','stealth'])for(const diagonal of [false,true]){
  const distance=h.run(`(()=>{spikeFrameDt=1/${fps};keys['shift']=${stance==='sprint'};keys['control']=${stance==='stealth'};keys['w']=${diagonal};myPlayer.x=1200;myPlayer.y=1200;for(let i=0;i<${fps};i++)originalUpdate();return Math.hypot(myPlayer.x-1200,myPlayer.y-1200)})()`);
  assert(Math.abs(distance-(stance==='stealth'||stance==='sprint'?129.6:216))<1e-6,`${fps} FPS ${stance}`);
 }
 h.run(`selectedMode='normal';keys['control']=false;keys['shift']=false;keys['w']=false;myPlayer.x=1200;originalUpdate()`);assert.equal(h.run('myPlayer.x'),1203);
 for(const fps of [30,60,120]){
  const distance=h.run(`(()=>{selectedMode='spike';spikeFrameDt=1/${fps};const b={id:'bot_test',x:1200,y:1200};for(let i=0;i<${fps};i++){b._spikeMoveBudget=SpikeRules.movementDistance(spikeFrameDt);walkBotRoute(b,{x:2200,y:1200},3);walkBotRoute(b,{x:2200,y:1200},1.5);}return b.x-1200})()`);
  assert(Math.abs(distance-216)<1e-6,'bot combat and objective share one movement budget');
 }
 assert.equal(SpikeRules.SIZE/SpikeRules.UNITS_PER_METER,120);
 assert.equal(SpikeRules.movementDistance(5),10.8,'tab resume cannot teleport');
});
test('actual bot pathfinder reaches both Ascent sites from both spawns',()=>{
 const h=harness();h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='1';document.getElementById('aiDifficultySelect').value='easy';hostStartGame();`);
 for(let spawn=0;spawn<2;spawn++)for(let site=0;site<2;site++)assert(h.run(`(()=>{const r=SpikeRules.SPAWNS[${spawn}];return !!planBotRoute({x:r.x+40,y:r.y+40},SpikeRules.SITES[${site}])})()`),`spawn ${spawn} to site ${site}`);
});
test('half defuse survives release, movement and teammate handoff, then resets next round',()=>{
 const {p,m}=live();Object.assign(p[0],{x:SITES[0].x,y:SITES[0].y,_spikeUse:true});tick(m,4.1);
 Object.assign(p[1],{x:m.bomb.x,y:m.bomb.y,_spikeUse:true});tick(m,3);p[1]._spikeUse=false;m.tick(.05);assert.equal(m.progress,0);
 p[1]._spikeUse=true;tick(m,3.6);assert.equal(m.bomb.defuseCheckpoint,3.5);
 p[1].isMoving=true;m.tick(.05);assert.equal(m.progress,3.5);
 const c={id:'c',teamId:'team_2',hp:200,x:m.bomb.x,y:m.bomb.y,_spikeUse:true};p.push(c);tick(m,3.3);assert.equal(m.phase,'planted');tick(m,.3);assert.equal(m.phase,'end');tick(m,6.1);assert.equal(m.bomb.defuseCheckpoint,0);
});
test('enemy bullet visibility follows wall occlusion and spectated viewpoint only in general mode',()=>{
 const h=harness();h.run(`selectedMode='spike';myPlayer.id='me';myPlayer.teamId='team_1';myPlayer.x=0;myPlayer.y=0;remotePlayers.enemy={id:'enemy',teamId:'team_2'};globalThis.tracer={ownerId:'enemy',x:200,y:0,prevX:180,prevY:0};hasLineOfSight=(a,b)=>a.x>100||b.x<100;`);
 assert.equal(h.run('spikeBulletVisible(tracer)'),false);assert.equal(h.run(`spikeBulletVisible({...tracer,x:50,prevX:40})`),true);
 assert.equal(h.run(`spikeBulletVisible({...tracer,ownerId:'me'})`),true);
 h.run(`isSpectating=true;spectateTarget={id:'ally',teamId:'team_1',x:150,y:0}`);assert.equal(h.run('spikeBulletVisible(tracer)'),true);
 h.run(`isSpectating=false;selectedMode='normal'`);assert.equal(h.run('spikeBulletVisible(tracer)'),true);
});
test('host can assign general-mode teams and assignments survive normalization and match start',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='host';remotePlayers.guest={...myPlayer,id:'guest'};document.getElementById('aiToggle').value='false';document.getElementById('aiCountInput').value='0';normalizeRoomTeams();`);
 assert(h.run("setRoomTeam('host',2)"));assert(h.run("setRoomTeam('guest',1)"));h.run('normalizeRoomTeams();prepareMatchTeams()');
 assert.equal(h.run('myPlayer.teamId'),'team_2');assert.equal(h.run('remotePlayers.guest.teamId'),'team_1');
 h.run('isHost=false');assert.equal(h.run("setRoomTeam('host',1)"),false);h.run('isHost=true;gameStarted=true');assert.equal(h.run("setRoomTeam('host',1)"),false);
});
test('general match final victory stops round restart and presents winner/loser UI',()=>{
 const {m}=live();m.score[0]=12;m.finish(1,'수비팀 전멸 · 공격 승리');assert.equal(m.phase,'finished');assert.equal(m.winnerTeam,1);tick(m,11);assert.equal(m.round,1);
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;myPlayer.teamId='team_1';spikeState=${JSON.stringify(m.snapshot())};spikeUI();`);assert(h.run("spikeBanner.innerHTML.includes('게임 종료 · 승리')"));
 h.run(`myPlayer.teamId='team_2';spikeUI()`);assert(h.run("spikeBanner.innerHTML.includes('게임 종료 · 패배')"));
 h.run(`spikeState.phase='prep';spikeState.round=1;spikeState.time=15;spikeUI()`);assert(h.run("spikeBanner.innerHTML.includes('게임 시작')"));
});
test('guest bullets move between packets, reconcile by pellet id, and stop at walls without damage',()=>{
 const h=harness();h.run(`isHost=false;obstacles=[];myPlayer.hp=200;globalThis.packet=[{bulletId:'shot:0',shotId:'shot',ownerId:'enemy',x:100,y:100,prevX:90,prevY:100,dx:10,dy:0}];applyBulletSnapshot(packet);globalThis.bulletClock=performance.now();guestBulletFrameAt=bulletClock;updateGuestBullets(bulletClock+16);`);
 const x=h.run('bullets[0].x');assert(x>100);h.run('updateGuestBullets(bulletClock+32)');assert(h.run('bullets[0].x')>x);
 h.run('applyBulletSnapshot(packet,true)');assert.equal(h.run('bullets.length'),1);const ahead=h.run('bullets[0].x');h.run('updateGuestBullets(bulletClock+48)');assert(h.run('bullets[0].x')>=ahead);
 h.run('checkBulletPathObstacleCollision=()=>true;updateGuestBullets(bulletClock+64)');assert.equal(h.run('bullets.length'),0);assert.equal(h.run('myPlayer.hp'),200);
});
test('host emits immediate pellet spawn event and guest local shot ids are retained',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='normal';myPlayer.id='host';myPlayer.weapon='shotgun';myPlayer.clipAmmo=5;myPlayer.isDead=false;globalThis.events=[];broadcastData=p=>events.push(p);shoot(myPlayer,0,'host_test');`);
 assert(h.run("events.some(p=>p.type==='BULLET_SPAWN')"));assert(h.run("events.find(p=>p.type==='BULLET_SPAWN').bullets.every(b=>b.shotId==='host_test'&&Number.isFinite(b.dx))"));assert.equal(h.run('new Set(bullets.map(b=>b.bulletId)).size'),h.run('bullets.length'));
});
test('objective HUD shows timed plant progress and saved half-defuse without revealing enemy planting',()=>{
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;myPlayer.id='me';myPlayer.teamId='team_1';myPlayer.hp=200;myPlayer.isDead=false;spikeState={phase:'live',attackTeam:1,actor:'me',progress:2,bomb:{carrier:'me',planted:false}};updateSpikeAction();`);
 assert.equal(h.run('spikeAction.style.display'),'block');assert.equal(h.run("document.getElementById('spikeActionFill').style.width"),'50%');assert.equal(h.run("document.getElementById('spikeActionTime').textContent"),'2.0초');
 h.run(`remotePlayers.enemy={id:'enemy',teamId:'team_1',hp:200};myPlayer.teamId='team_2';spikeState.actor='enemy';spikeState.bomb.carrier='enemy';updateSpikeAction();`);assert.equal(h.run('spikeAction.style.display'),'none');
 h.run(`spikeState.phase='planted';spikeState.actor=null;spikeState.progress=3.5;spikeState.bomb={planted:true,x:myPlayer.x,y:myPlayer.y,defuseCheckpoint:3.5};updateSpikeAction();`);
 assert.equal(h.run('spikeAction.style.display'),'block');assert.equal(h.run("document.getElementById('spikeActionFill').style.width"),'50%');assert.equal(h.run("document.getElementById('spikeActionTime').textContent"),'3.5초');assert(h.run("document.getElementById('spikeActionSaved').textContent.includes('50% 저장')"));
 h.run(`spikeState.phase='end';updateSpikeAction()`);assert.equal(h.run('spikeAction.style.display'),'none');
});

test('aim dots stop at the first wall and move forward only while locally aiming',()=>{
 const h=harness();h.run(`gameStarted=true;gameEnded=false;isSpectating=false;isRespawning=false;myPlayer.x=100;myPlayer.y=100;myPlayer.angle=0;myPlayer.hp=200;myPlayer.isDead=false;myPlayer.isDowned=false;myPlayer.weapon='ar';myPlayer.isAiming=true;obstacles=[{x:220,y:50,w:10,h:100},{x:350,y:50,w:10,h:100}];nearbyObstacles=()=>obstacles;globalThis.dots=[];ctx.arc=(x,y,r)=>dots.push({x,y,r});drawAimGuide(0);`);
 assert.equal(h.run('aimGuideLength(myPlayer,1000)'),118);
 const first=h.run('dots[0].x');assert(h.run('dots.length>0&&dots.every(p=>p.x+p.r<220)'));
 h.run('dots=[];drawAimGuide(250)');assert.equal(h.run('dots[0].x'),first+6);
 h.run('dots=[];myPlayer.isAiming=false;drawAimGuide(0)');assert.equal(h.run('dots.length'),0);
 h.run('myPlayer.isAiming=true;obstacles=[{x:125,y:50,w:10,h:100}];drawAimGuide(0)');assert.equal(h.run('dots.length'),0,'muzzle beyond wall must not leak guide');
 h.run('obstacles=[];isSpectating=true;drawAimGuide(0)');assert.equal(h.run('dots.length'),0);
 h.run('isSpectating=false;myPlayer.angle=Math.PI/2;obstacles=[{x:50,y:220,w:100,h:10}]');assert(Math.abs(h.run('aimGuideLength(myPlayer,1000)')-118)<1e-8);
});

test('quiet walking suppresses footsteps and general hearing uses metre scale',()=>{
 const h=harness();h.run(`selectedMode='spike';`);
 assert.equal(h.run("footstepRange({movementMode:'walk'})"),1600);
 assert.equal(h.run("footstepRange({movementMode:'stealth'})"),0);
 assert.equal(h.run("footstepAudible({movementMode:'stealth'},216)"),false);
 assert.equal(h.run("footstepAudible({movementMode:'walk'},129.6)"),false);
 assert.equal(h.run("footstepAudible({movementMode:'walk'},216)"),true);
 h.run(`isHost=true;myPlayer.hp=200;myPlayer.isDead=false;myPlayer.movementMode='stealth';footstepTracks.clear();footstepCheckAt=0;updateFootsteps();myPlayer.x+=30;footstepCheckAt=0;updateFootsteps();`);
 assert.equal(h.run('footstepEvents.length'),0);
});
test('store enforces funds and spawn/phase, refunds only current purchases, preserves survivors',()=>{
 const p=actors(),m=new Match(()=>p),a=p[0];assert.equal(a.credits,800);assert.equal(a.hp,100);assert.equal(a.weapon,'v_classic');
 assert.equal(m.buy(a,'v_vandal'),false);assert(m.buy(a,'v_ghost'));assert.equal(a.credits,300);assert(!m.buy(a,'v_ghost'));
 assert(m.sell(a,'secondary'));assert.equal(a.credits,800);assert.equal(a.weapon,'v_classic');assert(!m.sell(a,'secondary'));
 assert(m.buy(a,'light'));assert.equal(a.credits,400);assert.equal(a.shield,25);assert(!m.buy(a,'fake'));
 const x=a.x;a.x=10;assert(!m.buy(a,'v_shorty'));a.x=x;
 tick(m,30.1);assert(!m.buy(a,'v_classic'));m.rewardKill(a.id);assert.equal(a.credits,600);m.finish(1,'win');assert.equal(a.credits,3600);assert.equal(p[1].credits,2700);
 m.finish(1,'duplicate');assert.equal(a.credits,3600);tick(m,6.1);assert.equal(a.shield,25);assert(!m.sell(a,'armor'));
 assert(m.buy(a,'v_vandal'));assert.equal(a.credits,700);assert(m.switch(a,'secondary'));assert.equal(a.weapon,'v_classic');assert(m.switch(a,'primary'));assert.equal(a.weapon,'v_vandal');
 a.isDead=true;a.hp=0;m.begin();assert.equal(a.weapon,'v_classic');assert.equal(a.shield,0);assert.equal(a.credits,700);
});
test('shield damage separates HP, exhausts armor and regenerates only from reserve after delay',()=>{
 const p=actors(),m=new Match(()=>p),a=p[0];a.credits=9000;m.buy(a,'heavy');
 assert.equal(SpikeRules.shieldDamage(a,100),50);assert.equal(a.shield,0);assert.equal(SpikeRules.shieldDamage(a,10),10);
 m.buy(a,'regen');assert.equal(SpikeRules.shieldDamage(a,30),5);assert.equal(a.shield,0);tick(m,2.9);assert.equal(a.shield,0);tick(m,1.2);assert.equal(a.shield,25);assert.equal(a.shieldPool,25);
 SpikeRules.shieldDamage(a,25);tick(m,4.2);assert.equal(a.shield,25);assert.equal(a.shieldPool,0);SpikeRules.shieldDamage(a,25);tick(m,5);assert.equal(a.shield,0);
});
test('catalog has working bullets, distance falloff, shotguns and distinct reloads',()=>{
 const guns=Object.values(SpikeCatalog.weapons);assert(guns.length>=19);for(const w of guns){assert(w.maxClip>0&&w.pellets>=1&&w.reloadMs>0&&w.cooldown>0);assert(w.icon.startsWith('https://'));}
 assert.equal(SpikeCatalog.weapons.v_vandal.cost,2900);assert.equal(SpikeCatalog.weapons.v_operator.damage,120);assert.equal(SpikeCatalog.weapons.v_classic.cost,0);
 assert.equal(SpikeRules.bulletDamage({weapon:'v_phantom',startX:0,startY:0},{x:400,y:0}),31.2);
 assert.equal(SpikeRules.bulletDamage({weapon:'v_phantom',startX:0,startY:0},{x:1200,y:0}),28);
});
test('host validates guest purchase sequences, protects money and armor, synchronizes loadout',()=>{
 const h=harness();h.run(`isHost=true;myPlayer.id='host';remotePlayers.guest={...myPlayer,id:'guest'};document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='false';hostStartGame();globalThis.buy={type:'SPIKE_BUY',player:{id:'guest'},item:'v_ghost',round:1,seq:1};handleNetworkData(buy);`);
 assert.equal(h.run('remotePlayers.guest.credits'),300);assert.equal(h.run('remotePlayers.guest.weapon'),'v_ghost');h.run('handleNetworkData(buy)');assert.equal(h.run('remotePlayers.guest.credits'),300);
 h.run(`handleNetworkData({type:'SYNC',player:{id:'guest',_spikeRound:1,credits:9000,shield:500,shieldType:'heavy',weapon:'v_operator',hp:999}})`);
 assert.equal(h.run('remotePlayers.guest.credits'),300);assert.equal(h.run('remotePlayers.guest.shield'),0);assert.equal(h.run('remotePlayers.guest.hp'),100);assert.equal(h.run('remotePlayers.guest.weapon'),'v_ghost');
 h.run(`handleNetworkData({...buy,seq:2,round:0,item:'v_classic'})`);assert.equal(h.run('remotePlayers.guest.weapon'),'v_ghost');
 const packet=h.run('JSON.stringify(spikeMatch.snapshot(remotePlayers.guest))'),g=harness();g.run(`selectedMode='spike';isHost=false;myPlayer.id='guest';spikeApply(${packet})`);assert.equal(g.run('myPlayer.credits'),300);assert.equal(g.run('myPlayer.weapon'),'v_ghost');
});
test('store opens in prep, shows weapon categories and armor, closes on live phase',()=>{
 const h=harness();h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='1';hostStartGame()`);
 assert(h.run('spikeShopOpen'));assert(h.run("document.getElementById('shopGuns').innerHTML.includes('밴달')"));assert(h.run("document.getElementById('shopArmor').innerHTML.includes('재생 보호막')"));
 h.run(`spikeMatch.phase='live';spikeState=spikeMatch.snapshot();spikeUI()`);assert.equal(h.run('spikeShopOpen'),false);
 h.run(`selectedMode='normal';spikeToggleShop(true)`);assert.equal(h.run('spikeShopOpen'),false);
});
test('packed Vandal shot consumes purchased heavy shield and damages HP on host',()=>{
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;isHost=true;isSpawnSelecting=false;isSpectating=false;obstacles=[];updateAI=()=>{};updateNetwork=()=>{};hasLineOfSight=()=>true;myPlayer.id='me';myPlayer.teamId='team_1';myPlayer.x=100;myPlayer.y=100;myPlayer.angle=0;myPlayer.weapon='v_vandal';myPlayer.clipAmmo=25;myPlayer.hp=100;myPlayer.isDead=false;myPlayer.isShooting=false;myPlayer.isReloading=false;spikeState={phase:'live'};remotePlayers.enemy={id:'enemy',x:175,y:100,hp:100,maxHp:100,isDead:false,teamId:'team_2',shieldType:'heavy',shield:50,weapon:'v_classic'};shoot(myPlayer,0);originalUpdate();`);
 assert.equal(h.run('myPlayer.clipAmmo'),24);assert(Math.abs(h.run('remotePlayers.enemy.shield')-28.88)<1e-6);assert(Math.abs(h.run('remotePlayers.enemy.hp')-89.12)<1e-6);
});
