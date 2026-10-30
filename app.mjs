import {prepareReward,playReward,stopReward} from './hardware/reward-audio.mjs';
import {Engine,correctInput,ranks} from './game/app/src/puzzle/puzzle.engine.mjs';
import {presentationFrames,tone,unlockAudio} from './game/app/src/puzzle/puzzle.feedback.mjs';
import {TouchInput} from './game/app/src/input/touch-input.mjs';
import geometry from './assets/contornos-cad.json?v=20261030-live-1' with {type:'json'};
import {mountLive} from './hardware/live.mjs';

const $=id=>document.getElementById(id);
const mmss=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const labels=['Azul','Verde','Rojo','Ausencia'];
let route='inicio',drawingId=0;
let live;
function prototypeMarkup(interactive=false){
 const id=`drawing-${++drawingId}`,c=geometry.iris,zoneNames=['izquierda','central','derecha'];
 const scale=c.r/65;
 const blades=Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60})"><path class="iris-blade-shape" d="M0 0 L-68 -39 L-67 -70 L7 -70 L24 -50 Z"/></g>`).join('');
 const details=geometry.details.map(d=>`<path d="${d}"/>`).join('');
 return `<svg class="cad-prototype reference-drawing" viewBox="${geometry.viewBox}" xmlns="http://www.w3.org/2000/svg" aria-label="UNSEEN: carcasa circular, panel azul a la izquierda, verde arriba, rojo abajo e iris a la derecha" ${interactive?'':'role="img"'}>
 <defs><clipPath id="${id}-iris"><circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/></clipPath></defs>
 <path class="cad-body" d="${geometry.body}"/>
 <g class="cad-zones">${geometry.zones.map((path,i)=>`<g class="cad-control" data-input="${zoneNames[i]}" data-index="${i}" ${interactive?`role="button" tabindex="0" aria-label="Sensor ${labels[i].toLowerCase()}: ${i===0?'anterior':i===1?'repetir o confirmar':'siguiente'}"`:''}><path class="cad-zone" data-zone="${i}" d="${path}"/><path class="target-outline" data-target-zone="${i}" d="${path}"/></g>`).join('')}</g>
 <g class="iris-unit"><path class="iris-ring iris-housing" d="${geometry.housing}"/><g class="mechanism-detail reference-mechanism">${details}</g>
 <g clip-path="url(#${id}-iris)"><circle class="iris-aperture" cx="${c.cx}" cy="${c.cy}" r="${c.r}"/><g class="piece-mark"><path d="M${c.cx-13} ${c.cy-17}h26v10h-10v21h-16Z"/><text x="${c.cx}" y="${c.cy+29}" text-anchor="middle">PIEZA</text></g><g class="iris-leaves" transform="translate(${c.cx} ${c.cy}) scale(${scale})">${blades}</g></g><circle class="iris-aperture-edge" cx="${c.cx}" cy="${c.cy}" r="${c.r}"/><circle class="absence-target" cx="${c.cx}" cy="${c.cy}" r="${c.r+7}"/></g>
 <g class="cad-labels reference-labels"><path d="M180 287V264H105"/><text x="105" y="253">01 / AZUL</text><path d="M457 130V93H552"/><text x="477" y="82">02 / VERDE</text><path d="M410 624V675H501"/><text x="430" y="691">03 / ROJO</text><text x="694" y="625">IRIS / APERTURA</text></g></svg>`;
}
function mountDrawings(){
 $('hero-prototype').innerHTML=prototypeMarkup();$('game-prototype').innerHTML=prototypeMarkup(true);wireTouch();renderGame();
}

