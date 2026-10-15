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
test('30-second prep confines teams to their preparation side and permits valid purchases',()=>{const p=actors(),m=new Match(()=>p);p[0].credits=5000;assert(m.choose(p[0],'v_operator'));assert.equal(p[0].clipAmmo,5);p[0].x=900;assert.equal(m.choose(p[0],'v_bucky'),false);m.tick(.05);assert(p[0].x<=SPAWNS[0].x+SPAWNS[0].w-20);tick(m,30.1);assert.equal(m.phase,'live');assert.equal(m.choose(p[0],'v_vandal'),false);});
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
 vm.runInContext(fs.readFileSync(new URL('../public/spike-tactics.js',import.meta.url),'utf8'),c);
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
test('free pistol starts and respawns, primaries cost money, switching and refunds preserve sidearm',()=>{
 const p=actors(),m=new Match(()=>p),a=p[0];assert.equal(a.credits,800);assert.equal(a.weapon,'v_classic');assert.equal(a.clipAmmo,12);assert.equal(a.loadout.primary,null);assert(!m.buy(a,'v_vandal'));a.credits=2000;
 assert(m.buy(a,'v_vandal'));assert.equal(a.credits,400);a.clipAmmo=24;assert(m.switch(a,'secondary'));assert.equal(a.weapon,'v_classic');a.clipAmmo=9;assert(m.switch(a,'primary'));assert.equal(a.clipAmmo,24);assert(m.sell(a,'primary'));assert.equal(a.credits,2000);assert.equal(a.weapon,'v_classic');assert.equal(a.clipAmmo,9);
 assert(m.buy(a,'v_bucky'));tick(m,30.1);assert(!m.buy(a,'v_operator'));m.finish(1,'win');tick(m,6.1);assert.equal(a.weapon,'v_bucky');assert.equal(a.loadout.secondary.id,'v_classic');assert(!m.sell(a,'primary'));a.hp=0;a.isDead=true;m.begin();assert.equal(a.weapon,'v_classic');assert.equal(a.loadout.primary,null);assert.equal(a.clipAmmo,12);
});
test('shield damage separates HP, exhausts armor and regenerates only from reserve after delay',()=>{
 const p=actors(),m=new Match(()=>p),a=p[0];a.credits=9000;m.buy(a,'heavy');
 assert.equal(SpikeRules.shieldDamage(a,100),50);assert.equal(a.shield,0);assert.equal(SpikeRules.shieldDamage(a,10),10);
 m.buy(a,'regen');assert.equal(SpikeRules.shieldDamage(a,30),5);assert.equal(a.shield,0);tick(m,2.9);assert.equal(a.shield,0);tick(m,1.2);assert.equal(a.shield,25);assert.equal(a.shieldPool,25);
 SpikeRules.shieldDamage(a,25);tick(m,4.2);assert.equal(a.shield,25);assert.equal(a.shieldPool,0);SpikeRules.shieldDamage(a,25);tick(m,5);assert.equal(a.shield,0);
});
test('three general guns match deathmatch ballistics and reloads; shotgun only renamed',()=>{
 const h=harness();assert.equal(Object.keys(SpikeCatalog.weapons).length,4);
 for(const w of Object.values(SpikeCatalog.weapons).filter(w=>w.slot==='primary')){
  for(const k of ['cooldown','bulletSpeed','damage','pellets','spread','maxClip'])assert.equal(w[k],w.id==='v_operator'&&k==='damage'?82:h.run(`WEAPONS['${w.deathmatchWeapon}']['${k}']`));
  assert.equal(w.reloadMs,1500);assert.equal(SpikeRules.bulletDamage({weapon:w.id,startX:0,startY:0},{x:2000,y:0}),w.damage);
 }
 assert.equal(SpikeCatalog.weapons.v_bucky.name,'버키');
});
test('host validates guest purchase sequences, protects money and armor, synchronizes loadout',()=>{
 const h=harness();h.run(`isHost=true;myPlayer.id='host';remotePlayers.guest={...myPlayer,id:'guest'};document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='false';hostStartGame();remotePlayers.guest.credits=1150;globalThis.buy={type:'SPIKE_BUY',player:{id:'guest'},item:'v_bucky',round:1,seq:1};handleNetworkData(buy);`);
 assert.equal(h.run('remotePlayers.guest.credits'),300);assert.equal(h.run('remotePlayers.guest.weapon'),'v_bucky');h.run('handleNetworkData(buy)');assert.equal(h.run('remotePlayers.guest.credits'),300);
 h.run(`handleNetworkData({type:'SYNC',player:{id:'guest',_spikeRound:1,credits:9000,shield:500,shieldType:'heavy',weapon:'v_operator',hp:999}})`);
 assert.equal(h.run('remotePlayers.guest.credits'),300);assert.equal(h.run('remotePlayers.guest.shield'),0);assert.equal(h.run('remotePlayers.guest.hp'),100);assert.equal(h.run('remotePlayers.guest.weapon'),'v_bucky');
 h.run(`handleNetworkData({...buy,seq:2,round:0,item:'v_classic'})`);assert.equal(h.run('remotePlayers.guest.weapon'),'v_bucky');
 const packet=h.run('JSON.stringify(spikeMatch.snapshot(remotePlayers.guest))'),g=harness();g.run(`selectedMode='spike';isHost=false;myPlayer.id='guest';spikeApply(${packet})`);assert.equal(g.run('myPlayer.credits'),300);assert.equal(g.run('myPlayer.weapon'),'v_bucky');
});
test('store opens in prep, shows weapon categories and armor, closes on live phase',()=>{
 const h=harness();h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='1';hostStartGame()`);
 assert.equal(h.run('spikeShopOpen'),false);h.run('spikeToggleShop(true)');assert(h.run('spikeShopOpen'));assert(h.run("document.getElementById('shopGuns').innerHTML.includes('돌격소총')"));assert(h.run("document.getElementById('shopArmor').innerHTML.includes('재생 보호막')"));
 h.run(`spikeMatch.phase='live';spikeState=spikeMatch.snapshot();spikeUI()`);assert.equal(h.run('spikeShopOpen'),false);
 h.run(`selectedMode='normal';spikeToggleShop(true)`);assert.equal(h.run('spikeShopOpen'),false);
});
test('packed rifle shot consumes purchased heavy shield and damages HP on host',()=>{
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;isHost=true;isSpawnSelecting=false;isSpectating=false;obstacles=[];updateAI=()=>{};updateNetwork=()=>{};hasLineOfSight=()=>true;myPlayer.id='me';myPlayer.teamId='team_1';myPlayer.x=100;myPlayer.y=100;myPlayer.angle=0;myPlayer.weapon='v_vandal';myPlayer.clipAmmo=25;myPlayer.hp=100;myPlayer.isDead=false;myPlayer.isShooting=false;myPlayer.isReloading=false;spikeState={phase:'live'};remotePlayers.enemy={id:'enemy',x:175,y:100,hp:100,maxHp:100,isDead:false,teamId:'team_2',shieldType:'heavy',shield:50,weapon:'v_classic'};shoot(myPlayer,0);originalUpdate();`);
 assert.equal(h.run('myPlayer.clipAmmo'),24);assert(Math.abs(h.run('remotePlayers.enemy.shield')-30)<1e-6);assert(Math.abs(h.run('remotePlayers.enemy.hp')-100)<1e-6);
});
test('all catalog guns set frame-independent movement and quiet speeds without affecting deathmatch',()=>{
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;isHost=false;isMobile=false;obstacles=[];updateAI=()=>{};updateNetwork=()=>{};myPlayer.isDead=false;myPlayer.hp=100;keys['d']=true;`);
 for(const w of Object.values(SpikeCatalog.weapons))for(const fps of [30,60,120])for(const quiet of [false,true]){
  const distance=h.run(`(()=>{myPlayer.weapon='${w.id}';keys['shift']=${quiet};myPlayer.x=1200;myPlayer.y=1200;spikeFrameDt=1/${fps};for(let i=0;i<${fps};i++)originalUpdate();return myPlayer.x-1200;})()`);
  assert(Math.abs(distance-w.moveMps*40*(quiet?.6:1))<1e-6,`${w.id} ${fps} ${quiet}`);
 }
 h.run(`selectedMode='normal';keys['shift']=false;myPlayer.weapon='shotgun';myPlayer.x=1200;originalUpdate()`);assert.equal(h.run('myPlayer.x'),1203);
 h.run(`selectedMode='spike';myPlayer.weapon='v_vandal';checkObstacleCollision=()=>true;originalUpdate()`);assert.equal(h.run('myPlayer.isMoving'),false);assert.equal(h.run('myPlayer.moveSpeed'),0);
 assert.equal(SpikeCatalog.weapons.v_bucky.damage,14.4);
});
test('general shots retain deathmatch spread while moving',()=>{
 for(const w of Object.values(SpikeCatalog.weapons))for(const mode of ['stealth','walk'])assert.equal(SpikeRules.movingSpread({weapon:w.id,isMoving:true,movementMode:mode}),w.spread);
 const h=harness();h.run(`isHost=true;myPlayer.id='me';myPlayer.weapon='v_bucky';myPlayer.hp=100;myPlayer.isDead=false;myPlayer.isReloading=false;myPlayer.isMoving=true;myPlayer.movementMode='walk';myPlayer.angle=0;spikeState={phase:'live'};Math.random=()=>1;selectedMode='spike';myPlayer.clipAmmo=8;shoot(myPlayer,0);`);
 assert.equal(h.run('bullets.length'),8);assert.equal(h.run('myPlayer.clipAmmo'),7);assert(Math.abs(h.run('Math.atan2(bullets[0].dy,bullets[0].dx)')-.09)<1e-9);
});

test('general scoped guns look farther ahead while other modes and short-range guns keep their camera',()=>{
 const h=harness();
 assert.equal(h.run("(()=>{selectedMode='spike';return aimLookDistance({weapon:'v_operator'})})()"),1200);
 assert.equal(h.run("(()=>{selectedMode='spike';return aimLookDistance({weapon:'v_vandal'})})()"),620);
 assert.equal(h.run("(()=>{selectedMode='spike';return aimLookDistance({weapon:'v_bucky'})})()"),200);
 assert.equal(h.run("(()=>{selectedMode='normal';return aimLookDistance({weapon:'v_operator'})})()"),200);
 h.run("selectedMode='spike';gameStarted=true;gameEnded=false;isMobile=true;isSpectating=false;isRespawning=false;myPlayer.x=1200;myPlayer.y=1200;myPlayer.hp=100;myPlayer.isDead=false;myPlayer.isAiming=true;mobileAimVec={x:1,y:0};obstacles=[];updateAI=()=>{};updateNetwork=()=>{};updateFootsteps=()=>{};updateGuestPlayerInterpolation=()=>{};updateGuestBotInterpolation=()=>{};");
 const difference=h.run("(()=>{myPlayer.weapon='v_operator';camera.x=myPlayer.x;camera.y=myPlayer.y;originalUpdate();const far=camera.x-myPlayer.x;myPlayer.weapon='v_bucky';camera.x=myPlayer.x;camera.y=myPlayer.y;originalUpdate();return far-(camera.x-myPlayer.x)})()");
 assert(difference>0,'sniper must show more of the aimed direction than a shotgun');
});

test('Ascent attacker and defender spawn callouts anchor five clear, separate buy positions',()=>{
 const {Match,SPAWNS,SPAWN_ANCHORS,WALLS}=globalThis.SpikeRules;
 const players=Array.from({length:10},(_,i)=>({id:'player_'+i,teamId:i<5?'team_1':'team_2',hp:100}));
 const match=new Match(()=>players);
 assert(Math.hypot(SPAWN_ANCHORS[0].x/7.5-364,SPAWN_ANCHORS[0].y/7.5-117)<1);
 assert(Math.hypot(SPAWN_ANCHORS[1].x/7.5-278,SPAWN_ANCHORS[1].y/7.5-556)<1);
 for(let side=0;side<2;side++){
  const team=players.slice(side*5,side*5+5),spawn=SPAWNS[side];
  assert.equal(team[0].x,SPAWN_ANCHORS[side].x);assert.equal(team[0].y,SPAWN_ANCHORS[side].y);
  for(const p of team){
   assert(globalThis.SpikeRules.inside(p,spawn));
   assert(!WALLS.some(w=>p.x+15>w.x&&p.x-15<w.x+w.w&&p.y+15>w.y&&p.y-15<w.y+w.h),`spawn collision for ${p.id}`);
  }
  assert.equal(new Set(team.map(p=>`${p.x},${p.y}`)).size,5);
 }
 match.phase='end';match.time=0;match.tick(.05);
 assert.equal(players[0].x,SPAWN_ANCHORS[1].x);
 assert.equal(players[5].x,SPAWN_ANCHORS[0].x);
});

test('general tactics use expiring team reports for rotations and never read hidden defenders',()=>{
 const h=harness();h.run('globalThis.plan=new SpikeTactics.Planner(1,1);plan.site=0;plan.decide(1000,100,SpikeRules.SITES)');
 assert.equal(h.run('plan.decide(15000,80,SpikeRules.SITES).site'),0);
 h.run("plan.report(1,{id:'seen1',...SpikeRules.SITES[0]},16000);plan.report(1,{id:'seen2',...SpikeRules.SITES[0]},16000)");
 assert.equal(h.run('plan.decide(16010,70,SpikeRules.SITES).site'),1);
 assert.equal(h.run('plan.style'),'rotate');
 assert.equal(h.run('plan.known(2,16010).length'),0);
 assert.equal(h.run('plan.known(1,21000).length'),0);
 assert.equal(h.run('plan.decide(21000,20,SpikeRules.SITES).style'),'group');
});
test('general tactical bots plant, select one defuser and stop before shooting',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='host';myPlayer.teamId='team_2';myPlayer.isDead=true;myPlayer.hp=0;aiBots.push({...myPlayer,id:'bot_a',teamId:'team_1',hp:100,isDead:false,weapon:'v_vandal',clipAmmo:25,reserveAmmo:100},{...myPlayer,id:'bot_b',teamId:'team_2',hp:100,isDead:false,weapon:'v_vandal',clipAmmo:25,reserveAmmo:100},{...myPlayer,id:'bot_c',teamId:'team_2',hp:100,isDead:false,weapon:'v_vandal',clipAmmo:25,reserveAmmo:100});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeMatch.time=100;spikeState=spikeMatch.snapshot();chooseBotEnemy=()=>null;Object.assign(aiBots[0],SpikeRules.SITES[0]);spikeMatch.bomb.carrier=aiBots[0].id;SpikeTactics.tick()`);
 assert.equal(h.run('aiBots[0]._spikeUse'),true);
 h.run(`spikeMatch.bomb={...SpikeRules.SITES[0],site:'A',planted:true,carrier:null,timer:40};spikeMatch.phase='planted';spikeState=spikeMatch.snapshot();Object.assign(aiBots[1],SpikeRules.SITES[0]);Object.assign(aiBots[2],SpikeRules.SITES[0]);SpikeTactics.tick()`);
 assert.equal(h.run('aiBots.filter(p=>p.teamId===\'team_2\'&&p._spikeUse).length'),1);
 h.run(`spikeMatch.phase='live';spikeState=spikeMatch.snapshot();globalThis.firedMoving=null;aiBots[1].hp=0;aiBots[2].hp=0;remotePlayers.visible={id:'visible',teamId:'team_2',hp:100,x:aiBots[0].x+150,y:aiBots[0].y};ensureBotBrain(aiBots[0]).aimAngle=0;hasLineOfSight=()=>true;chooseBotEnemy=()=>remotePlayers.visible;updateHumanBotAim=(bot)=>{firedMoving=bot.isMoving};SpikeTactics.tick()`);
 assert.equal(h.run('firedMoving'),false);

});

