// Recompensa de presentación: adaptación instrumental breve, separada del motor.
const notes=[
 [392,1],[392,1],[392,1],[523.25,2],[659.25,3],
 [392,1],[392,1],[392,1],[523.25,2],[659.25,3],
 [523.25,1],[523.25,1],[493.88,1],[493.88,1],[440,1],[440,1],[392,3],
 [392,1],[392,1],[392,1],[493.88,2],[587.33,3],
 [392,1],[392,1],[392,1],[493.88,2],[587.33,3],
 [698.46,1],[698.46,1],[659.25,1],[659.25,1],[587.33,1],[587.33,1],[523.25,3]
];
let audio,generation=0,lastSession=null,oscillators=[];
export async function prepareReward(){audio??=new AudioContext();await audio.resume();}
export function stopReward(){generation++;for(const oscillator of oscillators){try{oscillator.stop();}catch{}}oscillators=[];}
export function playReward(session){
 if(session===lastSession)return;
 lastSession=session;stopReward();const ticket=generation;
 void prepareReward().then(()=>{
  if(ticket!==generation)return;
  let at=audio.currentTime+.03;
  for(const [frequency,units] of notes){
   const duration=units*.18,oscillator=audio.createOscillator(),gain=audio.createGain();
   oscillator.type='triangle';oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.008);gain.gain.linearRampToValueAtTime(0,at+duration);
   oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+duration);oscillators.push(oscillator);at+=duration+.045;
  }
 }).catch(()=>{});
}