const components=[
 {name:'Nano + expansión',short:'CONTROL',definition:'Microcontrolador con placa de conexiones.',function:'Lee las entradas y coordina la lógica y las salidas.',reason:'Reúne el control en una plataforma compacta y programable.'},
 {name:'Sensores capacitivos',short:'TACTO',definition:'Tres superficies que detectan el contacto.',function:'Permiten recorrer, repetir y confirmar.',reason:'La interacción ocurre sobre las superficies, sin un botón mecánico móvil.'},
 {name:'WS2812 · 3 × 8',short:'LUZ',definition:'Tiras de LEDs RGB direccionables.',function:'Hacen visibles las zonas, los impulsos y los ecos.',reason:'Cada zona puede cambiar de color e intensidad desde el programa.'},
 {name:'DFPlayer + microSD',short:'AUDIO',definition:'Reproductor de archivos de sonido.',function:'Reproduce las señales del objeto de forma autónoma.',reason:'Separa la reproducción de audio del control principal.'},
 {name:'Bocina · 4 Ω / 3 W',short:'ESCUCHA',definition:'Salida acústica del sistema.',function:'Convierte las pistas de audio en señales audibles.',reason:'La duración puede percibirse al escuchar y contrastarse con la luz.'},
 {name:'Microservo',short:'MOVIMIENTO',definition:'Actuador para el mecanismo de iris.',function:'Transforma una orden de control en movimiento.',reason:'Vincula la resolución lógica con una consecuencia física.'},
 {name:'Mecanismo de iris',short:'REVELACIÓN',definition:'Conjunto mecánico que abre y cierra una abertura.',function:'Revela la pieza faltante al terminar la apertura.',reason:'La comprensión culmina en una transformación visible del objeto.'},
 {name:'LiPo + USB-C + elevador',short:'ENERGÍA',definition:'Batería de 3,7 V, carga protegida y conversión a 5 V.',function:'Alimenta la electrónica del prototipo.',reason:'Permite plantear un objeto portátil con recarga. La alimentación integrada se valida por separado.'}
];
const slides=[
 {section:'QUÉ ES',title:'Una relación<br>que no se ve.',duration:40,body:'UNSEEN es una Mindpiece interactiva: descubrir una correspondencia oculta a través de sus respuestas.',tags:['TACTO','LUZ','SONIDO'],caption:'UNSEEN: “lo que no se ve”. El nombre remite a la conexión que el jugador debe descubrir.',visual:'prototype'},
 {section:'EL RETO',title:'Convertir una ausencia<br>en una pregunta.',duration:60,body:'La pieza está presente, pero todavía no es accesible. La invitación es observar, explorar y comprender.',tags:['OBSERVACIÓN','MEMORIA','CURIOSIDAD'],caption:'La temática pone el descubrimiento en el centro: las respuestas del objeto son las pistas.',visual:'journey'},
 {section:'LA EXPERIENCIA',title:'Explora.<br>Compara. Predice.',duration:75,body:'Toca una zona, observa el impulso y escucha el eco. Descubre qué relación se conserva cuando las señales cambian.',tags:['3 CASOS DE APRENDIZAJE','4 RESPUESTAS DE TRANSFERENCIA'],caption:'Comprender la correspondencia permite completar la ronda y abrir el iris. La victoria ocurre al finalizar la apertura.',visual:'signals'},
 {section:'MVP Y MATERIALES',title:'Probar lo esencial.<br>Construir desde ahí.',duration:60,body:'Una regla, tres entradas y una consecuencia visible. El MVP concentra el desarrollo en esa experiencia.',tags:['SIMULAR LA REGLA','COMPROBAR LA INTERACCIÓN','INTEGRAR EL OBJETO'],caption:'PLA beige mate: estructura y mecanismo. CR-PETG transparente: paneles documentados para el paso de luz; su efecto óptico requiere validación.',visual:'materials'},
 {section:'DECISIONES TÉCNICAS',title:'La electrónica<br>hace perceptible la pista.',duration:65,body:'Entradas, control y respuestas se integran al servicio del puzzle.',tags:['INGENIERÍA','DISEÑO','EXPERIENCIA'],caption:'Desde Ingeniería en Telecomunicaciones, Sistemas y Electrónica: convertir contacto en luz, sonido y movimiento.',visual:'components'}
];
let slideIndex=0,presentationSeconds=0,presentationRunning=false;
const boundaries=[0,...slides.map((_,i)=>slides.slice(0,i+1).reduce((n,s)=>n+s.duration,0))];
function slideVisual(type){
 if(type==='prototype')return `<div class="slide-drawing">${prototypeMarkup()}</div>`;
 if(type==='journey')return '<div class="journey-visual"><span>OBSERVA</span><i>↓</i><span>EXPLORA</span><i>↓</i><span>COMPRENDE</span><i>↓</i><span class="journey-last">REVELA</span></div>';
 if(type==='signals')return `<div class="slide-drawing signal-demo">${prototypeMarkup()}<div class="signal-demo-label"><span>IMPULSO</span><span>ECO</span></div></div>`;
 if(type==='materials')return '<figure class="cad-figure"><img src="assets/despiece-r19.png" alt="Vista CAD de desarrollo: carcasa separada y disposición interior de UNSEEN" loading="lazy"><figcaption>VISTA CAD / DESARROLLO DEL OBJETO</figcaption><div class="material-labels"><span>PLA BEIGE MATE</span><span>CR-PETG TRANSPARENTE</span></div></figure>';
 return `<div class="components-map"><p class="eyebrow">TOCA UN COMPONENTE PARA VER SU FUNCIÓN</p>${components.map((c,i)=>`<button data-component="${i}"><span>${String(i+1).padStart(2,'0')} / ${c.short}</span><strong>${c.name}</strong><i>↗</i></button>`).join('')}</div>`;
}
function renderSlide(){
 const s=slides[slideIndex];
 $('slide-content').innerHTML=`<div class="slide-copy"><p class="eyebrow">${String(slideIndex+1).padStart(2,'0')} / ${s.section} <span>${s.duration} S</span></p><h2>${s.title}</h2><p class="slide-body">${s.body}</p><div class="slide-tags">${s.tags.map(t=>`<span>${t}</span>`).join('')}</div><p class="slide-caption">${s.caption}</p></div><div class="slide-visual">${slideVisual(s.visual)}</div>`;
 $('slide-progress').innerHTML=slides.map((s,i)=>`<button aria-label="Lámina ${i+1}: ${s.section}" aria-current="${i===slideIndex?'step':'false'}" data-slide="${i}" style="--weight:${s.duration}"><i></i><span>${String(i+1).padStart(2,'0')}</span></button>`).join('');
 $('slide-number').textContent=`${String(slideIndex+1).padStart(2,'0')} / 05`;$('slide-prev').disabled=slideIndex===0;$('slide-next').textContent=slideIndex===4?'Ir al video →':'Siguiente →';
 document.querySelectorAll('[data-slide]').forEach(b=>b.addEventListener('click',()=>goSlide(Number(b.dataset.slide))));
 document.querySelectorAll('[data-component]').forEach(b=>b.addEventListener('click',()=>showComponent(Number(b.dataset.component))));
 updatePresentationClock();
}
function goSlide(i){slideIndex=Math.max(0,Math.min(4,i));presentationSeconds=boundaries[slideIndex];renderSlide();}
function updatePresentationClock(){$('presentation-clock').textContent=`${mmss(presentationSeconds)} / 05:00`;$('presentation-play').textContent=presentationRunning?'Pausar':presentationSeconds===300?'Repetir':'Comenzar';}
function showComponent(index){const c=components[index];$('component-name').textContent=c.name;$('component-definition').textContent=c.definition;$('component-function').textContent=c.function;$('component-reason').textContent=c.reason;$('component-dialog').showModal();}
$('close-component').addEventListener('click',()=>$('component-dialog').close());
$('component-dialog').addEventListener('click',e=>{if(e.target===$('component-dialog'))$('component-dialog').close();});
$('presentation-play').addEventListener('click',()=>{if(presentationSeconds>=300){presentationSeconds=0;slideIndex=0;renderSlide();}presentationRunning=!presentationRunning;updatePresentationClock();});
$('presentation-reset').addEventListener('click',()=>{presentationRunning=false;goSlide(0);});
$('slide-prev').addEventListener('click',()=>goSlide(slideIndex-1));
$('slide-next').addEventListener('click',()=>{if(slideIndex===4)location.hash='video';else goSlide(slideIndex+1);});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreen').textContent='Usa F11 para pantalla completa';}});

