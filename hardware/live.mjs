import {SerialSession} from './serial-session.mjs';
import {NanoDecoder,nanoProfile} from './nano-profile.mjs';
import {GameDecoder} from './telemetry.mjs';
import {tone,unlockAudio} from '../game/app/src/puzzle/puzzle.feedback.mjs';

export function mountLive(markup){
 const $=id=>document.getElementById(id),names=['Azul','Verde','Rojo'];
 $('live-prototype').innerHTML=markup();
 const sensors=new NanoDecoder(),game=new GameDecoder();
 let sensorData=null,gameData=null,sensorAt=0,gameAt=0,openedAt=0,visible=false,sound=false,stop=()=>{},frameKey='',accepted=0,session;
 const fresh=t=>t>0&&performance.now()-t<750;
 function silence(){stop();stop=()=>{};}
 function clear(){sensors.reset();game.reset();sensorData=null;gameData=null;sensorAt=gameAt=0;frameKey='';silence();render();}
 function render(){
  const connected=session?.state==='conectado',sf=connected&&fresh(sensorAt),gf=connected&&fresh(gameAt),svg=$('live-prototype').querySelector('svg');
  const s=gf?gameData.s:null,f=gf&&s.presentation?gameData.frame:null,h=gf?gameData.hardware:null;
  svg.classList.toggle('opening',!!(h?.commanded&&!s?.irisOpen));svg.classList.toggle('opened',!!s?.irisOpen);svg.dataset.state=s?.state||'sin-datos';
  svg.classList.toggle('live-stale',!sf&&!gf);
  svg.querySelectorAll('.cad-control').forEach((g,i)=>{
   const touch=sf&&sensorData.levels[i].active;
   g.classList.toggle('contact',!!touch);g.classList.toggle('pulse',!!(f&&['A','B'].includes(f.group)&&(f.zone===i||f.zone===3)));
   g.classList.toggle('echo',f?.group==='B');g.classList.toggle('white-pulse',!!(f&&['A','B'].includes(f.group)&&f.zone===3));g.classList.toggle('selected',s?.selected===i);g.classList.toggle('target',s?.context?.t===i);
   const badge=$(`live-sensor-${i}`);badge.classList.toggle('active',!!touch);badge.querySelector('b').textContent=sf?touch?'TOCADO':'LIBRE':'SIN DATOS';
  });
  svg.querySelector('.absence-target')?.classList.toggle('visible',s?.selected===3||s?.context?.t===3);
  $('live-phase').textContent=s?({S0:'PRESENCIA',S1:'APRENDIZAJE',S2:'TRANSFERENCIA',S3:'APERTURA PENDIENTE',S4:'WIN REPORTADO'})[s.state]:sf?'SENSORES CONECTADOS':'ESPERANDO UNSEEN';
  $('live-stage').textContent=s?({S0:'Despierta el objeto.',S1:`Aprendizaje ${s.g+1} de 3`,S2:`Transferencia ${5-s.R.length} de 4`,S3:h.commanded?'El Arduino ordenó abrir.':'La secuencia terminó.',S4:'El Arduino reporta apertura.'})[s.state]:'Conecta el prototipo para empezar.';
  $('live-instruction').textContent=s?.state==='S0'?'Mantén el sensor verde 0,65 s y suelta.':s?.state==='S3'?(h.servo?'Esperando la confirmación de apertura del firmware.':'El firmware mantiene el iris bloqueado: falta calibración.'):'Toca los sensores del objeto. La web acompaña sus respuestas.';
  $('live-signal').textContent=f?f.group==='A'?'IMPULSO':f.group==='B'?'ECO':f.group==='reveal'?'REVELACIÓN':'PAUSA':gf?'LISTO PARA TOCAR':'SIN TELEMETRÍA DEL JUEGO';
  $('live-signal-zone').textContent=f&&['A','B'].includes(f.group)?`OPCIÓN ${f.zone+1} / ${names[f.zone]||'AUSENCIA'}`:'LUZ + SONIDO';
  $('live-audio-state').textContent=!h?'Sin datos':h.audioOnline?'Módulo responde':h.audioFailed?'Módulo sin respuesta':'Esperando módulo';
  $('live-iris-state').textContent=!h?'Sin datos':s.irisOpen?'Apertura reportada':!h.servo?'Pendiente de calibración':h.commanded?'Apertura ordenada':'En espera';
  $('live-messages').textContent=String(accepted);
  const key=gf&&f?`${gameData.session}:${gameData.token}:${gameData.index}:${f.group}`:'';
  if(!visible||!sound||!gf){silence();frameKey='';}
  else if(key!==frameKey){silence();frameKey=key;if(f&&['A','B'].includes(f.group))stop=tone(f,true);}
  if(connected){$('live-status').textContent=sf&&gf?'UNSEEN conectado · sensores y juego en vivo':sf?'Sensores recibidos · esperando telemetría del juego':gf?'Juego recibido · esperando sensores':accepted===0&&performance.now()-openedAt<3000?'Conectado · esperando datos compatibles…':'Sin datos recientes. Revisa cable, puerto y firmware.';}
 }
 session=new SerialSession({serial:globalThis.navigator?.serial,onChange:snapshot=>{
  $('live-connect').disabled=snapshot.state==='conectando'||snapshot.state==='conectado';$('live-disconnect').disabled=!['conectando','conectado'].includes(snapshot.state);
  if(snapshot.state!=='conectado')$('live-status').textContent=snapshot.error||({desconectado:'Sin conexión. El juego virtual sigue disponible.',conectando:'Selecciona el puerto del Arduino…',error:'Conexión interrumpida.'})[snapshot.state];
  if(snapshot.state==='conectado'&&!openedAt)openedAt=performance.now();render();
 },onMessage:line=>{
  const sensor=sensors.decode(line);if(sensor&&!sensor.duplicate){sensorData=sensor;sensorAt=performance.now();accepted++;}
  const sample=game.decode(line);if(sample){gameData=sample;gameAt=performance.now();accepted++;}
  if(sensor||sample)render();
 },onStop:()=>{openedAt=0;clear();}});
 const supported=!!globalThis.navigator?.serial&&globalThis.isSecureContext;
 if(!supported){$('live-connect').disabled=true;$('live-status').textContent='Para conectar usa Chrome o Edge de escritorio y abre esta web en HTTPS.';}
 $('live-connect').addEventListener('click',()=>{if(!supported)return;clear();accepted=0;openedAt=0;void session.connect(nanoProfile.serialOptions,[]);});
 $('live-disconnect').addEventListener('click',()=>void session.disconnect());
 $('live-sound').addEventListener('click',async()=>{if(!sound){try{await unlockAudio();sound=true;}catch{$('live-status').textContent='No se pudo activar el audio de la laptop.';return;}}else{sound=false;silence();}frameKey='';$('live-sound').setAttribute('aria-pressed',String(sound));$('live-sound').textContent=sound?'Silenciar laptop ♪':'Audio en laptop ♪';render();});
 const timer=setInterval(render,200);window.addEventListener('pagehide',()=>{clearInterval(timer);silence();void session.disconnect();},{once:true});
 render();return {setVisible(value){visible=value;frameKey='';render();}};
}
