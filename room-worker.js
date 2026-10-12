import {parentPort} from 'node:worker_threads';
import {createSimulation} from './simulation.js';
const sim=createSimulation(),buffers=new Map();
parentPort.on('message',m=>{
 try{
  if(m.type==='add')sim.add(m.id,m.name,data=>parentPort.postMessage({type:'send',id:m.id,payload:JSON.stringify(data)}),()=>buffers.get(m.id)||0);
  else if(m.type==='remove'){sim.remove(m.id);buffers.delete(m.id);}
  else if(m.type==='settings')sim.settings(m.data);
  else if(m.type==='start')sim.start();
  else if(m.type==='control')sim.control(m.data);
  else if(m.type==='input')sim.receive(m.id,m.data);
  else if(m.type==='buffers')for(const [id,size] of m.values)buffers.set(id,size);
 }catch(err){parentPort.postMessage({type:'error',message:err.message});}
});
let last=performance.now(),accumulator=0,lastSync=0;
const step=1000/60;
setInterval(()=>{
 const now=performance.now();accumulator=Math.min(4*step,accumulator+now-last);last=now;
 try{
  while(accumulator>=step){sim.tick();accumulator-=step;}
  if(now-lastSync>=1000/30){sim.sync();lastSync=now-(now-lastSync)%(1000/30);}
 }catch(err){parentPort.postMessage({type:'error',message:err.message});}
},8);
