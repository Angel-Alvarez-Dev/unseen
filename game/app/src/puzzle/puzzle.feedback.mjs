export function presentationFrames(p,cfg){
 if(!p)return [];
 const f=cfg.feedback,frames=[];
 const pulse=(group,zone,value,target=p.context?.t)=>frames.push({group,zone,target,ms:value*f.unitMs});
 const gap=ms=>frames.push({group:'idle',zone:-1,ms});
 if(p.response){pulse('B',p.response.d,p.response.context.B[p.response.d],p.response.context.t);gap(f.groupGapMs);}
 if(['context','response-context'].includes(p.kind)){
  for(const group of ['A','B']){p.context[group].forEach((v,i)=>{pulse(group,i,v);gap(f.channelGapMs);});gap(f.groupGapMs);}
 }
 if(p.kind==='reveal')frames.push({group:'reveal',zone:-1,ms:f.revealMs});
 return frames;
}
let audio;
export async function unlockAudio(){audio??=new AudioContext();await audio.resume();}
export function tone(frame,enabled){
 if(!enabled||!audio||frame.group==='idle')return ()=>{};
 const oscillator=audio.createOscillator(),gain=audio.createGain();
 oscillator.type=frame.group==='A'?'sine':'triangle';oscillator.frequency.value=frame.group==='A'?330:frame.group==='reveal'?660:440;
 gain.gain.setValueAtTime(0.025,audio.currentTime);gain.gain.linearRampToValueAtTime(0,audio.currentTime+frame.ms/1000);
 oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+frame.ms/1000);
 return ()=>{try{oscillator.stop();}catch{/* already stopped */}};
}
