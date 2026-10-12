export const WORLD={w:1800,h:1200};
export const WALLS=[
 [0,0,1800,35],[0,1165,1800,35],[0,0,35,1200],[1765,0,35,1200],
 [270,35,60,310],[270,490,60,235],[270,875,60,290],
 [1470,35,60,310],[1470,490,60,235],[1470,875,60,290],
 [470,240,330,55],[1000,240,330,55],[470,905,330,55],[1000,905,330,55],
 [470,420,70,360],[1260,420,70,360],[720,465,360,60],[720,675,360,60],
 [850,35,100,250],[850,915,100,250],
 [600,350,75,65],[1125,350,75,65],[600,785,75,65],[1125,785,75,65],
 [365,565,75,70],[1360,565,75,70]
];
export const SITES=[{name:'A',x:1150,y:135,r:110},{name:'B',x:1150,y:1065,r:110}];
export const SPAWNS=[{x:140,y:600},{x:1660,y:600}];
export const WEAPONS={
 pistol:{name:'P12',label:'기본 권총',price:0,damage:26,delay:.24,mag:12,reload:1.2,range:850,spread:.024,speed:225},
 smg:{name:'VECTOR',label:'기관단총',price:1600,damage:21,delay:.085,mag:25,reload:1.65,range:730,spread:.065,speed:220},
 rifle:{name:'AR-7',label:'돌격소총',price:2900,damage:35,delay:.12,mag:25,reload:2.1,range:1250,spread:.025,speed:205},
 sniper:{name:'LONGSHOT',label:'저격소총',price:4700,damage:145,delay:1.25,mag:5,reload:2.8,range:1500,spread:.006,speed:185},
 shotgun:{name:'BREAKER',label:'산탄총',price:1800,damage:16,delay:.8,mag:6,reload:2.4,range:420,spread:.20,pellets:8,speed:210}
};
export const AGENTS={ghost:{name:'고스트',role:'시야 차단',skill:'연막',key:'Q',color:'#75ded9'},rush:{name:'러시',role:'빠른 진입',skill:'전방 대쉬',key:'Q',color:'#ff785f'},medic:{name:'메딕',role:'생존 지원',skill:'자가 회복',key:'Q',color:'#b2d984'}};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function blocked(x,y,r=17){return WALLS.some(([a,b,w,h])=>x+r>a&&x-r<a+w&&y+r>b&&y-r<b+h);}
export function rayWall(x,y,dx,dy,max){
 let nearest=max;
 for(const [a,b,w,h] of WALLS){let lo=0,hi=nearest;
  for(const [o,d,mn,mx] of [[x,dx,a,a+w],[y,dy,b,b+h]]){
   if(Math.abs(d)<1e-9){if(o<mn||o>mx){hi=-1;break;}}
   else{let t1=(mn-o)/d,t2=(mx-o)/d;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);}
  }if(hi>=lo&&hi>=0)nearest=Math.min(nearest,lo);
 }return nearest;
}
export function visible(a,b,smokes=[]){const d=dist(a,b);if(!d)return true;if(rayWall(a.x,a.y,(b.x-a.x)/d,(b.y-a.y)/d,d)<d-1)return false;
 return !smokes.some(s=>{const t=clamp(((s.x-a.x)*(b.x-a.x)+(s.y-a.y)*(b.y-a.y))/(d*d),0,1);return Math.hypot(a.x+(b.x-a.x)*t-s.x,a.y+(b.y-a.y)*t-s.y)<s.r;});}
// Navigation grid shared with the server; walls are expanded by the player radius.
export function pathTo(a,b){const step=45,cols=40,rows=27;const cell=p=>[clamp(Math.floor(p.x/step),0,cols-1),clamp(Math.floor(p.y/step),0,rows-1)];
 const [sx,sy]=cell(a),[tx,ty]=cell(b),start=sy*cols+sx;const queue=[start],prev=new Map([[start,-1]]);let best=start,bestD=1e9;
 for(let i=0;i<queue.length;i++){const n=queue[i],x=n%cols,y=Math.floor(n/cols),d=(x-tx)**2+(y-ty)**2;if(d<bestD){bestD=d;best=n;}if(d===0)break;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*cols+nx;if(nx<0||nx>=cols||ny<0||ny>=rows||prev.has(k)||blocked(nx*step+step/2,ny*step+step/2,20))continue;prev.set(k,n);queue.push(k);}}
 const out=[];while(best!==start&&best!==-1){out.push({x:(best%cols)*step+step/2,y:Math.floor(best/cols)*step+step/2});best=prev.get(best)??-1;}return out.reverse();
}
