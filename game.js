import {randomBytes} from 'node:crypto';
import {WORLD,WALLS,SITES,SPAWNS,WEAPONS,clamp,dist,blocked,rayWall,visible,pathTo} from './public/shared.js';
export class Room{
 constructor({mode='private',name='작전실',bots=true}={}){this.code=randomBytes(3).toString('hex').toUpperCase();this.mode=mode;this.name=name;this.fillBots=bots;this.players=new Map();this.host=null;this.phase='lobby';this.time=0;this.round=0;this.score=[0,0];this.attack=0;this.smokes=[];this.traces=[];this.feed=[];this.bomb=null;this.result='';this.botCount=0;this.clock=0;}
 add(id,name,agent='breacher',bot=false){const counts=[0,0];for(const p of this.players.values())counts[p.team]++;const team=counts[0]<=counts[1]?0:1;
 const p={id,name:String(name||'요원').slice(0,16),agent:'breacher',bot,team,x:SPAWNS[team].x,y:SPAWNS[team].y,angle:team?Math.PI:0,hp:100,armor:0,money:800,kills:0,deaths:0,alive:this.phase==='lobby',weapon:'pistol',primary:null,ammo:{pistol:12},reserve:{pistol:48},cooldown:0,reloading:0,input:{},interact:0,nav:[],navAt:0,shotAt:0,losses:0};this.players.set(id,p);if(!bot&&!this.host)this.host=id;return p;}
 remove(id){const p=this.players.get(id);if(!p)return;this.dropBomb(p);this.players.delete(id);if(this.host===id)this.host=[...this.players.values()].find(x=>!x.bot)?.id||null;}
 humans(){return [...this.players.values()].filter(p=>!p.bot);}
 balanceBots(){if(!this.fillBots)return;for(let team=0;team<2;team++){if(![...this.players.values()].some(p=>p.team===team))this.addBot(team);}}
 addBot(team){const p=this.add('bot-'+(++this.botCount),'BOT '+this.botCount,'breacher',true);p.team=team;return p;}
 start(id){if(this.phase!=='lobby'||(this.mode==='private'&&id!==this.host))return false;this.balanceBots();if(![0,1].every(t=>[...this.players.values()].some(p=>p.team===t)))return false;this.newRound();return true;}
 newRound(){this.round++;if(this.round===13||this.round>24){this.attack=1-this.attack;if(this.round===13)for(const p of this.players.values()){p.money=800;p.primary=null;p.armor=0;p.losses=0;}}
 if(this.round>24)for(const p of this.players.values())p.money=5000;
 this.phase='buy';this.time=20;this.result='';this.smokes=[];this.traces=[];this.bomb=null;this.balanceBots();const indexes=[0,0];
 for(const p of this.players.values()){const i=indexes[p.team]++,s=SPAWNS[p.team===this.attack?0:1];p.x=s.x+(Math.floor(i/5)%3)*38*(p.team===this.attack?1:-1);p.y=s.y+(i%5-2)*40;p.hp=100;p.alive=true;p.angle=p.team===this.attack?0:Math.PI;p.input={};p.cooldown=0;p.reloading=0;p.interact=0;p.nav=[];p.navAt=0;p.weapon=p.primary||'pistol';p.ammo={pistol:12};p.reserve={pistol:48};if(p.primary){p.ammo[p.primary]=WEAPONS[p.primary].mag;p.reserve[p.primary]=WEAPONS[p.primary].mag*3;}
 if(p.bot){this.buy(p,p.money>=2900?'rifle':'smg');this.buy(p,'armor');}}
 const carrier=[...this.players.values()].find(p=>p.team===this.attack&&!p.bot)||[...this.players.values()].find(p=>p.team===this.attack);this.bomb={carrier:carrier?.id,x:carrier?.x||140,y:carrier?.y||600,planted:false,timer:40,site:null};}
 buy(p,item){if(this.phase!=='buy'||!p.alive)return false;
 if(item==='armor'){if(p.money<1000||p.armor===50)return false;p.money-=1000;p.armor=50;return true;}
 const w=Object.hasOwn(WEAPONS,item)?WEAPONS[item]:null;if(!w||item==='pistol'||p.money<w.price)return false;p.money-=w.price;p.primary=item;p.weapon=item;p.ammo[item]=w.mag;p.reserve[item]=w.mag*3;p.reloading=0;return true;}
 dropBomb(p){if(this.bomb?.carrier===p.id){this.bomb.carrier=null;this.bomb.x=p.x;this.bomb.y=p.y;}}
 reload(p){if(!p.alive||p.reloading||p.ammo[p.weapon]>=WEAPONS[p.weapon].mag||!p.reserve[p.weapon])return;p.reloading=WEAPONS[p.weapon].reload;}
 switchWeapon(p){if(!p.primary)return;p.weapon=p.weapon==='pistol'?p.primary:'pistol';p.reloading=0;p.cooldown=Math.max(p.cooldown,.2);}
 kill(victim,killer){if(!victim.alive)return;victim.alive=false;victim.hp=0;victim.deaths++;victim.primary=null;victim.armor=0;victim.input={};this.dropBomb(victim);if(killer){killer.kills++;killer.money=Math.min(9000,killer.money+200);this.feed.unshift({killer:killer.name,victim:victim.name,weapon:killer.weapon,time:7});this.feed=this.feed.slice(0,5);}}
 damage(p,amount,killer){const absorb=Math.min(p.armor,amount*.66);p.armor-=absorb;p.hp-=amount-absorb;if(p.hp<=0)this.kill(p,killer);}
 fire(p){if(!p.alive||this.phase!=='live'||p.cooldown>0||p.reloading)return;if(!p.ammo[p.weapon]){this.reload(p);return;}const w=WEAPONS[p.weapon];p.ammo[p.weapon]--;p.cooldown=w.delay;p.shotAt=this.clock;
 for(let j=0;j<(w.pellets||1);j++){const move=Math.hypot(p.input.x||0,p.input.y||0),a=p.angle+(Math.random()-.5)*w.spread*(move?4:1),dx=Math.cos(a),dy=Math.sin(a);let len=rayWall(p.x,p.y,dx,dy,w.range),target=null;
 for(const q of this.players.values()){if(q.team===p.team||!q.alive)continue;const vx=q.x-p.x,vy=q.y-p.y,t=vx*dx+vy*dy,perp=vx*vx+vy*vy-t*t;if(t<0||perp>18*18)continue;const hit=t-Math.sqrt(18*18-perp);if(hit>=0&&hit<len){len=hit;target=q;}}
 this.traces.push({x:p.x,y:p.y,ex:p.x+dx*len,ey:p.y+dy*len,team:p.team,time:.12,hit:!!target,shooter:p.id});if(target)this.damage(target,w.damage,p);
 }}
 finish(team,reason){if(this.phase!=='live')return;this.score[team]++;this.phase='end';this.time=6;this.result=reason;for(const p of this.players.values()){p.input={};p.interact=0;if(p.team===team){p.money=Math.min(9000,p.money+3000);p.losses=0;}else{p.losses++;p.money=Math.min(9000,p.money+Math.min(2900,1900+(p.losses-1)*500));}}
 if(this.score[team]>=13&&Math.abs(this.score[0]-this.score[1])>=2){this.phase='match';this.time=18;this.result=`${team===0?'청록':'코랄'} 팀 최종 승리`;}}
 botInput(p,dt){if(this.phase!=='live'||!p.alive){p.input={};return;}
 let enemy=[...this.players.values()].filter(q=>q.alive&&q.team!==p.team&&dist(p,q)<850&&visible(p,q,this.smokes)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
 if(enemy){p.angle=Math.atan2(enemy.y-p.y,enemy.x-p.x)+(Math.sin(this.clock*3+p.x)*.045);p.input={x:0,y:0,fire:true,angle:p.angle};if(!p.ammo[p.weapon])this.reload(p);return;}
 let target;const b=this.bomb;
 if(p.team===this.attack){if(b.planted)target={x:b.x-140,y:b.y+80};else if(b.carrier===p.id)target=SITES[this.round%2];else if(!b.carrier)target=b;else target=this.players.get(b.carrier)||SITES[0];}
 else if(b.planted)target=b;else target=SITES[(this.round+Number(p.id.split('-')[1]||0))%2];
 if(b.planted&&p.team!==this.attack&&dist(p,b)<68||!b.planted&&b.carrier===p.id&&SITES.some(s=>dist(p,s)<s.r)){p.input={x:0,y:0,interact:true};return;}
 if(this.clock>=p.navAt){p.nav=pathTo(p,target);p.navAt=this.clock+.9;}while(p.nav.length&&dist(p,p.nav[0])<18)p.nav.shift();const next=p.nav[0];if(next){const d=dist(p,next);p.input={x:(next.x-p.x)/Math.max(1,d),y:(next.y-p.y)/Math.max(1,d)};p.angle=Math.atan2(p.input.y,p.input.x);}else p.input={};
 }
 tick(dt){this.clock+=dt;this.traces=this.traces.filter(t=>(t.time-=dt)>0);this.smokes=this.smokes.filter(s=>(s.time-=dt)>0);this.feed=this.feed.filter(f=>(f.time-=dt)>0);
 if(this.phase==='lobby'){if(this.mode==='random'&&this.humans().length){this.time+=dt;if(this.time>=8)this.start(this.host);}return;}
 this.time-=dt;
 if(this.phase==='end'&&this.time<=0){this.newRound();return;}if(this.phase==='match'&&this.time<=0){this.phase='lobby';this.round=0;this.score=[0,0];this.time=0;for(const p of this.players.values()){p.money=800;p.primary=null;p.armor=0;}return;}
 if(this.phase==='buy'&&this.time<=0){this.phase='live';this.time=100;}
 if(this.phase!=='live'&&this.phase!=='buy')return;
 for(const p of this.players.values()){if(p.bot)this.botInput(p,dt);if(!p.alive)continue;p.cooldown=Math.max(0,p.cooldown-dt);if(p.reloading){p.reloading-=dt;if(p.reloading<=0){p.reloading=0;const n=Math.min(WEAPONS[p.weapon].mag-p.ammo[p.weapon],p.reserve[p.weapon]);p.ammo[p.weapon]+=n;p.reserve[p.weapon]-=n;}}
 const input=p.input;let x=Number(input.x)||0,y=Number(input.y)||0;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}if(Number.isFinite(input.angle))p.angle=input.angle;
 const speed=WEAPONS[p.weapon].speed*(input.walk?.55:1);const nx=p.x+x*speed*dt,ny=p.y+y*speed*dt;
 const inSpawn=(xx)=>p.team===this.attack?xx<250:xx>1550;
 if(!blocked(nx,p.y)&&(this.phase==='live'||inSpawn(nx)))p.x=nx;if(!blocked(p.x,ny))p.y=ny;
 if(this.phase==='live'&&input.fire)this.fire(p);
 const b=this.bomb;if(!b||this.phase!=='live')continue;if(!b.planted&&!b.carrier&&p.team===this.attack&&dist(p,b)<32)b.carrier=p.id;if(b.carrier===p.id){b.x=p.x;b.y=p.y;}
 const site=SITES.find(s=>dist(p,s)<s.r);const plant=!b.planted&&b.carrier===p.id&&site;const defuse=b.planted&&p.team!==this.attack&&dist(p,b)<70;
 if(input.interact&&!input.fire&&len<.1&&(plant||defuse)){p.interact+=dt;if(p.interact>=(plant?3:7)){p.interact=0;if(plant){b.planted=true;b.carrier=null;b.site=site.name;b.timer=40;this.time=40;p.money=Math.min(9000,p.money+300);}else{this.finish(p.team,'코어 해체 성공');break;}}}else p.interact=0;
 }
 if(this.phase==='live'){const alive=[0,0];for(const p of this.players.values())if(p.alive)alive[p.team]++;if(this.bomb.planted){this.bomb.timer-=dt;if(this.bomb.timer<=0)this.finish(this.attack,'코어 폭발 · 공격 성공');else if(alive[1-this.attack]===0)this.finish(this.attack,'수비팀 전멸');}else if(!alive[this.attack])this.finish(1-this.attack,'공격팀 전멸');else if(!alive[1-this.attack])this.finish(this.attack,'수비팀 전멸');else if(this.time<=0)this.finish(1-this.attack,'시간 초과 · 수비 성공');}
 }
 snapshot(id){const me=this.players.get(id);if(!me)return null;const camera=me.alive?me:[...this.players.values()].find(p=>p.team===me.team&&p.alive)||me;
 const players=[...this.players.values()].filter(p=>p.team===me.team||this.phase!=='live'||(p.alive&&dist(camera,p)<1000&&visible(camera,p,this.smokes))).map(p=>({id:p.id,name:p.name,agent:p.agent,team:p.team,x:p.x,y:p.y,angle:p.angle,hp:Math.ceil(p.hp),armor:Math.ceil(p.armor),alive:p.alive,weapon:p.weapon,bot:p.bot}));
 const {input,nav,...safeMe}=me;const b=this.bomb?{...this.bomb}:null;if(b&&!b.planted&&me.team!==this.attack){const carrier=this.players.get(b.carrier);if(carrier&&!players.some(p=>p.id===carrier.id)){b.x=null;b.y=null;b.carrier=null;}else if(!carrier&&!visible(camera,b,this.smokes)){b.x=null;b.y=null;}}
 return {type:'state',code:this.code,name:this.name,mode:this.mode,host:this.host,fillBots:this.fillBots,phase:this.phase,time:this.time,round:this.round,score:this.score,attack:this.attack,result:this.result,players,me:safeMe,camera:camera.id,bomb:b,smokes:this.smokes,traces:this.traces.filter(t=>t.team===me.team||visible(camera,{x:t.x,y:t.y},this.smokes)),feed:this.feed,roster:[...this.players.values()].map(p=>({id:p.id,name:p.name,agent:p.agent,team:p.team,kills:p.kills,deaths:p.deaths,alive:p.alive,bot:p.bot}))};}
}
