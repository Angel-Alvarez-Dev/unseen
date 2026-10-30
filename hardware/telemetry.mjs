// Strict, read-only adapter for the compact Nano autonomous telemetry.
export function decodeGame(line) {
  const m=/^UNSEEN_GAME\/1 ((?:\d{1,10} ){16}\d{1,10})\r?\n$/.exec(line);
  if(!m)return null;
  const v=m[1].split(' ').map(Number);
  if(v.some(x=>x>0xffffffff))return null;
  const [seq,ms,session,state,g,remaining,selection,n,target,token,index,group,zone,frameTarget,duration,busy,flags]=v;
  if(state>4||g>3||remaining>15||selection>n||![0,3,4].includes(n)||target>=Math.max(1,n)||index>20||![65,66,82,105].includes(group)||zone>4||frameTarget>3||duration>10000||busy>1||flags>1023)return null;
  if(state>=2&&g!==3)return null;
  if(state>=3&&(!(flags&1)||remaining!==0))return null;
  if(state===4&&(flags&25)!==25)return null;
  const has=bit=>!!(flags&(1<<bit));
  if((has(3)||has(4))&&state!==4)return null;
  return {seq,ms,session,token,index,stale:false,
    s:{state:`S${state}`,g,R:[0,1,2,3].filter(r=>remaining&(1<<r)),selected:selection?selection-1:null,context:n?{A:Array(n).fill(0),t:target}:null,presentation:busy?{kind:group===82?'reveal':'hardware'}:null,logicComplete:has(0),irisOpen:has(3),win:has(4)},
    frame:{group:group===82?'reveal':group===105?'idle':String.fromCharCode(group),zone:zone-1,target:n?frameTarget:undefined,ms:duration},
    hardware:{commanded:has(1),travelFinished:has(2),lights:has(5),audioWired:has(6),audioOnline:has(7),servo:has(8),audioFailed:has(9)}};
}

export class GameDecoder {
  constructor(){this.last=null;}
  reset(){this.last=null;}
  decode(line){
    const next=decodeGame(line);if(!next)return null;
    if(this.last&&next.seq===this.last.seq&&next.ms===this.last.ms)return null;
    if(this.last){const delta=(next.seq-this.last.seq)>>>0;
      if(delta>0x80000000&&!(next.ms<this.last.ms&&next.ms<3000))return null;
    }
    this.last=next;return next;
  }
}
