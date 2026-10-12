import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {Room} from './game.js';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export function createServer(){const rooms=new Map(),clients=new Map();
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size,players:clients.size}));return;}
 let rel;try{rel=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}let file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});});
 const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048,perMessageDeflate:false});
 const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<262144)ws.send(JSON.stringify(data));};
 function leave(c){if(c.room){c.room.remove(c.id);if(!c.room.humans().length)rooms.delete(c.room.code);}c.room=null;}
 wss.on('connection',ws=>{if(clients.size>=200){ws.close(1013,'Server full');return;}const c={id:randomBytes(12).toString('hex'),ws,room:null,last:Date.now(),window:Date.now(),count:0};clients.set(c.id,c);send(ws,{type:'hello',id:c.id});
 ws.on('message',raw=>{try{const now=Date.now();if(now-c.window>1000){c.window=now;c.count=0;}if(++c.count>100)return;c.last=now;const m=JSON.parse(raw.toString());if(!m||typeof m!=='object')return;
 const room=c.room,p=room?.players.get(c.id);
 if(m.type==='ping'){send(ws,{type:'pong',t:m.t});return;}
 if(m.type==='leave'){leave(c);send(ws,{type:'left'});return;}
 if(m.type==='join'){if(c.room)return;let next;
 if(m.mode==='random')next=[...rooms.values()].find(r=>r.mode==='random'&&r.humans().length<20&&r.phase==='lobby');
 else if(m.code){next=rooms.get(String(m.code).trim().toUpperCase());if(!next||next.mode!=='private'){send(ws,{type:'error',message:'방 코드를 확인해 주세요.'});return;}}
 if(!next){if(rooms.size>=50){send(ws,{type:'error',message:'서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.'});return;}next=new Room({mode:m.mode==='random'?'random':'private',name:m.mode==='random'?'랜덤 매치':String(m.roomName||'나의 작전실').slice(0,24),bots:m.bots!==false});rooms.set(next.code,next);}
 if(next.humans().length>=20){send(ws,{type:'error',message:'이 방은 최대 20명까지 참여할 수 있습니다.'});return;}
 c.room=next;next.add(c.id,m.name,m.agent);send(ws,{type:'joined',code:next.code});send(ws,next.snapshot(c.id));return;}
 if(!room||!p)return;
 if(m.type==='input'){p.input={x:Number.isFinite(m.x)?Math.max(-1,Math.min(1,m.x)):0,y:Number.isFinite(m.y)?Math.max(-1,Math.min(1,m.y)):0,angle:Number.isFinite(m.angle)?m.angle:p.angle,fire:!!m.fire,walk:!!m.walk,interact:!!m.interact};p.inputAt=now;}
 if(m.type==='start'&&!room.start(c.id))send(ws,{type:'error',message:'양 팀에 한 명 이상 필요합니다. 팀을 바꾸거나 봇을 추가해 주세요.'});
 if(m.type==='buy'&&!room.buy(p,m.item))send(ws,{type:'error',message:'구매 시간과 크레딧을 확인해 주세요.'});
 if(m.type==='reload')room.reload(p);if(m.type==='switch')room.switchWeapon(p);if(m.type==='skill')room.ability(p);if(m.type==='drop')room.dropBomb(p);
 if(m.type==='team'&&room.phase==='lobby')p.team=1-p.team;
 if(m.type==='bot'&&room.host===c.id&&room.phase==='lobby'&&room.players.size<20)room.addBot(m.team===1?1:0);
 if(m.type==='removeBots'&&room.host===c.id&&room.phase==='lobby'){for(const q of room.players.values())if(q.bot)room.remove(q.id);room.fillBots=false;}
 }catch{/* Invalid client packets are ignored without affecting other players. */}});
 ws.on('close',()=>{leave(c);clients.delete(c.id);});ws.on('error',()=>ws.close());});
 let last=performance.now(),frame=0;const timer=setInterval(()=>{const now=performance.now(),dt=Math.min(.08,(now-last)/1000);last=now;
 for(const c of clients.values()){if(Date.now()-c.last>20000){c.ws.terminate();continue;}const p=c.room?.players.get(c.id);if(p&&Date.now()-(p.inputAt||0)>350)p.input={};}
 for(const r of rooms.values())r.tick(dt);
 if(++frame%2===0)for(const c of clients.values())if(c.room)send(c.ws,c.room.snapshot(c.id));
 },1000/30);
 const close=()=>{clearInterval(timer);for(const c of clients.values())c.ws.terminate();wss.close();return new Promise(resolve=>server.close(resolve));};return{server,rooms,close};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createServer();app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('BREACH server listening'));process.on('SIGTERM',async()=>{await app.close();process.exit(0);});}
