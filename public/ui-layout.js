// Local, per-device HUD layout. No gameplay or network state is changed.
(()=>{
const groups=[
 ['공통 HUD',[['statusHUD','상태 / 탄약'],['minimapCanvas','미니맵'],['spawnSelectHUD','스폰 안내'],['spectateHUD','관전 안내'],['respawnHUD','부활 안내'],['reviveHUD','소생 안내'],['killNotification','처치 알림'],['desktopGameSettings','PC 설정 버튼']]],
 ['일반게임',[['spikePanel','라운드 / 무기 / 체력'],['spikeBanner','시작 / 승패 알림'],['spikeAction','설치 / 해체 진행'],['btnSpike','설치 / 해체 버튼'],['spikeShop','구매 화면']]],
 ['게임 화면',[['inventory','가방'],['fullMapOverlay','전체 지도'],['victoryOverlay','결과 화면'],['spectatorSwitch','관전 전환']]],
 ['모바일 버튼',[['btnReload','장전'],['btnSprint','달리기'],['btnRevive','소생'],['btnDoor','문'],['btnPickup','줍기'],['btnBag','가방'],['btnMap','지도'],['btnSettings','설정']]]
];
const ids=new Set(groups.flatMap(g=>g[1].map(x=>x[0])));
const frame=document.getElementById('gameFrame'),modal=document.getElementById('settingsModal');
const select=document.getElementById('layoutElement'),slider=document.getElementById('controlScaleInput'),label=document.getElementById('layoutScaleValue');
const storeKey=p=>'battlefield-layout-v2-'+p;
let active=false,selected='',drag=null,preview=new Map(),controlsDisplay=null;
const platform=()=>isMobile?'mobile':'pc';
function read(p){try{const value=JSON.parse(localStorage.getItem(storeKey(p))||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}
function save(p,data){try{localStorage.setItem(storeKey(p),JSON.stringify(data))}catch{}}
function clean(v){return Number.isFinite(+v)?Math.max(.5,Math.min(1.8,+v)):1}
function find(id){return document.getElementById(id)}
const originalStyles=new WeakMap();
function original(el){if(!originalStyles.has(el))originalStyles.set(el,{transform:el.style.transform,origin:el.style.transformOrigin,left:el.style.left,top:el.style.top,right:el.style.right,bottom:el.style.bottom});return originalStyles.get(el).transform}
function restore(el){if(!el)return;const base=originalStyles.get(el)||(original(el),originalStyles.get(el));for(const key of ['left','top','right','bottom'])el.style[key]=base[key];el.style.transform=base.transform;el.style.transformOrigin=base.origin}
function applyOne(id,record){const el=find(id);if(!el)return;restore(el);if(!record)return;const scale=clean(record.s);if(Number.isFinite(record.x)&&Number.isFinite(record.y)){
 // Position from the unscaled bounding box, preserving the element's original visual anchor.
 const rect=el.getBoundingClientRect(),box=frame.getBoundingClientRect();
 const x=Math.max(0,Math.min(box.width-24,record.x*box.width));
 const y=Math.max(0,Math.min(box.height-24,record.y*box.height));
 const style=getComputedStyle(el);
 const oldLeft=parseFloat(style.left),oldTop=parseFloat(style.top);
 el.style.left=(Number.isFinite(oldLeft)?oldLeft:rect.left-box.left)+(x-(rect.left-box.left))+'px';
 el.style.top=(Number.isFinite(oldTop)?oldTop:rect.top-box.top)+(y-(rect.top-box.top))+'px';
 el.style.right='auto';el.style.bottom='auto';
 }
 el.style.transform=(original(el)||'')+' scale('+scale+')';
 el.style.transformOrigin='top left';
}
function apply(){const data=read(platform());for(const id of ids)applyOne(id,data[id]);refresh()}
function options(){const previous=select.value;select.innerHTML='';for(const [heading,items] of groups){const group=document.createElement('optgroup');group.label=heading;for(const [id,name] of items){if(platform()==='pc'&&(id.startsWith('btn')&&id!=='desktopGameSettings'))continue;if(platform()==='mobile'&&id==='desktopGameSettings')continue;const option=document.createElement('option');option.value=id;option.textContent=name;group.appendChild(option)}if(group.children.length)select.appendChild(group)}if([...select.options].some(o=>o.value===previous))select.value=previous;selected=select.value;refresh()}
function refresh(){if(!slider)return;const s=read(platform())[select.value]?.s||1;slider.value=String(clean(s));label.textContent=Math.round(clean(s)*100)+'%';const floating=document.getElementById('layoutToolbarScale');if(floating)floating.value=String(clean(s));const floatingValue=document.getElementById('layoutToolbarValue');if(floatingValue)floatingValue.textContent=Math.round(clean(s)*100)+'%';for(const el of document.querySelectorAll('.layout-selected'))el.classList.remove('layout-selected');if(active&&find(selected))find(selected).classList.add('layout-selected')}
function choose(id){if(!ids.has(id))return;if([...select.options].some(o=>o.value===id)){const old=selected;select.value=id;selected=id;if(active){const prev=find(old),next=find(id);if(prev&&preview.has(old)&&getComputedStyle(prev).display!=='none'&&preview.get(old)==='none')prev.style.display='none';if(next&&getComputedStyle(next).display==='none')next.style.display=id==='btnSpike'?'flex':'block'}refresh()}}
function scale(value){const id=select.value;if(!id)return;const data=read(platform());data[id]={...(data[id]||{}),s:clean(value)};save(platform(),data);applyOne(id,data[id]);refresh()}
function reset(){const id=select.value;if(!id)return;const data=read(platform());delete data[id];save(platform(),data);applyOne(id,null);refresh()}
const bar=document.createElement('div');bar.id='layoutToolbar';bar.innerHTML='<strong>UI 편집</strong><span id="layoutSelectedName"></span><input type="range" id="layoutToolbarScale" min="0.5" max="1.8" step="0.05" value="1" aria-label="선택한 UI 크기"><span id="layoutToolbarValue">100%</span><button type="button" id="layoutFinish">저장하고 닫기</button>';
bar.querySelector('#layoutToolbarScale').addEventListener('input',e=>scale(e.target.value));
document.body.appendChild(bar);bar.querySelector('#layoutFinish').addEventListener('click',stop);
function start(){if(active)return;active=true;options();preview.clear();const controls=find('mobileControls');controlsDisplay=controls?.style.display;if(isMobile&&controls)controls.style.display='block';if(typeof keys==='object')Object.keys(keys).forEach(k=>keys[k]=false);if(typeof myPlayer==='object'){myPlayer.isShooting=false;myPlayer.isAiming=false;}for(const id of ids){const el=find(id);if(!el)continue;preview.set(id,el.style.display);if(id===selected&&getComputedStyle(el).display==='none')el.style.display=id==='btnSpike'?'flex':'block'}
 modal.style.display='none';bar.style.display='flex';frame.classList.add('layout-editing');bar.querySelector('#layoutSelectedName').textContent=select.selectedOptions[0]?.textContent||'';refresh();}
function stop(){if(!active)return;active=false;drag=null;bar.style.display='none';frame.classList.remove('layout-editing');for(const id of ids){const el=find(id);if(el&&preview.has(id))el.style.display=preview.get(id)}preview.clear();if(find('mobileControls')&&controlsDisplay!==null)find('mobileControls').style.display=controlsDisplay;controlsDisplay=null;for(const el of document.querySelectorAll('.layout-selected'))el.classList.remove('layout-selected');modal.style.display='flex'}
function move(e){if(!drag||e.pointerId!==drag.pointerId)return;const el=find(drag.id),box=frame.getBoundingClientRect();if(!el)return;const data=read(platform());const x=Math.max(0,Math.min(box.width-24,drag.x+e.clientX-drag.clientX)),y=Math.max(0,Math.min(box.height-24,drag.y+e.clientY-drag.clientY));data[drag.id]={...(data[drag.id]||{}),x:x/box.width,y:y/box.height};save(platform(),data);applyOne(drag.id,data[drag.id]);refresh();e.preventDefault()}
frame.addEventListener('pointerdown',e=>{if(!active)return;const element=e.target.closest('[id]');let el=element;while(el&&!ids.has(el.id))el=el.parentElement;if(!el||!ids.has(el.id)){e.preventDefault();e.stopImmediatePropagation();return}choose(el.id);const box=frame.getBoundingClientRect(),rect=el.getBoundingClientRect();drag={pointerId:e.pointerId,id:el.id,clientX:e.clientX,clientY:e.clientY,x:rect.left-box.left,y:rect.top-box.top};bar.querySelector('#layoutSelectedName').textContent=select.selectedOptions[0]?.textContent||'';e.preventDefault();e.stopImmediatePropagation()},true);
window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',()=>drag=null,true);window.addEventListener('pointercancel',()=>drag=null,true);
for(const type of ['click','touchstart','touchend','mousedown','mouseup'])frame.addEventListener(type,e=>{if(active){e.preventDefault();e.stopImmediatePropagation()}},true);
window.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){stop();return}e.preventDefault();e.stopImmediatePropagation()},true);
window.addEventListener('resize',()=>{if(!active)apply()});
select.addEventListener('change',()=>choose(select.value));
window.UIEditor={apply,options,scale,reset,start,stop};options();apply();
})();
