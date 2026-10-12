import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomInt} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {WebSocketServer,WebSocket} from 'ws';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
export function createServer(){
 const rooms=new Map(),clients=new Map();
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({ok:true,version:'dedicated-v2',rooms:rooms.size,players:clients.size,tickHz:60,snapshotHz:30}));return;}
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
 });
 const wss=new WebSocketServer({server,path:'/ws',maxPayload:8192,perMessageDeflate:false});
 const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
 function roles(room){for(const c of room.clients.values())send(c.ws,{type:'OWNER',id:room.owner});}
 function destroy(room){rooms.delete(room.code);room.worker.terminate();}
 function leave(c){const room=c.room;if(!room)return;c.room=null;room.clients.delete(c.id);room.worker.postMessage({type:'remove',id:c.id});if(!room.clients.size)destroy(room);else if(room.owner===c.id){room.owner=room.clients.keys().next().value;roles(room);}}
 function newRoom(c){
  let code;do{code=String(randomInt(1000,10000));}while(rooms.has(code));
  const worker=new Worker(new URL('./room-worker.js',import.meta.url));
  const room={code,owner:c.id,clients:new Map(),worker,started:false};rooms.set(code,room);
  worker.on('message',m=>{
   if(m.type==='error'){console.error('Room simulation:',m.message);for(const p of room.clients.values())send(p.ws,{type:'ERROR',message:'게임 처리 오류가 발생했습니다. 방을 다시 만들어 주세요.'});return;}
   const client=room.clients.get(m.id);if(!client||client.ws.readyState!==WebSocket.OPEN)return;
   if(m.payload.includes('"type":"START"'))room.started=true;
   if(m.payload.includes('"type":"RETURN_TO_ROOM"'))room.started=false;
   // Do not accumulate stale state behind a slow network. Reliable events remain ordered.
   const snapshot=m.payload.startsWith('{"type":"SYNC",');
   if(snapshot&&client.ws.bufferedAmount>32768)return;
   if(client.ws.bufferedAmount>1048576){client.ws.close(1013,'Slow connection');return;}
   client.ws.send(m.payload);
  });
  worker.on('error',err=>{console.error(err);for(const p of room.clients.values()){p.room=null;send(p.ws,{type:'ERROR',message:'게임 서버 오류로 방이 종료되었습니다.'});}destroy(room);});
  return room;
 }
 wss.on('connection',ws=>{
  if(clients.size>=200){ws.close(1013,'Full');return;}
  ws._socket?.setNoDelay(true);
  const c={id:randomUUID(),ws,room:null,last:Date.now(),window:Date.now(),count:0};clients.set(c.id,c);send(ws,{type:'HELLO',id:c.id});
  ws.on('message',raw=>{
   try{
    const now=Date.now();if(now-c.window>=1000){c.window=now;c.count=0;}if(++c.count>120)return;c.last=now;
    const m=JSON.parse(raw);if(!m||typeof m!=='object')return;
    // Ping bypasses physics workers and their tick/snapshot queues.
    if(m.type==='PING'){if(Number.isFinite(m.t))send(ws,{type:'PONG',t:m.t});return;}
    if(m.type==='JOIN'){
     if(c.room)return;
     let room;
     if(m.create){if(rooms.size>=4){send(ws,{type:'ERROR',message:'서버의 방이 가득 찼습니다.'});return;}room=newRoom(c);}
     else room=rooms.get(String(m.code));
     if(!room){send(ws,{type:'ERROR',message:'방 코드를 확인해 주세요.'});return;}
     if(room.started){send(ws,{type:'ERROR',message:'진행 중인 경기입니다. 경기가 끝난 후 입장해 주세요.'});return;}
     if(room.clients.size>=20){send(ws,{type:'ERROR',message:'방이 가득 찼습니다.'});return;}
     c.room=room;room.clients.set(c.id,c);send(ws,{type:'JOINED',code:room.code,id:c.id,owner:room.owner});
     room.worker.postMessage({type:'add',id:c.id,name:String(m.name||'플레이어').slice(0,24)});
     if(room.owner===c.id)room.worker.postMessage({type:'settings',data:m.settings||{}});
     roles(room);return;
    }
    if(m.type==='LEAVE'){leave(c);return;}
    const room=c.room;if(!room)return;
    if(m.type==='SETTINGS'||m.type==='START_REQUEST'||m.type==='CONTROL'){
     if(c.id!==room.owner)return;
     room.worker.postMessage({type:m.type==='SETTINGS'?'settings':m.type==='CONTROL'?'control':'start',data:m});return;
    }
    if(['SYNC','SHOOT','DOOR_USE','PICKUP_ITEM','DROP_ITEM','RESPAWN_REMOTE'].includes(m.type))room.worker.postMessage({type:'input',id:c.id,data:m});
   }catch{/* Reject malformed messages without interrupting other players. */}
  });
  ws.on('close',()=>{leave(c);clients.delete(c.id);});ws.on('error',()=>ws.close());
 });
 const housekeeping=setInterval(()=>{
  for(const c of clients.values())if(Date.now()-c.last>15000)c.ws.terminate();
  for(const room of rooms.values())room.worker.postMessage({type:'buffers',values:[...room.clients.values()].map(c=>[c.id,c.ws.bufferedAmount])});
 },1000);
 return {server,rooms,async close(){clearInterval(housekeeping);for(const c of clients.values())c.ws.terminate();await Promise.all([...rooms.values()].map(r=>r.worker.terminate()));rooms.clear();wss.close();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createServer();app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Dedicated game server listening'));process.on('SIGTERM',async()=>{await app.close();process.exit(0);});}
