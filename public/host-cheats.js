/* Host-local practice controls; never accept cheat flags from network players. */
const HostCheats=(()=>{
 const flags={invincible:false,ammo:false,bots:false};
 const panel=document.createElement('div');panel.id='hostCheatPanel';panel.style.cssText='display:none;border:1px solid #e0ad58;padding:8px;border-radius:6px;margin:8px 0;font-size:12px';
 panel.innerHTML='<strong style="color:#ffd18a">방장 전용 치트</strong><p style="font-size:11px;margin:5px 0">본인에게 적용 · 봇 정지는 방 전체 적용 · 대기실 복귀 시 해제</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">'+[['heal','체력 회복'],['shield','방어막 충전'],['money','자금 9,000'],['refill','탄약 충전'],['invincible','무적'],['ammo','무한 탄약'],['bots','봇 일시정지'],['time','라운드 +30초']].map(([id,label])=>`<button id="hostCheat_${id}" type="button" style="font-size:12px;padding:7px" onclick="HostCheats.act('${id}')">${label}</button>`).join('')+'</div><div id="hostCheatNotice" role="status" style="margin-top:5px"></div>';
 document.getElementById('settingsModal').appendChild(panel);
 const allowed=()=>isHost&&gameStarted&&!gameEnded;
 function refresh(){panel.style.display=isHost?'block':'none';for(const id of ['heal','shield','money','refill','invincible','ammo','bots','time']){const el=document.getElementById('hostCheat_'+id);el.disabled=!allowed()||(['shield','money','time'].includes(id)&&selectedMode!=='spike');if(id in flags){const labels={invincible:'무적',ammo:'무한 탄약',bots:'봇 일시정지'};el.textContent=labels[id]+' '+(flags[id]?'ON':'OFF');el.setAttribute('aria-pressed',String(flags[id]));}}}
 function refill(){const w=WEAPONS[myPlayer.weapon];if(!w)return;myPlayer.clipAmmo=w.maxClip;myPlayer.reserveAmmo=w.maxClip*4;myPlayer.isReloading=false;myPlayer._reloadToken=(myPlayer._reloadToken||0)+1;for(const item of Object.values(myPlayer.loadout||{}))if(item&&WEAPONS[item.id]){item.clip=WEAPONS[item.id].maxClip;item.reserve=item.clip*4;}}
 function act(id){if(!allowed())return false;let message='적용했습니다.';
  if(id in flags)flags[id]=!flags[id];
  else if(id==='heal'){if(myPlayer.isDead||myPlayer.hp<=0)return false;myPlayer.hp=myPlayer.maxHp||200;}
  else if(id==='refill'){if(myPlayer.isDead)return false;refill();}
  else if(id==='shield'&&selectedMode==='spike'){if(myPlayer.isDead)return false;myPlayer.shieldType='heavy';myPlayer.shield=50;myPlayer.shieldPool=0;}
  else if(id==='money'&&selectedMode==='spike')myPlayer.credits=9000;
  else if(id==='time'&&selectedMode==='spike'&&spikeMatch&&['prep','live','planted'].includes(spikeMatch.phase)){spikeMatch.time+=30;if(spikeMatch.bomb.planted)spikeMatch.bomb.timer+=30;}
  else return false;
  if(flags.ammo&&!myPlayer.isDead)refill();
  if(selectedMode==='spike'&&spikeMatch){spikeState=spikeMatch.snapshot();spikeUI();}updateHUD();refresh();document.getElementById('hostCheatNotice').textContent=message;return true;
 }
 const settings=openSettings;openSettings=()=>{settings();refresh();};
 const ai=updateAI;updateAI=()=>{if(allowed()&&flags.bots){for(const b of aiBots){b.isMoving=false;b.isShooting=false;b.moveSpeed=0;b._spikeUse=false;}return;}return ai();};
 const fire=shoot;shoot=(p,...args)=>{if(allowed()&&flags.ammo&&p===myPlayer&&!p.isDead&&p.hp>0&&!p.isReloading)refill();const result=fire(p,...args);if(allowed()&&flags.ammo&&p===myPlayer&&!p.isDead)refill();return result;};
 const leave=returnToRoomAfterGame;returnToRoomAfterGame=()=>{for(const key of Object.keys(flags))flags[key]=false;leave();refresh();};
 return {act,refresh,protect:p=>allowed()&&flags.invincible&&p===myPlayer};
})();