// The M1 engine/configuration below are copied byte-for-byte from the frozen source.
// Guided mode changes assistance and click gestures only, never its transitions.
const engine=new Engine();let mode='guided',hintLevel=0,frame=null,currentToken=null,frameTimer=null,stopSound=()=>{},gesture=0,contact='',startedAt=0,finishedSeconds=null;
let soundWanted=true,audioReady=false;
async function ensureAudio(){if(!soundWanted)return;try{await Promise.all([unlockAudio(),prepareReward()]);audioReady=true;$('audio-toggle').textContent='Sonido activo ♪';$('audio-toggle').setAttribute('aria-pressed','true');}catch{$('game-feedback').textContent='El navegador no activó el audio. Pulsa Activar sonido; las señales visuales siguen disponibles.';}}
const input=new TouchInput({read:()=>({s:engine.s,session:engine.session,locked:route!=='juego'}),send:sendGame,contact:()=>void ensureAudio(),change:a=>{contact=a?.zone||'';renderPrototypeState();},schedule:(fn,ms)=>setTimeout(fn,ms),unschedule:id=>clearTimeout(id)});
function explicitAction(type,extra={}){void ensureAudio();return sendGame({type,...extra,stable:true,gesture:`guided-${engine.session}-${++gesture}`});}
function sendGame(event){
 const before=engine.snapshot(),accepted=engine.dispatch({session:engine.session,...event});
 if(!accepted)return false;
 if(event.type==='WAKE')startedAt=performance.now();
 if(event.type==='CONFIRM'){
  const ok=engine.s.g>before.g||engine.s.R.length<before.R.length||engine.s.logicComplete;
  $('game-feedback').textContent=ok?'La respuesta llegó al destino.':before.state==='S2'?'Prueba otra vez: se reinició la ronda final; conservas el aprendizaje.':'Compara de nuevo: el destino era otro.';
  hintLevel=0;
 }
 if(event.type==='REPEAT'){$('game-feedback').textContent='Observa de nuevo los mismos grupos.';hintLevel=0;}
 syncPresentation();renderGame();return true;
}
function syncPresentation(){
 const p=engine.s.presentation;if(!p||p.token===currentToken)return;
 currentToken=p.token;clearTimeout(frameTimer);stopSound();
 const frames=presentationFrames(p,engine.config),session=engine.session,token=p.token;let index=0;
 function next(){
  if(engine.session!==session||engine.s.presentation?.token!==token)return;
  stopSound();frame=frames[index++];
  if(!frame){engine.dispatch({type:p.kind==='reveal'?'REVEAL_END':'PRESENTATION_END',token,session});currentToken=null;frame=null;if(engine.s.win)finishedSeconds=(performance.now()-startedAt)/1000;renderGame();return;}
  if(route==='juego'&&!document.hidden)stopSound=tone(frame,soundWanted&&audioReady);
  renderPrototypeState();renderSignal();frameTimer=setTimeout(next,frame.ms);
 }
 next();
}
function resetGame(){stopReward();input.cancel();clearTimeout(frameTimer);stopSound();engine.reset();frame=null;currentToken=null;hintLevel=0;startedAt=0;finishedSeconds=null;$('game-feedback').textContent='';renderGame();}
function setMode(next){mode=next;resetGame();$('mode-guided').setAttribute('aria-pressed',String(mode==='guided'));$('mode-full').setAttribute('aria-pressed',String(mode==='full'));$('game-mode-description').textContent=mode==='guided'?'Recorrido asistido: pide pistas cuando las necesites. Conserva las siete rondas y la misma regla; cinco minutos es una orientación, no un límite.':'Experiencia completa: explora con las tres siluetas táctiles, sin opciones sugeridas. Sin límite de tiempo; la duración depende de tu exploración.';}
function renderGame(){
 const s=engine.s,busy=!!s.presentation,guided=mode==='guided';
 const names={S0:'Despierta UNSEEN.',S1:'Explora y compara.',S2:'Ahora, predice.',S3:'El iris se está abriendo.',S4:'Descubriste la relación.'};
 const phase={S0:'PRESENCIA',S1:'APRENDIZAJE',S2:'TRANSFERENCIA',S3:'APERTURA',S4:'WIN / IRIS ABIERTO'};
 $('game-phase').textContent=phase[s.state];$('game-state-title').textContent=names[s.state];
 $('game-step').textContent=s.state==='S1'?`CASO ${s.g+1} DE 3`:s.state==='S2'?`RESPUESTA ${5-s.R.length} DE 4`:s.state==='S0'?'ANTES DE EMPEZAR':s.state==='S3'?'LA RONDA ESTÁ COMPLETA':'RESOLUCIÓN DIGITAL';
 $('game-instruction').textContent=busy?'Escucha y observa. Espera a que terminen las señales.':s.state==='S0'?guided?'Pulsa Iniciar. También puedes mantener la silueta verde 0,65 segundos.':'Mantén la silueta verde 0,65 segundos para empezar.':s.state==='S1'?'El contorno discontinuo marca el destino. Recorre los impulsos y compara el eco antes de confirmar.':s.state==='S2'?'Elige el impulso que llegará al destino. Ahora la elección no muestra el eco antes de confirmar.':s.state==='S3'?'La victoria llega al terminar la apertura, no al comenzar el movimiento.':'El iris terminó de abrirse y reveló la pieza.';
 $('game-progress').innerHTML=`<div><span>APRENDIZAJE</span>${Array.from({length:3},(_,i)=>`<i class="${s.g>i?'done':''}" aria-label="Aprendizaje ${i+1}${s.g>i?' completado':''}"></i>`).join('')}</div><div><span>TRANSFERENCIA</span>${Array.from({length:4},(_,i)=>`<i class="${s.state==='S2'&&4-s.R.length>i||s.logicComplete?'done':''}" aria-label="Transferencia ${i+1}"></i>`).join('')}</div>`;
 const n=s.context?.A.length||0;
 $('channel-options').innerHTML=Array.from({length:n},(_,i)=>`<span class="option-tag ${s.selected===i?'selected':''} ${s.context.t===i?'destination':''}"><b>${i+1}</b>${labels[i]}${s.context.t===i?'<small>DESTINO</small>':''}${s.selected===i?'<small>ELEGIDO</small>':''}</span>`).join('');
 const active=['S1','S2'].includes(s.state);
 $('guided-action').hidden=!guided||!['S0','S1','S2'].includes(s.state);
 $('guided-action').disabled=busy||s.state!=='S0'&&s.selected===null&&hintLevel<3;
 $('guided-action').textContent=s.state==='S0'?'Iniciar →':s.selected!==null?'Confirmar elección →':hintLevel>=3?`Seleccionar opción sugerida ${correctInput(s.context)+1} →`:'Elige con las siluetas';
 $('repeat-signals').hidden=!guided||!active;$('repeat-signals').disabled=busy;
 $('hint-panel').hidden=!guided||!active;$('request-hint').disabled=busy||hintLevel>=3;
 $('request-hint').textContent=hintLevel===0?'Necesito una pista':hintLevel===1?'Aclarar la relación':hintLevel===2?'Mostrar una opción sugerida':'Pistas mostradas';
 const q=s.context?ranks(s.context.B)[s.context.t]:0;
 $('hint-text').textContent=hintLevel===0?'':hintLevel===1?'Compara el lugar de cada duración dentro de su grupo; no busques sonidos iguales.':hintLevel===2?`El destino ocupa el lugar ${q+1} de ${n}, ordenando sus ecos de menor a mayor. Busca ese mismo lugar entre los impulsos.`:`La opción ${correctInput(s.context)+1} tiene el mismo rango que el destino. Puedes seleccionarla y comprobar la respuesta.`;
 $('game-win').hidden=!s.win;if(s.win&&route==='juego'&&soundWanted)playReward(engine.session);
 renderPrototypeState();renderSignal();updateGameClock();
}
function renderPrototypeState(){
 const svg=$('game-prototype').querySelector('svg');if(!svg)return;
 const s=engine.s,busy=!!s.presentation;
 svg.dataset.state=s.state;svg.classList.toggle('opening',frame?.group==='reveal');svg.classList.toggle('opened',s.irisOpen);
 const target=frame?.target??s.context?.t;
 svg.querySelectorAll('.cad-control').forEach((g,i)=>{
  g.classList.toggle('contact',contact===['izquierda','central','derecha'][i]);g.classList.toggle('selected',s.selected===i);g.classList.toggle('target',target===i&&s.state!=='S0');g.classList.toggle('pulse',frame?.zone===i||frame?.zone===3);g.classList.toggle('echo',frame?.group==='B');g.classList.toggle('white-pulse',frame?.zone===3);g.setAttribute('aria-disabled',String(busy||!['S0','S1','S2'].includes(s.state)));g.setAttribute('aria-label',`Sensor ${labels[i].toLowerCase()}: ${i===0?'anterior':i===1?'repetir o confirmar':'siguiente'}${contact===['izquierda','central','derecha'][i]?', tocado':''}`);
 });
 svg.querySelector('.absence-target')?.classList.toggle('visible',target===3||s.selected===3);
}
function renderSignal(){
 const f=frame,active=f&&['A','B'].includes(f.group);$('signal-group').textContent=active?f.group==='A'?'IMPULSO':'ECO':f?.group==='reveal'?'ABRIENDO EL IRIS':engine.s.win?'WIN / IRIS ABIERTO':engine.s.presentation?'PAUSA ENTRE SEÑALES':'LISTO PARA TOCAR';
 $('signal-zone').textContent=active?`OPCIÓN ${f.zone+1} / ${labels[f.zone].toUpperCase()}`:'LUZ + SONIDO';
 const meter=$('signal-meter-fill');meter.style.background=active?['var(--blue)','var(--green)','var(--red)','#eee'][f.zone]:'transparent';meter.style.opacity=f?.group==='A'?'.55':'1';meter.style.width=active?'100%':'0';
}
function updateGameClock(){const t=finishedSeconds??(startedAt?(performance.now()-startedAt)/1000:0);$('game-elapsed').textContent=`${mmss(t)} · ${engine.s.win?'RECORRIDO COMPLETADO':'SIN CONTRARRELOJ'}`;}
function wireTouch(){
 $('game-prototype').querySelectorAll('[data-input]').forEach(g=>{
  const zone=g.dataset.input;
  g.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;e.preventDefault();g.focus({preventScroll:true});if(input.begin(zone))g.setPointerCapture(e.pointerId);});
  g.addEventListener('pointerup',()=>input.end(zone));g.addEventListener('pointercancel',()=>input.cancel());g.addEventListener('lostpointercapture',()=>input.cancel());g.addEventListener('blur',()=>input.cancel());
  g.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)input.begin(zone);}});g.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();input.end(zone);}});
 });
}
$('guided-action').addEventListener('click',()=>{if(engine.s.state==='S0')explicitAction('WAKE');else if(engine.s.selected!==null)explicitAction('CONFIRM');else if(hintLevel>=3)explicitAction('SELECT',{i:correctInput(engine.s.context)});});
$('request-hint').addEventListener('click',()=>{hintLevel=Math.min(3,hintLevel+1);renderGame();});
$('repeat-signals').addEventListener('click',()=>explicitAction('REPEAT'));
$('game-reset').addEventListener('click',resetGame);$('play-again').addEventListener('click',resetGame);
$('mode-guided').addEventListener('click',()=>setMode('guided'));$('mode-full').addEventListener('click',()=>setMode('full'));
$('audio-toggle').addEventListener('click',async()=>{if(audioReady&&soundWanted){soundWanted=false;stopSound();stopReward();$('audio-toggle').textContent='Activar sonido ♪';$('audio-toggle').setAttribute('aria-pressed','false');}else{soundWanted=true;await ensureAudio();}});
window.addEventListener('blur',()=>{input.cancel();stopSound();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){input.cancel();stopSound();}});

