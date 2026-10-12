// Every browser is a client. Room ownership grants settings/start permissions only.
globalThis.isRoomOwner=false;
let serverSocket=null,serverPingTimer=null;
const pingLabel=document.createElement('div');
pingLabel.id='networkPing';pingLabel.textContent='서버 연결 전';
pingLabel.style.cssText='position:fixed;left:8px;top:8px;z-index:1000;color:#8ef5d1;background:#111b;padding:5px 8px;border-radius:5px;font:12px sans-serif;pointer-events:none';
document.body.appendChild(pingLabel);
function roomSettings(){return {mode:document.getElementById('gameModeSelect').value,aiToggle:document.getElementById('aiToggle').value==='true',aiCount:Number(document.getElementById('aiCountInput').value),aiDiff:document.getElementById('aiDifficultySelect').value};}
function sendServer(data){if(serverSocket?.readyState!==WebSocket.OPEN)return false;if(data.type==='SYNC'&&serverSocket.bufferedAmount>16384)return false;if(data.type==='SHOOT')serverSocket.send(JSON.stringify({type:'SYNC',player:networkEntityState(myPlayer)}));serverSocket.send(JSON.stringify(data));return true;}
function ownerUI(){
 document.getElementById('hostSettingsControls').style.display=isRoomOwner?'block':'none';
 document.getElementById('guestSettingsDisplay').style.display=isRoomOwner?'none':'block';
 document.getElementById('startButton').style.display=isRoomOwner?'block':'none';
 document.getElementById('guestWaitText').style.display=isRoomOwner?'none':'block';
 document.getElementById('waitingTitle').textContent=isRoomOwner?'대기실 · 서버 실행':'대기실';renderRoomRoles();
}
function connectServer(create,code){
 if(serverSocket&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(serverSocket.readyState))return;
 isHost=false;
 applyPlatformSetting(document.getElementById('platformSelect').value);
 const base=location.hostname.endsWith('github.io')?'wss://breach-qoxmfvlfem.onrender.com':`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}`;
 pingLabel.textContent='서버 연결 중…';
 const ws=new WebSocket(base+'/ws');serverSocket=ws;
 ws.onopen=()=>{
  sendServer({type:'JOIN',create,code,name:document.getElementById('nicknameInput').value.trim()||'플레이어',settings:roomSettings()});
  clearInterval(serverPingTimer);const ping=()=>sendServer({type:'PING',t:performance.now()});ping();serverPingTimer=setInterval(ping,1000);
 };
 ws.onmessage=e=>{
  const data=JSON.parse(e.data);
  if(data.type==='PONG'){const rtt=Math.max(0,Math.round(performance.now()-data.t));pingLabel.textContent=`서버 핑 ${rtt}ms`;pingLabel.style.color=rtt<=100?'#8ef5d1':'#ffd166';return;}
  if(data.type==='HELLO'){myPlayer.id=data.id;return;}
  if(data.type==='JOINED'){
   myPlayer.id=data.id;myPlayer.name=document.getElementById('nicknameInput').value.trim()||'플레이어';currentRoomCode=data.code;
   isRoomOwner=data.owner===myPlayer.id;setGuestConnectionUi(data.code);ownerUI();
   hostConn={open:true,send:sendServer,dataChannel:ws};return;
  }
  if(data.type==='OWNER'){isRoomOwner=data.id===myPlayer.id;ownerUI();return;}
  if(data.type==='ERROR'){alert(data.message);if(!hostConn)ws.close();return;}
  if(data.type==='START'&&gameStarted)return;
  handleNetworkData(data);
  if(data.type==='ROOM_ROLES'||data.type==='RETURN_TO_ROOM')ownerUI();
 };
 ws.onerror=()=>{pingLabel.textContent='서버 연결 실패';};
 ws.onclose=()=>{
  clearInterval(serverPingTimer);serverPingTimer=null;if(hostConn)hostConn.open=false;
  hostConn=null;serverSocket=null;isRoomOwner=false;myPlayer.isShooting=false;
  pingLabel.textContent='연결 끊김 · 방에 다시 입장하세요';
  if(gameStarted)returnToRoomAfterGame();
  document.getElementById('waitingRoom').style.display='none';document.getElementById('ui').style.display='flex';
 };
}
createRoom=()=>connectServer(true);
joinRoom=()=>{const code=document.getElementById('joinIdInput').value.trim();if(!/^\d{4}$/.test(code)){alert('숫자 4자리 방 코드를 입력해 주세요.');return;}connectServer(false,code);};
broadcastData=sendServer;
onHostSettingsChange=()=>{if(isRoomOwner)sendServer({type:'SETTINGS',...roomSettings()});};
hostStartGame=()=>{if(isRoomOwner&&!gameStarted){onHostSettingsChange();sendServer({type:'START_REQUEST'});}};
setRoomTeam=(id,value)=>sendServer({type:'CONTROL',action:'team',id,value:Number(value)});
setRoomSpectator=(id,value)=>sendServer({type:'CONTROL',action:'spectator',id,value});
setTeamMaxSize=value=>sendServer({type:'CONTROL',action:'teamSize',value:Number(value)});
// The server sends current state independently of any player's render loop.
// Client transforms still update locally, so walking/aiming never waits for RTT.
window.addEventListener('blur',()=>{myPlayer.isShooting=false;myPlayer.isAiming=false;mobileMoveVec={x:0,y:0};for(const k of Object.keys(keys))keys[k]=false;});
