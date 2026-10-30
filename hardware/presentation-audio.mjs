// Same tracks as the project's DFPlayer microSD bank. Browser output only.
let audio;
const decoded=new Map(),loading=new Map();
const context=()=>audio??=new AudioContext();
function trackFor(frame){
 if(frame.group==='reveal')return 31;
 if(frame.group==='WIN')return 32;
 if(!['A','B'].includes(frame.group))return 0;
 return Math.max(1,Math.min(15,Math.round(frame.ms/90)))+(frame.group==='B'?15:0);
}
function load(id){
 if(!loading.has(id))loading.set(id,fetch(new URL(`../assets/audio/${String(id).padStart(4,'0')}.mp3`,import.meta.url)).then(r=>{if(!r.ok)throw Error('Audio no disponible');return r.arrayBuffer();}).then(data=>context().decodeAudioData(data)).then(buffer=>decoded.set(id,buffer)).catch(()=>{}));
 return loading.get(id);
}
export function preloadAudio(){for(let id=1;id<=32;id++)void load(id);}
export async function unlockAudio(){await context().resume();}
// Exact waveform from scripts/build-audio.py, available immediately while MP3s load.
function master(id){
 const rate=32000,ms=id<=15?id*90:id<=30?(id-15)*90:id===31?1800:1200,total=ms/1000;
 const buffer=context().createBuffer(1,Math.round(total*rate),rate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++){
  const t=i/rate;let envelope=Math.min(1,t/.008,Math.max(0,(total-t)/.012)),value;
  if(id<=15)value=Math.sin(2*Math.PI*330*t);
  else if(id<=30)value=(Math.sin(2*Math.PI*440*t)+.12*Math.sin(2*Math.PI*880*t))/1.12;
  else if(id===31){value=(Math.sin(2*Math.PI*(220*t+110*t*t))+.3*Math.sin(2*Math.PI*660*t))/1.3;envelope*=.5+.5*Math.sin(Math.PI*t/total);}
  else{const frequency=[440,554.365,659.255,880][Math.min(3,Math.floor(t/.3))],local=t%.3;envelope*=Math.min(1,local/.01,Math.max(0,(.3-local)/.045));value=Math.sin(2*Math.PI*frequency*t);}
  data[i]=Math.round(32767*.22*envelope*value)/32768;
 }
 return buffer;
}
export function tone(frame,enabled=true){
 const id=trackFor(frame);if(!enabled||!id)return ()=>{};
 const ctx=context();void ctx.resume().catch(()=>{});void load(id);
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=decoded.get(id)||master(id);gain.gain.value=.9;
 source.connect(gain);gain.connect(ctx.destination);source.start();
 source.addEventListener('ended',()=>{source.disconnect();gain.disconnect();},{once:true});
 return ()=>{try{source.stop();}catch{}};
}
