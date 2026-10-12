import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {createServer} from '../server.js';
function client(url){return new Promise((resolve,reject)=>{const ws=new WebSocket(url),messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));ws.on('open',()=>resolve({ws,messages,send:m=>ws.send(JSON.stringify(m))}));ws.on('error',reject);});}
async function until(fn){const start=Date.now();while(Date.now()-start<5000){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out');}
test('two clients use a dedicated room, owner departure preserves game, ping bypasses simulation',async()=>{
 const app=createServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port;let a,b;
 try{
 const health=await(await fetch(`http://127.0.0.1:${port}/health`)).json();assert.equal(health.version,'dedicated-v2');
 a=await client(`ws://127.0.0.1:${port}/ws`);b=await client(`ws://127.0.0.1:${port}/ws`);
 a.send({type:'JOIN',create:true,name:'Alpha',settings:{mode:'normal',aiCount:2}});
 const joined=await until(()=>a.messages.find(m=>m.type==='JOINED'));
 b.send({type:'JOIN',code:joined.code,name:'Bravo'});await until(()=>b.messages.find(m=>m.type==='ROOM_ROLES'&&m.roster.length===4));
 b.send({type:'START_REQUEST'});b.send({type:'PING',t:123});await until(()=>b.messages.find(m=>m.type==='PONG'&&m.t===123));assert(!b.messages.some(m=>m.type==='START'));
 a.send({type:'START_REQUEST'});await until(()=>b.messages.find(m=>m.type==='SYNC'));
 const id=b.messages.find(m=>m.type==='HELLO').id;b.send({type:'SYNC',player:{x:1100,y:900}});
 await until(()=>a.messages.find(m=>m.type==='SYNC'&&m.players.some(p=>p.id===id&&p.x===1100)));
 a.ws.close();await until(()=>b.messages.find(m=>m.type==='OWNER'&&m.id===id));
 const before=b.messages.filter(m=>m.type==='SYNC').length;await until(()=>b.messages.filter(m=>m.type==='SYNC').length>before+2);
 b.ws.send('{bad');b.send({type:'PING',t:456});assert(await until(()=>b.messages.find(m=>m.type==='PONG'&&m.t===456)));
 b.ws.close();await until(()=>app.rooms.size===0);
 }finally{a?.ws.close();b?.ws.close();await app.close();}
});