// A local selection is an object URL in this browser, never an upload.
let localVideoURL=null,publishedVideoURL=null;
function clearLocalVideo(){if(localVideoURL)URL.revokeObjectURL(localVideoURL);localVideoURL=null;$('local-video').value='';$('clear-video').hidden=true;$('video-duration').textContent='';if(publishedVideoURL){$('project-video').src=publishedVideoURL;$('project-video').hidden=false;$('video-placeholder').hidden=true;$('video-status').textContent='Video incorporado al sitio.';}else{$('project-video').pause();$('project-video').removeAttribute('src');$('project-video').load();$('project-video').hidden=true;$('video-placeholder').hidden=false;$('video-status').textContent='Seleccionar un archivo permite reproducirlo solo en este dispositivo. No lo sube ni lo publica.';}}
$('local-video').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(localVideoURL)URL.revokeObjectURL(localVideoURL);localVideoURL=URL.createObjectURL(file);const v=$('project-video');v.src=localVideoURL;v.hidden=false;$('video-placeholder').hidden=true;$('clear-video').hidden=false;$('video-status').textContent=`Archivo local: ${file.name}. Solo en este dispositivo; no está subido ni publicado.`;v.load();});
$('clear-video').addEventListener('click',clearLocalVideo);
$('project-video').addEventListener('loadedmetadata',()=>{const v=$('project-video'),seconds=v.duration;$('video-duration').textContent=Number.isFinite(seconds)?`Duración: ${mmss(seconds)}`:'Duración no disponible';});
$('project-video').addEventListener('error',()=>{$('video-status').textContent='No se pudo reproducir ese archivo. Prueba un MP4 compatible; el archivo no se ha publicado.';});
fetch('media.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(typeof data.video==='string'&&data.video.startsWith('assets/')){publishedVideoURL=data.video;clearLocalVideo();}}).catch(()=>{});

function navigate(){
 const requested=location.hash.slice(1),next=['inicio','presentacion','juego','video','en-vivo'].includes(requested)?requested:'inicio';
 if(next==='presentacion'&&route!==next){presentationSeconds=0;slideIndex=0;presentationRunning=false;renderSlide();}
 if(route!==next){input.cancel();stopSound();stopReward();$('project-video').pause();if(next!=='presentacion')presentationRunning=false;}
 route=next;document.querySelectorAll('.route').forEach(s=>s.hidden=s.id!==route);document.querySelectorAll('.site-header nav a').forEach(a=>a.setAttribute('aria-current',a.hash===`#${route}`?'page':'false'));live?.setVisible(route==='en-vivo');
 document.title=`${{inicio:'UNSEEN — The Missing Piece',presentacion:'Conoce UNSEEN',juego:'Juega UNSEEN',video:'Video UNSEEN','en-vivo':'UNSEEN conectado'}[route]} · Team Nodo`;
 renderGame();window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',navigate);
window.addEventListener('keydown',e=>{if(route!=='presentacion'||['INPUT','VIDEO'].includes(e.target.tagName)||$('component-dialog').open)return;if(e.key==='ArrowRight'){e.preventDefault();if(slideIndex<4)goSlide(slideIndex+1);}if(e.key==='ArrowLeft'){e.preventDefault();goSlide(slideIndex-1);}});
setInterval(()=>{if(presentationRunning&&route==='presentacion'&&!document.hidden){presentationSeconds=Math.min(300,presentationSeconds+1);const next=Math.min(4,boundaries.findIndex((n,i)=>i>0&&presentationSeconds<n)-1);if(next>=0&&next!==slideIndex){slideIndex=next;renderSlide();}if(presentationSeconds===300)presentationRunning=false;updatePresentationClock();}if(route==='juego')updateGameClock();},1000);
mountDrawings();live=mountLive(prototypeMarkup);renderSlide();navigate();

document.addEventListener('pointerdown',()=>{if(soundWanted)void ensureAudio();});document.addEventListener('keydown',()=>{if(soundWanted)void ensureAudio();});
