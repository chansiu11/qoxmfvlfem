import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../simulation.js';
test('dedicated simulation generates the current map, runs bots and excludes server sentinel',async()=>{
 const s=createSimulation(),packets=[];
 try{s.add('a','A',p=>packets.push(p),()=>0);s.settings({mode:'normal',aiCount:3,aiDiff:'hard'});s.start();s.tick();s.sync();
 assert.equal(s.state().bots,3);assert(s.state().seed>0);assert.equal(s.state().players.length,1);
 const initial=s.evaluate('aiBots.map(b=>({x:b.x,y:b.y}))');
 await new Promise(r=>setTimeout(r,40));s.tick();
 const after=s.evaluate('aiBots.map(b=>({x:b.x,y:b.y}))');assert.notDeepEqual(initial,after);
 assert(packets.find(p=>p.type==='START'));assert(!packets.find(p=>p.type==='START').mapData);
 assert(packets.filter(p=>p.type==='SYNC').every(p=>!p.players.some(p=>p.id==='__server__')));
 }finally{s.dispose();}
});
test('server resolves bullet hits, rate limits shots, rejects spoofed identity and preserves damage',()=>{
 const s=createSimulation();try{
 s.add('a','A',()=>{},()=>0);s.add('b','B',()=>{},()=>0);s.settings({mode:'normal',aiToggle:false});s.start();
 s.evaluate('obstacles=[];');
 s.receive('a',{type:'SYNC',player:{id:'b',x:100,y:100,weapon:'sniper',clipAmmo:5,angle:0}});
 s.receive('b',{type:'SYNC',player:{x:220,y:100,hp:200}});
 s.receive('a',{type:'SHOOT',player:{angle:0}});s.receive('a',{type:'SHOOT',player:{angle:0}});
 assert.equal(s.evaluate('bullets.length'),1);s.tick();
 assert.equal(s.state().players.find(p=>p.id==='b').hp,100);
 s.receive('b',{type:'SYNC',player:{hp:200}});assert.equal(s.state().players.find(p=>p.id==='b').hp,100);
 assert.equal(s.state().players.find(p=>p.id==='a').name,'A');
 }finally{s.dispose();}
});
test('slow connections skip obsolete snapshots; server keeps running without original owner',()=>{
 const s=createSimulation(),packets=[];try{
 s.add('a','A',()=>{},()=>0);s.add('b','B',p=>packets.push(p),()=>65536);s.settings({mode:'normal',aiCount:2});s.start();s.remove('a');s.tick();s.sync();
 assert.equal(s.state().started,true);assert.equal(s.state().bots,2);assert.equal(s.state().players[0].id,'b');assert(!packets.some(p=>p.type==='SYNC'));
 }finally{s.dispose();}
});
test('incremental path search finishes around a wall without crossing collision geometry',()=>{
 const s=createSimulation();try{
 const result=s.evaluate(`(()=>{obstacles=[{x:160,y:50,w:40,h:200,type:'rock'}];const search=planBotRoute({x:100,y:100},{x:260,y:100});let step,iterations=0;do{step=search.next();iterations++;}while(!step.done&&iterations<1000);let prev={x:100,y:100};const safe=Array.isArray(step.value)&&step.value.every(p=>{const ok=botSegmentClear(prev,p);prev=p;return ok;});return {done:step.done,yields:iterations,safe};})()`);
 assert(result.done);assert(result.yields>1);assert(result.safe);
 }finally{s.dispose();}
});
