// Per-mode, per-device HUD layouts. These settings are local to this browser.
(()=>{
const groups=[
 ['전투 HUD',[['statusHUD','상태 / 탄약'],['minimapCanvas','미니맵'],['spawnSelectHUD','스폰 안내'],['spectateHUD','관전 안내'],['respawnHUD','부활 안내'],['reviveHUD','소생 안내'],['killNotification','처치 알림'],['desktopGameSettings','PC 설정']]],
 ['일반게임',[['spikePanel','라운드 / 무기 / 체력'],['spikeBanner','시작 / 승패 알림'],['spikeAction','설치 / 해체 진행'],['btnSpike','설치 / 해체'],['spikeShop','구매 화면']]],
 ['게임 화면',[['inventory','가방'],['fullMapOverlay','전체 지도'],['victoryOverlay','결과 화면'],['spectatorSwitch','관전 전환']]],
 ['모바일 버튼',[['btnReload','장전'],['btnSprint','달리기'],['btnRevive','소생'],['btnDoor','문'],['btnPickup','줍기'],['btnBag','가방'],['btnMap','지도'],['btnSettings','설정']]]
];
const ids=new Set(groups.flatMap(g=>g[1].map(x=>x[0]))),frame=document.getElementById('gameFrame'),modal=document.getElementById('settingsModal');
const select=document.getElementById('layoutElement'),modeSelect=document.getElementById('layoutMode'),slider=document.getElementById('controlScaleInput'),label=document.getElementById('layoutScaleValue');
const modes={spike:'일반게임',normal:'데스매치',br:'배틀로얄'};
const platform=()=>isMobile?'mobile':'pc';
const currentMode=()=>modes[selectedMode]?selectedMode:'br';
const mode=()=>active||modal.style.display==='flex'?modeSelect.value:currentMode();
const key=(p,m)=>'battlefield-layout-v3-'+p+'-'+m;
let active=false,selected='',drag=null,preview=new Map(),pointerPreview=new Map(),controlsDisplay=null,lastLiveMode=currentMode();
function parse(raw){try{const value=JSON.parse(raw||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}
function read(p,m){
 const migration=key(p,m)+'-compact-32';if(!localStorage.getItem(migration)){const data=parse(localStorage.getItem(key(p,m)));for(const id of ['spikePanel','spikeBanner','spikeAction','btnSpike','statusHUD','spectateHUD','respawnHUD','killNotification'])delete data[id];try{localStorage.setItem(key(p,m),JSON.stringify(data));localStorage.setItem(migration,'1')}catch{}}
const saved=localStorage.getItem(key(p,m));return parse(saved===null?localStorage.getItem('battlefield-layout-v2-'+p):saved)}
function save(p,m,data){try{localStorage.setItem(key(p,m),JSON.stringify(data))}catch{}}
function clean(v){return Number.isFinite(+v)?Math.max(.5,Math.min(1.8,+v)):1}
function find(id){return document.getElementById(id)}
function allowed(id,m,p){
 if(p==='pc'&&id.startsWith('btn')&&id!=='desktopGameSettings')return false;
 if(p==='mobile'&&id==='desktopGameSettings')return false;
 if(['spikePanel','spikeBanner','spikeAction','btnSpike','spikeShop'].includes(id))return m==='spike';
 if(['btnRevive','btnDoor','btnPickup','reviveHUD','spawnSelectHUD'].includes(id))return m==='br';
 if(id==='btnSprint')return m!=='spike';
 if(id==='inventory'||id==='btnBag')return m!=='spike';
 return true;
}
const baseStyles=new WeakMap();
function base(el){if(!baseStyles.has(el))baseStyles.set(el,{transform:el.style.transform,origin:el.style.transformOrigin,left:el.style.left,top:el.style.top,right:el.style.right,bottom:el.style.bottom});return baseStyles.get(el)}
function restore(el){if(!el)return;const saved=base(el);for(const property of ['left','top','right','bottom'])el.style[property]=saved[property];el.style.transform=saved.transform;el.style.transformOrigin=saved.origin}
function applyOne(id,record){const el=find(id);if(!el)return;restore(el);if(!record)return;const s=clean(record.s);
 if(Number.isFinite(record.x)&&Number.isFinite(record.y)){
  const rect=el.getBoundingClientRect(),box=frame.getBoundingClientRect(),style=getComputedStyle(el);
  const x=Math.max(0,Math.min(box.width-24,record.x*box.width)),y=Math.max(0,Math.min(box.height-24,record.y*box.height));
  const left=parseFloat(style.left),top=parseFloat(style.top);
  el.style.left=(Number.isFinite(left)?left:rect.left-box.left)+(x-(rect.left-box.left))+'px';
  el.style.top=(Number.isFinite(top)?top:rect.top-box.top)+(y-(rect.top-box.top))+'px';
  el.style.right='auto';el.style.bottom='auto';
 }
 el.style.transform=(base(el).transform||'')+' scale('+s+')';el.style.transformOrigin='top left';
}
function apply(targetMode=mode()){const m=targetMode,data=read(platform(),m);for(const id of ids)applyOne(id,allowed(id,m,platform())?data[id]:null);refresh()}
function options(){const previous=select.value,m=mode(),p=platform();select.innerHTML='';
 for(const [heading,items] of groups){const group=document.createElement('optgroup');group.label=heading;
  for(const [id,name] of items){if(!allowed(id,m,p))continue;const option=document.createElement('option');option.value=id;option.textContent=name;group.appendChild(option)}
  if(group.children.length)select.appendChild(group);
 }
 const floating=find('layoutToolbarElement');if(floating){floating.innerHTML=select.innerHTML;}
 if([...select.options].some(o=>o.value===previous))select.value=previous;selected=select.value;if(floating)floating.value=selected;refresh();
}
function refresh(){if(!slider)return;const value=clean(read(platform(),mode())[select.value]?.s||1);slider.value=String(value);label.textContent=Math.round(value*100)+'%';
 const floating=find('layoutToolbarScale'),floatingValue=find('layoutToolbarValue');if(floating)floating.value=String(value);if(floatingValue)floatingValue.textContent=Math.round(value*100)+'%';
 for(const el of document.querySelectorAll('.layout-selected'))el.classList.remove('layout-selected');if(active&&find(selected))find(selected).classList.add('layout-selected');
 const name=find('layoutSelectedName');if(name)name.textContent=select.selectedOptions[0]?.textContent||'';
}
const alwaysVisible=new Set(['statusHUD','minimapCanvas','spikePanel','desktopGameSettings','btnReload','btnSprint','btnRevive','btnDoor','btnPickup','btnBag','btnMap','btnSettings','btnSpike']);
function showPreview(){const m=mode(),p=platform();for(const id of ids){const el=find(id);if(!el)continue;
 if(!preview.has(id)){preview.set(id,el.style.display);pointerPreview.set(id,el.style.pointerEvents);}
 if(allowed(id,m,p)&&(id===selected||alwaysVisible.has(id))){el.style.display=(id==='btnSpike'||id==='desktopGameSettings'||el.classList.contains('mobile-btn'))?'flex':'block';el.style.pointerEvents='auto';}
 else if(preview.has(id)){el.style.display='none';el.style.pointerEvents=pointerPreview.get(id);}
 }}
function choose(id){if(!ids.has(id)||![...select.options].some(o=>o.value===id))return;select.value=id;selected=id;if(find('layoutToolbarElement'))find('layoutToolbarElement').value=id;if(active)showPreview();refresh()}
function scale(value){const id=select.value;if(!id)return;const p=platform(),m=mode(),data=read(p,m);data[id]={...(data[id]||{}),s:clean(value)};save(p,m,data);applyOne(id,data[id]);refresh()}
function reset(){const id=select.value;if(!id)return;const p=platform(),m=mode(),data=read(p,m);delete data[id];save(p,m,data);applyOne(id,null);refresh()}
const bar=document.createElement('div');bar.id='layoutToolbar';bar.innerHTML='<strong>UI 편집</strong><select id="layoutToolbarMode" aria-label="편집할 게임 모드"><option value="spike">일반게임</option><option value="normal">데스매치</option><option value="br">배틀로얄</option></select><select id="layoutToolbarElement" aria-label="편집할 UI"></select><span id="layoutSelectedName"></span><input type="range" id="layoutToolbarScale" min="0.5" max="1.8" step="0.05" value="1" aria-label="선택한 UI 크기"><span id="layoutToolbarValue">100%</span><button type="button" id="layoutFinish">저장하고 닫기</button>';
document.body.appendChild(bar);
bar.querySelector('#layoutToolbarElement').addEventListener('change',e=>choose(e.target.value));
bar.querySelector('#layoutToolbarScale').addEventListener('input',e=>scale(e.target.value));bar.querySelector('#layoutFinish').addEventListener('click',stop);
function changeMode(value){if(!modes[value])return;modeSelect.value=value;find('layoutToolbarMode').value=value;options();apply();if(active)showPreview()}
modeSelect.addEventListener('change',()=>changeMode(modeSelect.value));find('layoutToolbarMode').addEventListener('change',e=>changeMode(e.target.value));
function start(){if(active)return;active=true;options();preview.clear();pointerPreview.clear();const controls=find('mobileControls');controlsDisplay=controls?.style.display;
 if(isMobile&&controls)controls.style.display='block';if(typeof keys==='object')Object.keys(keys).forEach(k=>keys[k]=false);
 if(typeof myPlayer==='object'){myPlayer.isShooting=false;myPlayer.isAiming=false;}
 modal.style.display='none';bar.style.display='flex';frame.classList.add('layout-editing');apply();showPreview();refresh();
}
function stop(){if(!active)return;active=false;drag=null;bar.style.display='none';frame.classList.remove('layout-editing');
 for(const [id,display] of preview){const el=find(id);if(el){el.style.display=display;el.style.pointerEvents=pointerPreview.get(id)}}preview.clear();pointerPreview.clear();
 if(find('mobileControls')&&controlsDisplay!==null)find('mobileControls').style.display=controlsDisplay;controlsDisplay=null;
 for(const el of document.querySelectorAll('.layout-selected'))el.classList.remove('layout-selected');modal.style.display='flex';apply(currentMode());
}
function move(e){if(!drag||e.pointerId!==drag.pointerId)return;const el=find(drag.id),box=frame.getBoundingClientRect();if(!el)return;
 const p=platform(),m=mode(),data=read(p,m),x=Math.max(0,Math.min(box.width-24,drag.x+e.clientX-drag.clientX)),y=Math.max(0,Math.min(box.height-24,drag.y+e.clientY-drag.clientY));
 data[drag.id]={...(data[drag.id]||{}),x:x/box.width,y:y/box.height};save(p,m,data);applyOne(drag.id,data[drag.id]);refresh();e.preventDefault();
}
frame.addEventListener('pointerdown',e=>{if(!active)return;let el=e.target.closest('[id]');while(el&&!ids.has(el.id))el=el.parentElement;
 if(!el||!allowed(el.id,mode(),platform())){e.preventDefault();e.stopImmediatePropagation();return}
 choose(el.id);const box=frame.getBoundingClientRect(),rect=el.getBoundingClientRect();drag={pointerId:e.pointerId,id:el.id,clientX:e.clientX,clientY:e.clientY,x:rect.left-box.left,y:rect.top-box.top};e.preventDefault();e.stopImmediatePropagation();
},true);
window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',()=>drag=null,true);window.addEventListener('pointercancel',()=>drag=null,true);
for(const type of ['click','touchstart','touchend','mousedown','mouseup'])frame.addEventListener(type,e=>{if(active){e.preventDefault();e.stopImmediatePropagation()}},true);
window.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){stop();return}e.preventDefault();e.stopImmediatePropagation()},true);
window.addEventListener('resize',()=>apply());
select.addEventListener('change',()=>choose(select.value));
// Game mode can change through room sync as well as through the lobby selector.
setInterval(()=>{const now=currentMode();if(now!==lastLiveMode){lastLiveMode=now;if(!active){modeSelect.value=now;options();apply()}}else if(active)showPreview()},180);
window.UIEditor={apply,options,scale,reset,start,stop,changeMode,close(){modeSelect.value=currentMode();options();apply(currentMode())}};modeSelect.value=currentMode();find('layoutToolbarMode').value=modeSelect.value;options();apply();
})();