test('tactical attacker follows Ascent route and completes planting without idle patrol overriding it',()=>{
 const h=harness();h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='3';document.getElementById('aiDifficultySelect').value='easy';hostStartGame();spikeMatch.phase='live';spikeMatch.time=100;myPlayer.isDead=true;myPlayer.hp=0;globalThis.carrier=aiBots.find(p=>p.teamId==='team_'+spikeMatch.attackTeam);spikeMatch.bomb.carrier=carrier.id;chooseBotEnemy=()=>null;spikeState=spikeMatch.snapshot();spikeFrameDt=1/30;`);
 const planted=h.run(`(()=>{for(let i=0;i<2100&&!spikeMatch.bomb.planted;i++){SpikeTactics.tick();spikeMatch.tick(1/30);spikeState=spikeMatch.snapshot();}return spikeMatch.bomb.planted})()`);
 assert.equal(planted,true);
});

test('buy-phase sides include approach geometry, reject cross-barrier movement and permit forward buying',()=>{
 const R=globalThis.SpikeRules,k=R.SIZE/640;
 const a={x:191*k,y:302*k},d={x:464*k,y:403*k};
 assert(!R.prepContains({x:128*k,y:321*k},0));assert(!R.prepContains({x:478*k,y:346*k},0));assert(!R.prepContains({x:288*k,y:250*k},0));
 assert(R.prepContains(a,0));assert(!R.prepContains(a,1));assert(R.prepContains(d,1));assert(!R.prepContains(d,0));
 const {p,m}=live();m.phase='prep';Object.assign(p[0],a);assert(m.canBuy(p[0]));m.tick(.01);assert.equal(p[0].x,a.x);
 Object.assign(p[0],d);m.tick(.01);assert.equal(p[0].x,a.x);
 const h=harness();h.run(`selectedMode='spike';spikeState={phase:'prep',attackTeam:1};myPlayer.teamId='team_1';obstacles=[]`);
 assert.equal(h.run(`checkObstacleCollision(${128*k},${350*k},15)`),true);
 h.run("spikeState.phase='live'");assert.equal(h.run(`checkObstacleCollision(${128*k},${350*k},15)`),false);
});
test('bots select tactical staging goals and reach them before the buy phase ends',()=>{
 const h=harness();h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='5';hostStartGame();spikeFrameDt=1/30;`);
 const result=h.run(`(()=>{for(let i=0;i<840;i++){SpikeTactics.tick();spikeMatch.tick(1/30);spikeState=spikeMatch.snapshot();}return aiBots.map(bot=>({valid:SpikeRules.prepContains(bot,spikePrepSide(bot)),distance:Math.hypot(bot.x-bot._prepGoal.x,bot.y-bot._prepGoal.y),use:bot._spikeUse,state:bot._brain.state}))})()`);
 for(const bot of result){assert(bot.valid);assert(bot.distance<70,JSON.stringify(bot));assert.equal(bot.use,false);assert(bot.state.startsWith('prep_'));}
});

