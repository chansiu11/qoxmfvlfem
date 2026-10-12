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
 function el(){return {style:{setProperty:noop},dataset:{},classList:{add:noop,remove:noop},value:'',clientWidth:1000,clientHeight:600,addEventListener:noop,appendChild:noop,replaceChildren:noop,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};}
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
 vm.runInContext('render=()=>{};updateHUD=()=>{};',c);
 return {run:s=>vm.runInContext(s,c),html};
}
test('actual packed game starts objective match; other map modes and original mobile controls remain',()=>{
 const h=harness();assert(h.html.includes('value="spike"'));assert(!h.html.includes('id="btnFire"'));
 h.run(`isHost=true;document.getElementById('gameModeSelect').value='spike';document.getElementById('aiToggle').value='true';document.getElementById('aiCountInput').value='1';document.getElementById('aiDifficultySelect').value='easy';hostStartGame();`);
 assert.equal(h.run('gameStarted'),true);assert.equal(h.run('WORLD_SIZE'),2400);assert.equal(h.run('spikeMatch.phase'),'prep');assert.equal(h.run('spikeActors().length'),2);
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
 assert.equal(guest.run('myPlayer.teamId'),'team_2');assert(guest.run('myPlayer.x>1960'));
 host.run(`handleNetworkData({type:'SPIKE_WEAPON',player:{id:'guest'},weapon:'shotgun'});lastHostSyncAt=0;updateNetwork();`);
 guest.run(`handleNetworkData(${host.run('out.at(-1)')})`);assert.equal(guest.run('myPlayer.weapon'),'shotgun');
 host.run(`remotePlayers.guest.hp=80;handleNetworkData({type:'SYNC',player:{id:'guest',_spikeRound:1,x:2100,y:1200,hp:200,isDead:false}});`);assert.equal(host.run('remotePlayers.guest.hp'),80);
 host.run(`spikeMatch.begin();spikeState=spikeMatch.snapshot();spikeApply(spikeState);lastHostSyncAt=0;updateNetwork();`);
 guest.run(`myPlayer.isDead=true;isSpectating=true;handleNetworkData(${host.run('out.at(-1)')})`);
 assert.equal(guest.run('spikeAppliedRound'),2);assert.equal(guest.run('myPlayer.hp'),200);assert.equal(guest.run('isSpectating'),false);assert(guest.run('myPlayer.x<440'));
});
test('unplanted spike and planting progress are private to attackers; planted spike is public',()=>{
 const {p,m}=live();m.actor=p[0].id;m.progress=2;
 assert.equal(m.snapshot(p[0]).bomb.carrier,'a');
 for(const viewer of [p[1],{teamId:'spectator'}]){const s=m.snapshot(viewer);assert.equal(s.bomb.hidden,true);assert.equal(s.bomb.x,undefined);assert.equal(s.bomb.carrier,undefined);assert.equal(s.actor,null);assert.equal(s.progress,0);}
 m.bomb.planted=true;assert.equal(m.snapshot(p[1]).bomb.x,m.bomb.x);
 m.begin();assert.equal(m.snapshot(p[0]).bomb.hidden,true);assert.equal(m.snapshot(p[1]).bomb.carrier,'b');
});
test('maze has connected sites/spawns, dead ends, no four-way intersections and clear passages',()=>{
 const {LINKS,WALLS,SITES,SPAWNS}=SpikeRules,adj=Array.from({length:36},()=>[]);
 for(const [a,b] of LINKS){adj[a].push(b);adj[b].push(a);}
 const seen=new Set([0]),queue=[0];while(queue.length)for(const b of adj[queue.shift()])if(!seen.has(b)){seen.add(b);queue.push(b);}
 assert.equal(seen.size,36);assert(adj.every(a=>a.length<=3));assert(adj.some(a=>a.length===1));assert(WALLS.length>16);
 const clear=(x,y)=>WALLS.every(w=>x+18<=w.x||x-18>=w.x+w.w||y+18<=w.y||y-18>=w.y+w.h);
 for(const s of SITES)assert(clear(s.x,s.y));
 for(const r of SPAWNS)for(let x=r.x+20;x<=r.x+r.w-20;x+=20)for(let y=r.y+20;y<=r.y+r.h-20;y+=20)assert(clear(x,y));
 for(const [a,b] of LINKS){const ax=a%6*400+200,ay=Math.floor(a/6)*400+200,bx=b%6*400+200,by=Math.floor(b/6)*400+200;for(let t=0;t<=1;t+=.025)assert(clear(ax+(bx-ax)*t,ay+(by-ay)*t));}
});
test('host rendering hides preplant marker for defenders and shows it after planting',()=>{
 const h=harness();h.run(`selectedMode='spike';myPlayer.teamId='team_2';spikeState={attackTeam:1,bomb:{x:900,y:900,planted:false}};globalThis.marks=0;globalThis.mapctx={save(){},restore(){},scale(){},fillRect(x,y,w,h){if(w===24&&h===24)marks++},strokeRect(){},fillText(){},beginPath(){},arc(){},fill(){},stroke(){}};drawSpikeMap(mapctx);`);assert.equal(h.run('marks'),0);
 h.run(`spikeState.bomb.planted=true;drawSpikeMap(mapctx)`);assert.equal(h.run('marks'),1);
});
test('actual player and bot movement is halved only in general mode',()=>{
 const h=harness();h.run(`gameStarted=true;gameEnded=false;isHost=false;isMobile=false;obstacles=[];keys['d']=true;updateAI=()=>{};updateNetwork=()=>{};myPlayer.isDead=false;myPlayer.hp=200;`);
 for(const stance of ['walk','sprint','stealth']){
  h.run(`keys['shift']=${stance==='sprint'};keys['control']=${stance==='stealth'};`);
  const distances=['normal','spike'].map(mode=>h.run(`selectedMode='${mode}';myPlayer.x=1200;myPlayer.y=1200;originalUpdate();myPlayer.x-1200`));
  assert(distances[0]>0);assert.equal(distances[1],distances[0]/2);
 }
 const distances=['normal','spike'].map(mode=>h.run(`selectedMode='${mode}';globalThis.testbot={id:'bot_test',x:1200,y:1200};walkBotRoute(testbot,{x:1300,y:1200},3);testbot.x-1200`));assert.equal(distances[1],distances[0]/2);assert(distances[1]>0);
});
