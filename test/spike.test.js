import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';
import '../public/spike-rules.js';
const {Match,SITES,SPAWNS}=globalThis.SpikeRules;
const actors=()=>[{id:'a',teamId:'team_1',hp:200,weapon:'ar'},{id:'b',teamId:'team_2',hp:200,weapon:'ar'}];
function tick(m,n){for(let i=0;i<Math.ceil(n/.05);i++)m.tick(.05);}
function live(){const p=actors(),m=new Match(()=>p);tick(m,15.1);return {p,m};}
test('15-second prep confines teams to spawn and only permits valid pre-round weapons',()=>{const p=actors(),m=new Match(()=>p);assert(m.choose(p[0],'sniper'));assert.equal(p[0].clipAmmo,5);p[0].x=900;assert.equal(m.choose(p[0],'shotgun'),false);m.tick(.05);assert(p[0].x<=SPAWNS[0].x+SPAWNS[0].w-20);tick(m,15.1);assert.equal(m.phase,'live');assert.equal(m.choose(p[0],'ar'),false);});
test('plant requires carrying the spike, a site and four seconds without moving',()=>{const {p,m}=live();const a=p[0];a._spikeUse=true;tick(m,5);assert(!m.bomb.planted);Object.assign(a,{x:SITES[0].x,y:SITES[0].y});tick(m,2);a.isMoving=true;m.tick(.05);assert.equal(m.progress,0);a.isMoving=false;tick(m,4.1);assert(m.bomb.planted);assert.equal(m.bomb.site,'A');assert.equal(m.phase,'planted');});
test('seven-second defuse wins, next round respawns both teams and switches sides',()=>{const {p,m}=live();Object.assign(p[0],{x:SITES[1].x,y:SITES[1].y,_spikeUse:true});tick(m,4.1);Object.assign(p[1],{x:m.bomb.x,y:m.bomb.y,_spikeUse:true});tick(m,7.1);assert.equal(m.phase,'end');assert.equal(m.score[1],1);p[0].hp=0;p[0].isDead=true;tick(m,6.1);assert.equal(m.round,2);assert.equal(m.phase,'prep');assert.equal(m.attackTeam,2);assert.equal(p[0].hp,200);assert.equal(p[0].isDead,false);});
test('planted spike survives attackers dying, explodes; no-plant timeout favors defenders',()=>{let {p,m}=live();Object.assign(p[0],{x:SITES[0].x,y:SITES[0].y,_spikeUse:true});tick(m,4.1);p[0].hp=0;p[0].isDead=true;tick(m,1);assert.equal(m.phase,'planted');tick(m,45);assert.equal(m.score[0],1);({m}=live());tick(m,100.1);assert.equal(m.score[1],1);});
test('dead/disconnected carrier drops spike for living attacking teammate',()=>{const p=actors();p.push({id:'c',teamId:'team_1',hp:200});const m=new Match(()=>p);tick(m,15.1);const {x,y}=p[0];p[0].hp=0;Object.assign(p[2],{x,y});m.tick(.05);assert.equal(m.bomb.carrier,'c');p.splice(2,1);m.tick(.05);assert.equal(m.bomb.carrier,null);});
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
 vm.runInContext(fs.readFileSync(new URL('../public/spike-rules.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../public/spike-mode.js',import.meta.url),'utf8'),c);
 vm.runInContext(fs.readFileSync(new URL('../public/game-audio.js',import.meta.url),'utf8'),c);
 vm.runInContext('render=()=>{};updateHUD=()=>{};',c);
 return {run:s=>vm.runInContext(s,c),html};
}
test('actual packed game starts objective match; other map modes and original mobile controls remain',()=>{
 const h=harness();assert(h.html.includes('value="spike"'));assert(!h.html.includes('id="btnFire"'));
 h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='1';document.getElementById('aiDifficultySelect').value='easy';hostStartGame();`);
 assert.equal(h.run('gameStarted'),true);assert.equal(h.run('WORLD_SIZE'),3600);assert.equal(h.run('spikeMatch.phase'),'prep');assert.equal(h.run('spikeActors().length'),2);
 h.run(`spikeChoose('sniper')`);assert.equal(h.run('myPlayer.weapon'),'sniper');
 assert.equal(h.run(`generateMapData('normal',123).worldSize`),2400);assert(h.run(`generateMapData('br',123).obstacles.some(o=>o.type==='house')`));
 h.run(`spikeMatch.time=0;spikeMatch.tick(.05);spikeState=spikeMatch.snapshot();handleNetworkData({type:'SPIKE_WEAPON',player:{id:myPlayer.id},weapon:'ar'});`);assert.equal(h.run('myPlayer.weapon'),'sniper');
 h.run('returnToRoomAfterGame()');assert.equal(h.run('spikeMatch'),null);
});
test('host/guest snapshots agree on spawn, weapon choice, locked combat health and next-round respawn',()=>{
 const host=harness(),guest=harness();
 host.run(`globalThis.out=[];isHost=true;myPlayer.id='host';remotePlayers.guest={...myPlayer,id:'guest',name:'Guest'};connections.guest={open:true,playerId:'guest',dataChannel:{bufferedAmount:0},send:p=>out.push(JSON.stringify(p))};document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='false';document.getElementById('aiCountInput').value='0';hostStartGame();lastHostSyncAt=0;updateNetwork();`);
 guest.run(`isHost=false;myPlayer.id='guest';`);
 const packets=host.run('out.slice()');for(const data of packets)guest.run(`handleNetworkData(${data})`);
 assert.equal(guest.run('selectedMode'),'spike');assert.equal(guest.run('spikeAppliedRound'),1);
 assert.equal(guest.run('myPlayer.teamId'),'team_2');assert(guest.run('SpikeRules.inside(myPlayer,SpikeRules.SPAWNS[1])'));
 host.run(`handleNetworkData({type:'SPIKE_WEAPON',player:{id:'guest'},weapon:'shotgun'});lastHostSyncAt=0;updateNetwork();`);
 guest.run(`handleNetworkData(${host.run('out.at(-1)')})`);assert.equal(guest.run('myPlayer.weapon'),'shotgun');
 host.run(`remotePlayers.guest.hp=80;handleNetworkData({type:'SYNC',player:{id:'guest',_spikeRound:1,x:2100,y:1200,hp:200,isDead:false}});`);assert.equal(host.run('remotePlayers.guest.hp'),80);
 host.run(`spikeMatch.begin();spikeState=spikeMatch.snapshot();spikeApply(spikeState);lastHostSyncAt=0;updateNetwork();`);
 guest.run(`myPlayer.isDead=true;isSpectating=true;handleNetworkData(${host.run('out.at(-1)')})`);
 assert.equal(guest.run('spikeAppliedRound'),2);assert.equal(guest.run('myPlayer.hp'),200);assert.equal(guest.run('isSpectating'),false);assert(guest.run('SpikeRules.inside(myPlayer,SpikeRules.SPAWNS[0])'));
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
test('general-mode movement scales with enlarged map and still disables sprint',()=>{
 const h=harness();h.run(`gameStarted=true;gameEnded=false;isHost=false;isMobile=false;obstacles=[];keys['d']=true;updateAI=()=>{};updateNetwork=()=>{};myPlayer.isDead=false;myPlayer.hp=200;`);
 for(const stance of ['walk','sprint','stealth']){
  h.run(`keys['shift']=${stance==='sprint'};keys['control']=${stance==='stealth'};`);
  const distances=['normal','spike'].map(mode=>h.run(`selectedMode='${mode}';myPlayer.x=1200;myPlayer.y=1200;originalUpdate();myPlayer.x-1200`));
  assert(distances[0]>0);assert.equal(distances[1],stance==='sprint'?2.25:distances[0]*.75);
 }
 const distances=['normal','spike'].map(mode=>h.run(`selectedMode='${mode}';globalThis.testbot={id:'bot_test',x:1200,y:1200};walkBotRoute(testbot,{x:1300,y:1200},3);testbot.x-1200`));assert.equal(distances[1],distances[0]*.75);assert(distances[1]>0);
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
