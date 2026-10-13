/* General-mode equipment store. All purchases settle in SpikeRules.Match on the host. */
let spikeShopOpen=false,spikeShopRound=0,spikeShopRenderKey='',spikeShopSelected='v_vandal';
const spikeShopStyle=document.createElement('style');
spikeShopStyle.textContent=`
#spikeShop{position:absolute;inset:12px;z-index:120;display:none;background:#111c24f5;border:1px solid #5aaeb680;border-radius:12px;color:#e9efeb;overflow:auto;box-shadow:0 15px 60px #000b;font-family:inherit;padding:16px;box-sizing:border-box}
#spikeShop *{box-sizing:border-box}#spikeShop header{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #5aaeb650;padding-bottom:12px;position:sticky;top:-16px;background:#111c24;z-index:2}
#spikeShop h2{margin:0;font-size:21px;letter-spacing:2px}#spikeShop small{color:#a5b5bb}#spikeShop button{font:inherit;cursor:pointer;border-radius:5px;width:auto;margin:0;color:#edf5f2}
#spikeShop .shop-layout{display:grid;grid-template-columns:145px minmax(620px,1fr) 185px;gap:12px;margin-top:12px}
#spikeShop .shop-guns{display:grid;grid-template-columns:repeat(5,minmax(112px,1fr));gap:8px;align-items:start}
#spikeShop h3{font-size:12px;margin:5px 0 8px;color:#8cd9d0;letter-spacing:1px}#spikeShop .shop-card{width:100%;min-height:82px;margin:0 0 7px;padding:8px;background:#22323a;border:1px solid #61777755;text-align:left;position:relative;transition:background .12s,border-color .12s}
#spikeShop .shop-card:hover,#spikeShop .shop-card:focus-visible{background:#385154;border-color:#8ae3d4;outline:2px solid #8ae3d455}
#spikeShop .shop-card.owned{background:#31524b;border-color:#89b69a}#spikeShop .shop-card:disabled{opacity:.38;cursor:not-allowed}#spikeShop .shop-card img{display:block;width:100%;height:36px;object-fit:contain;margin:3px 0 6px;filter:drop-shadow(0 3px 3px #0009)}
#spikeShop .shop-card b{font-size:12px}#spikeShop .shop-card span{float:right;color:#e8bd69;font-size:12px}#spikeShop .shop-team{padding:9px;margin-bottom:7px;background:#253740;border-left:3px solid #69c3b7;overflow-wrap:anywhere;font-size:12px}
#spikeShop .shop-details{background:#1d2b34;padding:12px;min-height:160px;font-size:12px;line-height:1.7}#spikeShop .shop-details img{width:100%;height:64px;object-fit:contain}#spikeShop .shop-sell{background:#4d3937;border:1px solid #ae7970;padding:8px;margin:5px 0;width:100%}#spikeShop .shop-close{padding:8px 15px;background:#34565a;border:1px solid #80b4ae}#spikeShop .shop-credit{font-size:22px;color:#e8bd69;font-weight:800}#spikeShop footer{font-size:12px;color:#a7babd;border-top:1px solid #516b6b55;margin-top:12px;padding-top:10px}
@media(max-width:1050px){#spikeShop .shop-layout{grid-template-columns:minmax(610px,1fr) 160px}#spikeShop .shop-roster{display:none}}
@media(max-width:640px){#spikeShop{inset:4px;padding:10px}#spikeShop header{top:-10px;min-width:300px}#spikeShop h2{font-size:16px}#spikeShop .shop-layout{display:flex;flex-direction:column;min-width:0}#spikeShop .shop-guns{grid-template-columns:repeat(2,minmax(0,1fr))}#spikeShop .shop-details{min-height:0}#spikeShop .shop-credit{font-size:18px}}
`;
document.body.appendChild(spikeShopStyle);
const spikeShop=document.createElement('section');spikeShop.id='spikeShop';spikeShop.setAttribute('role','dialog');spikeShop.setAttribute('aria-label','장비 구매');spikeShop.setAttribute('aria-modal','true');
spikeShop.innerHTML='<header><div><small>FIELD ARMORY / 일반게임</small><h2>장비 구매</h2></div><div><span id="shopCredits" class="shop-credit"></span><br><small id="shopClock"></small></div><button class="shop-close" onclick="spikeToggleShop(false)">닫기 ×</button></header><div class="shop-layout"><aside id="shopRoster" class="shop-roster"></aside><div id="shopGuns" class="shop-guns"></div><aside><div id="shopArmor"></div><div id="shopDetails" class="shop-details"></div><div id="shopSell"></div></aside></div><footer>준비 시간 · 스폰 지역에서 구매 / 이번 준비 시간에 산 장비만 환불 가능<br>B 닫기 · 1 주무기 · 2 보조무기 / 시작 ¤800 · 처치 +200 · 설치 팀 +300 · 승리 +3000 · 연패 보상 1900 → 2400 → 2900 · 최대 ¤9000</footer>';
gameFrame.appendChild(spikeShop);
for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','contextmenu'])spikeShop.addEventListener(type,e=>{e.stopPropagation();if(type==='contextmenu')e.preventDefault();});
function spikeToggleShop(open=!spikeShopOpen){
 if(open&&(selectedMode!=='spike'||spikeState?.phase!=='prep'||myPlayer.isDead||!SpikeRules.inside(myPlayer,spikeSpawn(myPlayer))))return;
 spikeShopOpen=!!open;spikeShop.style.display=spikeShopOpen?'block':'none';myPlayer.isShooting=false;myPlayer.isAiming=false;spikeHeld=false;spikeShopRenderKey='';
 if(spikeShopOpen){spikeShopRefresh();document.querySelector?.('#spikeShop .shop-close')?.focus();}
}
window.addEventListener('keydown',e=>{
 if(selectedMode!=='spike'||!gameStarted)return;const k=e.key.toLowerCase();
 if(k==='b'||(k==='escape'&&spikeShopOpen)){e.preventDefault();e.stopImmediatePropagation?.();if(!e.repeat)spikeToggleShop(k==='escape'?false:undefined);}
 else if((k==='1'||k==='2')&&!e.repeat){e.preventDefault();spikeShopAction('switch',k==='1'?'primary':'secondary');}
 else if(spikeShopOpen&&k!=='tab'){e.preventDefault();e.stopImmediatePropagation?.();}
},true);
const shopEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function spikeShopInspect(id){
 spikeShopSelected=id;const w=SpikeCatalog.weapons[id],a=SpikeCatalog.armor[id],i=w||a;if(!i)return;
 document.getElementById('shopDetails').innerHTML=`<h3>${i.name}</h3><img src="${i.icon}" alt="${i.name}"><strong>¤ ${i.cost.toLocaleString()}</strong><br>`+(w?`탄창 ${w.maxClip}발 · ${w.fireRate.toFixed(2)}발/초<br>재장전 ${(w.reloadMs/1000).toFixed(2)}초<br>몸통 피해 ${w.damageRanges.map(r=>`${r.rangeStartMeters}m+: ${r.bodyDamage}`).join(' / ')}${w.pellets>1?`<br>산탄 ${w.pellets}발 / 발당 피해`:''}`:`보호막 ${a.capacity}<br>피해 흡수 ${Math.round(a.absorb*100)}%${a.pool?'<br>재생 예비량 50<br>피격 후 3초 뒤 재생':''}`);
}
function spikeShopRefresh(){
 if(selectedMode!=='spike'||!gameStarted||gameEnded||spikeState?.phase!=='prep'||myPlayer.isDead){if(spikeShopOpen)spikeToggleShop(false);return;}
 if(spikeShopRound!==spikeState.round){spikeShopRound=spikeState.round;spikeToggleShop(true);return;}
 if(!spikeShopOpen)return;
 if(!SpikeRules.inside(myPlayer,spikeSpawn(myPlayer))){spikeToggleShop(false);return;}
 document.getElementById('shopClock').textContent=`구매 종료까지 ${Math.max(0,Math.ceil(spikeState.time))}초`;
 document.getElementById('shopCredits').textContent=`¤ ${(myPlayer.credits||0).toLocaleString()}`;
 const key=JSON.stringify([myPlayer.credits,myPlayer.loadout,myPlayer.shieldType,myPlayer.shield,myPlayer.shieldPool,myPlayer.purchases,spikeState.actors?.map(p=>[p.id,p.credits])]);if(key===spikeShopRenderKey)return;spikeShopRenderKey=key;
 const card=i=>{const w=!!i.slot,slot=i.slot||'armor',owned=w?myPlayer.loadout?.[slot]?.id===i.id:myPlayer.shieldType===i.id&&myPlayer.shield===i.capacity&&myPlayer.shieldPool===i.pool;const affordable=(myPlayer.credits||0)+(myPlayer.purchases?.[slot]?.cost||0)>=i.cost;return `<button class="shop-card ${owned?'owned':''}" ${owned||!affordable?'disabled':''} onmouseenter="spikeShopInspect('${i.id}')" onfocus="spikeShopInspect('${i.id}')" onclick="spikeShopInspect('${i.id}');spikeShopAction('buy','${i.id}')"><b>${i.name}</b><span>${owned?'보유':i.cost?'¤ '+i.cost:'무료'}</span><img src="${i.icon}" alt="" loading="lazy"></button>`;};
 const columns=[[['보조 무기','Sidearm']],[['기관단총','SMG'],['산탄총','Shotgun']],[['소총','Rifle']],[['저격소총','Sniper']],[['중기관총','Heavy']]];
 document.getElementById('shopGuns').innerHTML=columns.map(groups=>'<div>'+groups.map(([title,cat])=>'<h3>'+title+'</h3>'+Object.values(SpikeCatalog.weapons).filter(w=>w.category===cat).sort((a,b)=>a.cost-b.cost).map(card).join('')).join('')+'</div>').join('');
 document.getElementById('shopArmor').innerHTML='<h3>방어구</h3>'+Object.values(SpikeCatalog.armor).sort((a,b)=>a.cost-b.cost).map(card).join('');
 document.getElementById('shopSell').innerHTML=Object.keys(myPlayer.purchases||{}).map(slot=>`<button class="shop-sell" onclick="spikeShopAction('sell','${slot}')">${slot==='armor'?'방어구':slot==='primary'?'주무기':'보조무기'} 환불 · ¤${myPlayer.purchases[slot].cost}</button>`).join('');
 document.getElementById('shopRoster').innerHTML='<h3>우리 팀</h3>'+(spikeState.actors||[]).filter(p=>p.teamId===myPlayer.teamId).map(p=>`<div class="shop-team">${shopEscape(getCombatEntityById(p.id)?.name||p.id)}<br><strong>¤ ${p.credits||0}</strong><br>${SpikeCatalog.weapons[p.weapon]?.name||'클래식'}</div>`).join('');spikeShopInspect(spikeShopSelected);
}