test('mobile joystick chooses two fixed speeds and quiet approaches stop when time is urgent',()=>{
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;isHost=false;isMobile=true;spikeFrameDt=1/60;spikeState={phase:'live'};obstacles=[];myPlayer.hp=100;myPlayer.isDead=false;myPlayer.weapon='v_vandal';updateAI=()=>{};updateNetwork=()=>{}`);
 const step=amount=>h.run(`(()=>{myPlayer.x=1200;myPlayer.y=1200;mobileMoveVec={x:${amount},y:0};originalUpdate();return [myPlayer.x-1200,myPlayer.movementMode]})()`);
 assert.equal(step(.05)[0],0);
 assert(Math.abs(step(.2)[0]-2.16)<1e-8);assert(Math.abs(step(.6)[0]-2.16)<1e-8);assert.equal(step(.2)[1],'stealth');
 assert(Math.abs(step(.61)[0]-3.6)<1e-8);assert(Math.abs(step(1)[0]-3.6)<1e-8);
 assert(h.run("SpikeTactics.quietApproach('live',60,true,false)"));
 assert(h.run("SpikeTactics.quietApproach('live',60,false,true)"));
 assert(!h.run("SpikeTactics.quietApproach('live',15,true,true)"));
 assert(!h.run("SpikeTactics.quietApproach('planted',10,true,true)"));
 assert(!h.run("SpikeTactics.quietApproach('live',60,true,true,true)"));
});

test('semi-auto fire unlocks on release and weapon switching instead of remaining stuck after first shot',()=>{
 const h=harness();h.run(`selectedMode='spike';gameStarted=true;gameEnded=false;isHost=true;spikeState={phase:'live'};myPlayer.hp=100;myPlayer.isDead=false;myPlayer.weapon='v_bucky';myPlayer.clipAmmo=12;myPlayer.isShooting=true;myPlayer.isReloading=false;myPlayer._spikeUse=false;shoot(myPlayer);`);
 assert.equal(h.run('myPlayer.clipAmmo'),11);h.run('shoot(myPlayer)');assert.equal(h.run('myPlayer.clipAmmo'),11);
 h.run(`myPlayer.isShooting=false;gameStarted=false;update();myPlayer.isShooting=true;shoot(myPlayer)`);
 assert.equal(h.run('myPlayer.clipAmmo'),10);
 h.run(`myPlayer.loadout={secondary:{id:'v_operator',clip:15,reserve:60}};myPlayer.activeSlot=null;SpikeRules.equip(myPlayer,'secondary');shoot(myPlayer)`);
 assert.equal(h.run('myPlayer.clipAmmo'),14);
});

test('individual bot tendencies stay stable while routes and combat rhythms differ between identities',()=>{
 const h=harness();const profiles=h.run(`Array.from({length:12},(_,i)=>SpikeTactics.profile('bot_'+i))`);
 assert.equal(new Set(profiles.map(p=>p.cycle)).size,12);
 assert.equal(new Set(profiles.map(p=>p.startDelay)).size,12);
 assert.equal(new Set(profiles.map(p=>p.angle)).size,12);
 assert(new Set(profiles.map(p=>p.role)).size>=3);
 assert.deepEqual(h.run(`SpikeTactics.profile('bot_4')`),profiles[4]);
 for(const p of profiles){assert(p.tempo<=1&&p.tempo>=.88);assert(p.step+p.settle<p.cycle);}
});

test('adaptive bot navigation leaves wall corners and avoids crowding without teleporting',()=>{
 const h=harness();h.run(`selectedMode='spike';isHost=true;gameStarted=true;WORLD_SIZE=4800;obstacles=[{x:1300,y:900,w:100,h:500}];spikeFrameDt=1/60;globalThis.walker={...myPlayer,id:'bot_walk',teamId:'team_1',x:1250,y:1200,hp:100,isDead:false,weapon:'v_vandal'};globalThis.goal={x:1500,y:1200};aiBots.push(walker);myPlayer.teamId='team_2';myPlayer.isDead=true;`);
 const result=h.run(`(()=>{const brain=ensureBotBrain(walker);let maxStep=0,collisions=0;for(let i=0;i<700;i++){const old={x:walker.x,y:walker.y};SpikeTactics.move(walker,brain,goal);maxStep=Math.max(maxStep,Math.hypot(walker.x-old.x,walker.y-old.y));if(oldBotCollision(walker.x,walker.y,15))collisions++;}return {remaining:Math.hypot(walker.x-goal.x,walker.y-goal.y),maxStep,collisions,x:walker.x,y:walker.y,path:walker._navigation.path,blocked:walker._navigation.blocked}})()`);
 assert(result.remaining<30,JSON.stringify(result));assert(result.maxStep<=3.600001);assert.equal(result.collisions,0);
 h.run(`globalThis.ally={...walker,id:'bot_ally',x:walker.x,y:walker.y};aiBots.push(ally);walker._navCrowd=null;`);
 assert(h.run('SpikeTactics.routeCost(walker,walker)')>0);
});

test('bots sharing a destination maintain personal space along the approach',()=>{
 const h=harness();h.run(`selectedMode='spike';isHost=true;WORLD_SIZE=4800;obstacles=[];spikeFrameDt=1/60;myPlayer.isDead=true;myPlayer.hp=0;aiBots.push({...myPlayer,id:'bot_left',teamId:'team_1',x:1200,y:1200,hp:100,isDead:false,weapon:'v_vandal'},{...myPlayer,id:'bot_right',teamId:'team_1',x:1200,y:1200,hp:100,isDead:false,weapon:'v_vandal'});`);
 const separation=h.run(`(()=>{for(let i=0;i<60;i++)for(const bot of aiBots)SpikeTactics.move(bot,ensureBotBrain(bot),{x:1800,y:1200});return Math.hypot(aiBots[0].x-aiBots[1].x,aiBots[0].y-aiBots[1].y)})()`);
 assert(separation>20,`separation ${separation}`);
});

test('teammates reserve distinct site angles, retain them while moving, and reuse a fallen ally lane',()=>{
 const h=harness();h.run(`selectedMode='spike';obstacles=SpikeRules.WALLS.map(p=>({...p}));globalThis.squad=Array.from({length:5},(_,i)=>({...myPlayer,id:'bot_angle_'+i,teamId:'team_1',hp:100,isDead:false,x:SpikeRules.SITES[0].x,y:SpikeRules.SITES[0].y}));globalThis.angles=squad.map(bot=>SpikeTactics.assignAngle(bot,'angle:A',SpikeTactics.angleOptions('A'),squad));`);
 assert.equal(h.run('new Set(angles.map(p=>p.id)).size'),5);
 assert.equal(h.run('new Set(angles.map(p=>`${p.target.x},${p.target.y}`)).size'),5);
 assert.equal(h.run('new Set(angles.map(p=>`${p.position.x},${p.position.y}`)).size'),5);
 assert(h.run('angles.every(p=>!oldBotCollision(p.position.x,p.position.y,18))'));
 h.run(`squad[0].x+=300;squad[0].y+=200;globalThis.again=SpikeTactics.assignAngle(squad[0],'angle:A',SpikeTactics.angleOptions('A'),squad)`);
 assert.equal(h.run('again.id'),h.run('angles[0].id'));
 h.run(`squad[1].isDead=true;globalThis.newcomer={...squad[1],id:'bot_new',isDead:false};squad.push(newcomer);globalThis.replacement=SpikeTactics.assignAngle(newcomer,'angle:A',SpikeTactics.angleOptions('A'),squad)`);
 assert.equal(h.run('replacement.id'),h.run('angles[1].id'));
});

test('pre-round opponents are hidden with silent footsteps and private spawn coordinates',()=>{
 const h=harness();h.run(`selectedMode='spike';spikeState={phase:'prep',attackTeam:1};myPlayer.id='me';myPlayer.teamId='team_1';myPlayer.hp=100;myPlayer.isDead=false;globalThis.enemy={...myPlayer,id:'opponent',teamId:'team_2',x:myPlayer.x+20,y:myPlayer.y};remotePlayers.opponent=enemy;hasLineOfSight=()=>true;`);
 assert.equal(h.run('shouldRenderCombatEntityToLocal(enemy)'),false);
 assert.equal(h.run("spikeCanHearStep(myPlayer,{entityId:'opponent'})"),false);
 assert.equal(h.run("spikeCanHearStep(myPlayer,{entityId:'me'})"),true);
 h.run("spikeState.phase='live'");assert.equal(h.run('shouldRenderCombatEntityToLocal(enemy)'),true);assert.equal(h.run("spikeCanHearStep(myPlayer,{entityId:'opponent'})"),true);
 const players=actors(),match=new Match(()=>players),snap=match.snapshot(players[0]);assert(snap.spawns.a);assert.equal(snap.spawns.b,undefined);
});
test('bot fire rechecks the live enemy behind walls and outside its current field of view',()=>{
 const h=harness();h.run(`selectedMode='spike';spikeState={phase:'live'};isHost=true;myPlayer.id='target';myPlayer.teamId='team_2';myPlayer.hp=100;myPlayer.isDead=false;myPlayer.x=1400;myPlayer.y=1200;globalThis.bot={...myPlayer,id:'bot_vision',teamId:'team_1',x:1200,y:1200,angle:0,weapon:'v_vandal',clipAmmo:25,isReloading:false,_brain:{targetId:'target'}};aiBots.push(bot);obstacles=[{type:'wall',x:1300,y:1100,w:20,h:200}];shoot(bot);`);
 assert.equal(h.run('bot.clipAmmo'),25);
 h.run(`obstacles=[];myPlayer.x=1100;shoot(bot)`);assert.equal(h.run('bot.clipAmmo'),25);
 h.run(`myPlayer.x=1400;shoot(bot)`);assert.equal(h.run('bot.clipAmmo'),24);
});

test('a shared angle is capped at two bots and overflow trades or lurks',()=>{
 const h=harness();h.run(`selectedMode='spike';spikeState={phase:'live'};spikeMatch={round:1};myPlayer.hp=0;myPlayer.isDead=true;obstacles=[];aiBots.push(...Array.from({length:12},(_,i)=>({...myPlayer,id:'bot_cap_'+i,teamId:'team_1',x:1200,y:1200,hp:100,isDead:false,angle:0,weapon:'v_vandal'})));for(const bot of aiBots)SpikeTactics.watch(bot,ensureBotBrain(bot),{x:1600,y:1200},1/60);`);
 assert.equal(h.run('aiBots.filter(p=>Math.abs(p._aimClaim.angle)<.01).length'),2);
 assert.equal(h.run("aiBots.filter(p=>p._angleOverflow&&['trade_support','angle_lurk'].includes(p._angleOverflow.role)).length"),10);
 h.run(`aiBots[0].isDead=true;globalThis.available=SpikeTactics.reserveAim(aiBots[3],{x:1600,y:1200})`);assert.equal(h.run('available'),true);
});
test('visible enemy combat also caps teammates firing from the same angle',()=>{
 const h=harness();h.run(`selectedMode='spike';isHost=true;myPlayer.id='human_enemy';myPlayer.teamId='team_2';myPlayer.hp=100;myPlayer.isDead=false;aiBots.push(...Array.from({length:6},(_,i)=>({...myPlayer,id:'bot_firecap_'+i,teamId:'team_1',weapon:'v_vandal',clipAmmo:25})));spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeMatch.time=90;spikeState=spikeMatch.snapshot();myPlayer.x=1400;myPlayer.y=1200;for(const bot of aiBots){bot.x=1200;bot.y=1200;bot.angle=0}obstacles=[];chooseBotEnemy=()=>({id:myPlayer.id,x:myPlayer.x,y:myPlayer.y});globalThis.attempts=[];updateHumanBotAim=bot=>attempts.push(bot.id);SpikeTactics.tick();`);
 assert.equal(h.run('attempts.length'),2);
 assert.equal(h.run('aiBots.filter(p=>p._angleOverflow).length'),4);
});
test('spectator switches both ways across modes, ignores hidden snapshots and updates camera',()=>{
 for(const mode of ['spike','br','normal']){const h=harness();h.run(`selectedMode='${mode}';myPlayer.id='viewer';myPlayer.isDead=true;myPlayer.hp=0;isSpectating=true;spectatorIds.add('viewer');remotePlayers.a={id:'a',name:'A',x:100,y:200,hp:100};aiBots.push({id:'bot_b',name:'B',x:800,y:900,hp:100},{id:'bot_hidden',hp:100,hiddenPrep:true,x:-10000,y:-10000});findNextSpectateTarget();`);
 assert.equal(h.run('spectateTarget.id'),'a');h.run('findNextSpectateTarget(1)');assert.equal(h.run('spectateTarget.id'),'bot_b');assert.equal(h.run('camera.x'),800);
 h.run('findNextSpectateTarget(-1)');assert.equal(h.run('spectateTarget.id'),'a');h.run("remotePlayers.a={...remotePlayers.a,x:300};findNextSpectateTarget(1);findNextSpectateTarget(1)");assert.equal(h.run('camera.x'),300);
 h.run('remotePlayers.a.hp=0;findNextSpectateTarget()');assert.equal(h.run('spectateTarget.id'),'bot_b');h.run('aiBots[0].isDead=true;findNextSpectateTarget()');assert.equal(h.run('spectateTarget'),null);
 assert(h.html.includes('width:100%;height:100%;z-index:35'));assert(h.html.includes("e.key==='ArrowLeft'"));
 }
});
test('defense patrol changes position on a bounded cycle and refuses blocked peeks',()=>{
 const h=harness();h.run(`globalThis.patrolBot={id:'bot_patrol',x:1000,y:1000};globalThis.slot={id:'test',position:{x:1000,y:1000},target:{x:1500,y:1000}};checkBotNavigationCollision=()=>false;botSegmentClear=()=>true;globalThis.first=SpikeTactics.patrolGoal(patrolBot,slot,.05);for(let i=0;i<50;i++)SpikeTactics.patrolGoal(patrolBot,slot,.05);globalThis.second=SpikeTactics.patrolGoal(patrolBot,slot,.05);`);
 assert(h.run('Math.hypot(first.x-second.x,first.y-second.y)>100'));
 h.run('checkBotNavigationCollision=()=>true;patrolBot._patrol=null');assert.equal(h.run('SpikeTactics.patrolGoal(patrolBot,slot,.05).x'),1000);
});

test('unarmored full health dies to one sniper plus one pistol shot, armor still absorbs',()=>{
 const p=actors(),m=new Match(()=>p),target=p[1];const hit=id=>{const b={weapon:id,startX:target.x,startY:target.y};target.hp-=SpikeRules.shieldDamage(target,SpikeRules.bulletDamage(b,target));};
 hit('v_operator');assert.equal(target.hp,18);hit('v_classic');assert.equal(target.hp,0);target.hp=100;target.shieldType='heavy';target.shield=50;hit('v_operator');hit('v_classic');assert(target.hp>0);
});

test('all shield types take full damage first and only overflow reaches HP',()=>{
 for(const type of ['light','heavy','regen']){const a={shieldType:type,shield:25,hp:100};assert.equal(SpikeRules.shieldDamage(a,18),0);assert.equal(a.shield,7);assert.equal(SpikeRules.shieldDamage(a,18),11);assert.equal(a.shield,0);assert.equal(SpikeRules.shieldDamage(a,18),18);}
 const h=harness();assert(h.html.includes("ctx.fillStyle='#389cff'"));h.run(`selectedMode='spike';gameStarted=true;myPlayer.hp=100;myPlayer.maxHp=100;myPlayer.shieldType='heavy';myPlayer.shield=50;spikeState={round:1,phase:'live',time:100,attackTeam:1,score:[0,0],bomb:{}};spikeUI()`);assert.equal(h.run("document.getElementById('spikeShieldFill').style.width"),(50/150*100)+'%');
});
test('attack entry waits at most one second after firing and advances despite persistent visible enemy',()=>{
 const h=harness();h.run(`globalThis.entryBot={};globalThis.visibleEnemy={id:'enemy'};`);assert(h.run('SpikeTactics.entryWindow(entryBot,visibleEnemy,.05)'));
 for(const wait of [0,.25,.99]){h.run(`entryBot._entryFight={wait:${wait},advance:0}`);let ticks=0;while(h.run('SpikeTactics.entryWindow(entryBot,visibleEnemy,.05)')&&ticks<25)ticks++;assert(ticks<=20);assert(h.run('entryBot._entryFight.advance>0'));assert.equal(h.run('SpikeTactics.entryWindow(entryBot,visibleEnemy,.05)'),false);}
});
test('defenders share only audible enemy footsteps and rotate to their site, including far anchors',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='attacker';myPlayer.teamId='team_1';aiBots.push({...myPlayer,id:'bot_1',teamId:'team_2',hp:100,isDead:false},{...myPlayer,id:'bot_2',teamId:'team_2',hp:100,isDead:false});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeState=spikeMatch.snapshot();chooseBotEnemy=()=>null;spikeFrameDt=.05;SpikeTactics.tick();Object.assign(aiBots[0],SpikeRules.SITES[0]);Object.assign(aiBots[1],SpikeRules.SITES[1]);footstepEvents.push({id:1,entityId:'attacker',...SpikeRules.SITES[0],range:200,time:Date.now()});SpikeTactics.tick();`);
 assert.equal(h.run("aiBots.every(b=>b._brain.state==='defense_support')"),true);assert.equal(h.run("aiBots[1]._angleHold.key.endsWith(':A')"),true);
 h.run(`globalThis.radio=new SpikeTactics.Planner(1,1);radio.hear(2,{x:1,y:2,time:1000});`);assert.equal(h.run('radio.heard(1,1100)'),null);assert.equal(h.run('radio.heard(2,6000)'),null);
 h.run(`footstepEvents.length=0;aiBots.forEach(b=>{b._angleOverflow=null});spikeMatch.round++;spikeState=spikeMatch.snapshot();footstepEvents.push({id:2,entityId:'attacker',x:0,y:0,range:1,time:Date.now()});SpikeTactics.tick()`);assert.equal(h.run("aiBots.some(b=>b._brain.state==='defense_support')"),false);
});
test('defender under fire holds ground and attempts fire instead of seeking cover',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='attacker';myPlayer.teamId='team_1';aiBots.push({...myPlayer,id:'bot_guard',teamId:'team_2',hp:100,isDead:false});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeState=spikeMatch.snapshot();chooseBotEnemy=()=>myPlayer;spikeFrameDt=.05;SpikeTactics.tick();Object.assign(aiBots[0],{x:1000,y:1000,hp:10,angle:0});Object.assign(myPlayer,{x:1200,y:1000});aiBots[0]._brain.lastHp=100;globalThis.fireAttempts=0;findBotCoverPoint=()=>{throw Error('unnecessary retreat')};updateHumanBotAim=()=>fireAttempts++;SpikeTactics.tick();`);
 assert.equal(h.run('fireAttempts'),1);assert.equal(h.run('aiBots[0]._brain.state'),'tactical_burst');
});
test('attacking bot closes from visible but out-of-range enemy and fires actual bullets',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='defender';myPlayer.teamId='team_2';aiBots.push({...myPlayer,id:'bot_entry',teamId:'team_1',hp:100,isDead:false});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeState=spikeMatch.snapshot();spikeFrameDt=.05;globalThis.clock=100000;Date.now=()=>clock;obstacles=[];hasLineOfSight=()=>true;checkBotNavigationCollision=()=>false;botSegmentClear=()=>true;Object.assign(myPlayer,{x:2500,y:1000,hp:100,isDead:false});Object.assign(aiBots[0],{x:1100,y:1000,angle:0});ensureBotBrain(aiBots[0]).aimAngle=0;for(let i=0;i<160;i++){clock+=50;SpikeTactics.tick();}`);
 assert(h.run('bullets.length>0'),'attacker must fire within eight seconds, not stop outside firing range');
});
test('attacking bot steps around a friendly blocker and fires actual bullets',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='defender';myPlayer.teamId='team_2';aiBots.push({...myPlayer,id:'bot_entry',teamId:'team_1',hp:100,isDead:false});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeState=spikeMatch.snapshot();spikeFrameDt=.05;globalThis.clock=100000;Date.now=()=>clock;obstacles=[];hasLineOfSight=()=>true;checkBotNavigationCollision=()=>false;botSegmentClear=()=>true;Object.assign(myPlayer,{x:2500,y:1000,hp:100,isDead:false});Object.assign(aiBots[0],{x:1700,y:1000,angle:0});remotePlayers.ally={id:'ally',teamId:'team_1',hp:100,x:2100,y:1000};ensureBotBrain(aiBots[0]).aimAngle=0;for(let i=0;i<160;i++){clock+=50;SpikeTactics.tick();}`);
 assert(h.run('bullets.length>0'),'attacker must clear the friendly fire lane and shoot');
});
test('first visible target stays locked until occluded, out of view, dead or disconnected',()=>{
 const h=harness();h.run(`selectedMode='spike';myPlayer.id='me';myPlayer.teamId='team_2';myPlayer.hp=0;aiBots.push({id:'bot_focus',teamId:'team_1',x:1000,y:1000,hp:100,weapon:'v_vandal',angle:0});remotePlayers.first={id:'first',teamId:'team_2',x:1600,y:1000,hp:100};remotePlayers.second={id:'second',teamId:'team_2',x:1200,y:1000,hp:100};globalThis.b=aiBots[0];globalThis.brain=ensureBotBrain(b);brain.aimAngle=0;hasLineOfSight=()=>true;chooseBotEnemy=()=>remotePlayers.first;`);
 assert.equal(h.run('SpikeTactics.focusedEnemy(b,brain).id'),'first');h.run('chooseBotEnemy=()=>remotePlayers.second');assert.equal(h.run('SpikeTactics.focusedEnemy(b,brain).id'),'first');
 h.run('hasLineOfSight=(a,t)=>t.id!=="first"');assert.equal(h.run('SpikeTactics.focusedEnemy(b,brain).id'),'second');
 h.run('hasLineOfSight=()=>true;remotePlayers.second.hp=0;chooseBotEnemy=()=>remotePlayers.first');assert.equal(h.run('SpikeTactics.focusedEnemy(b,brain).id'),'first');
 h.run('remotePlayers.first.x=500;remotePlayers.second.hp=100;chooseBotEnemy=()=>remotePlayers.second');assert.equal(h.run('SpikeTactics.focusedEnemy(b,brain).id'),'second');
 h.run('delete remotePlayers.second;chooseBotEnemy=()=>null');assert.equal(h.run('SpikeTactics.focusedEnemy(b,brain)'),null);
});
test('five attackers keep returning fire while advancing against two defenders',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='observer';myPlayer.hp=0;myPlayer.isDead=true;spectatorIds.add(myPlayer.id);for(let i=0;i<7;i++)aiBots.push({...myPlayer,id:'bot_'+i,teamId:i<5?'team_1':'team_2',hp:100,isDead:false});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeState=spikeMatch.snapshot();spikeFrameDt=.05;globalThis.clock=100000;Date.now=()=>clock;Math.random=()=>.5;obstacles=[];hasLineOfSight=()=>true;checkBotNavigationCollision=()=>false;botSegmentClear=()=>true;for(let i=0;i<7;i++){Object.assign(aiBots[i],{x:i<5?1600:2250,y:1200+(i<5?i: i-5)*90,angle:i<5?0:Math.PI,weapon:'v_vandal',clipAmmo:1000,reserveAmmo:0});ensureBotBrain(aiBots[i]).aimAngle=aiBots[i].angle;}globalThis.advanceShots=0;globalThis.attackShots=0;const realShoot=shoot;shoot=(p,...args)=>{const ammo=p.clipAmmo;realShoot(p,...args);if(p.clipAmmo<ammo&&p.teamId==='team_1'){attackShots++;if(p._entryFight?.advance>0)advanceShots++;}};for(let i=0;i<160;i++){clock+=50;SpikeTactics.tick();}`);
 console.log('5v2 firing diagnostic',h.run('JSON.stringify({attackShots,advanceShots})'));
 assert(h.run('advanceShots>0'),'attackers must not cease firing for their entire advance window');
});
test('random role assignment keeps a carrier out of silent lurk and assigns trade teammates',()=>{
 const h=harness();h.run(`globalThis.roster=Array.from({length:5},(_,i)=>({id:'bot_'+i,teamId:'team_1',hp:100}));Math.random=()=>0;SpikeTactics.assignRoles(roster,'bot_0');globalThis.firstRoles=roster.map(b=>b._tacticOrder).join(',');`);
 assert.equal(h.run("roster.filter(b=>b._roundRole==='lurk').length"),1);assert.equal(h.run("roster.find(b=>b.id==='bot_0')._roundRole==='lurk'"),false);assert(h.run("roster.some(b=>b._roundRole==='trade')"));
 h.run(`Math.random=()=>.99;SpikeTactics.assignRoles(roster,'bot_0')`);assert.notEqual(h.run("roster.map(b=>b._tacticOrder).join(',')"),h.run('firstRoles'));
 h.run(`Math.random=()=>0;globalThis.a=new SpikeTactics.Planner(1,1);Math.random=()=>.99;globalThis.b=new SpikeTactics.Planner(1,1)`);assert.notEqual(h.run('a.site'),h.run('b.site'));assert.notEqual(h.run('a.style'),h.run('b.style'));
});
test('assigned lurker approaches quietly and does not emit audible footsteps',()=>{
 const h=harness();h.run(`isHost=true;selectedMode='spike';myPlayer.id='host';myPlayer.teamId='team_2';aiBots.push({...myPlayer,id:'bot_lurk',teamId:'team_1',hp:100,isDead:false});spikeMatch=new SpikeRules.Match(spikeActors);spikeMatch.phase='live';spikeState=spikeMatch.snapshot();spikeFrameDt=.05;chooseBotEnemy=()=>null;SpikeTactics.tick();aiBots[0]._roundRole='lurk';spikeMatch.bomb.carrier='other';aiBots[0]._laneChoice=null;aiBots[0]._tacticRoute=null;aiBots[0]._angleOverflow=null;SpikeTactics.tick();`);
 assert.equal(h.run('aiBots[0].movementMode'),'stealth');assert.equal(h.run('footstepAudible(aiBots[0],aiBots[0].moveSpeed*40)'),false);
});
