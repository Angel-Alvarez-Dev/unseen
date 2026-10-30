import canonical from '../../../configs/unseen-v1.json' with { type: 'json' };
export const config = canonical;
const structural = x => Array.isArray(x) ? x.map(structural) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,structural(x[k])])) : x;
export function parseConfig(text) {
  const x=JSON.parse(text);
  if (!x || typeof x!=='object' || Array.isArray(x)) throw Error('Configuración: objeto requerido');
  if (!x.metadata || Object.keys(x.metadata).sort().join()!=='id,team,version' || Object.values(x.metadata).some(v=>typeof v!=='string'||!v.trim()||v.length>160)) throw Error('Metadata inválida');
  if(x.metadata.id!=='UNSEEN-V1'||x.metadata.version!==canonical.metadata.version) throw Error('Versión no soportada');
  const a={...x,metadata:canonical.metadata};
  if(JSON.stringify(structural(a))!==JSON.stringify(structural(canonical))) throw Error('Perfil operativo incompatible con V1; no se aplicó ningún cambio');
  return x;
}
export const exportConfig = (c=config) => JSON.stringify(parseConfig(JSON.stringify(c)),null,2);
export function random(seed=1) {
 let a=seed>>>0;
 return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
function shuffle(r,a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function ranks(a){if(!Array.isArray(a)||![3,4].includes(a.length)||a.some(v=>!Number.isFinite(v)||v<=0)||new Set(a).size!==a.length)throw Error('Grupo inválido');return a.map(v=>a.filter(w=>w<v).length);}
export function destination(c,i){if(!Number.isInteger(i)||i<0||i>=c.A.length)throw Error('Canal inválido');return ranks(c.B).indexOf(ranks(c.A)[i]);}
export const correctInput=c=>ranks(c.A).indexOf(ranks(c.B)[c.t]);
const norm=a=>a.map(v=>(v-Math.min(...a))/(Math.max(...a)-Math.min(...a)));
const closest=(a,v)=>a.reduce((best,x,i)=>Math.abs(x-v)<Math.abs(a[best]-v)?i:best,0);
export function contrastive(c,q){const i=correctInput(c),t=c.t;
 if(q===0)return t!==i&&t!==(i+1)%3;
 if(q===1)return closest(c.B,c.A[i])!==t&&closest(norm(c.B),norm(c.A)[i])!==t&&closest(norm(c.A),norm(c.B)[t])!==i;
 return true;
}
export function context(r,n,q,final=false){
 for(let attempt=0;attempt<config.learning.generationLimit;attempt++){
  const group=()=>{const a=[pick(r,[1,2,3])];while(a.length<n)a.push(a.at(-1)+pick(r,[1,2,4]));return shuffle(r,a);};
  const A=group(),B=group();let t=ranks(B).indexOf(q);
  if(final){[B[t],B[3]]=[B[3],B[t]];t=3;}
  const c={A,B,t,q};if(n===4||contrastive(c,q))return c;
 }
 const A=q===0?[2,6,4]:[1,2,6],B=q===0?[6,4,2]:[1,5,6];
 return {A,B,t:ranks(B).indexOf(q),q};
}
export class Engine {
 constructor(seed=20260919,c=config){this.config=parseConfig(JSON.stringify(c));this.seed=seed>>>0;this.session=0;this.reset(this.seed);}
 reset(seed=this.seed){this.seed=seed>>>0;this.session++;this.rng=random(this.seed);this.seq=0;this.used=new Set();this.history=[];this.s={state:'S0',g:0,R:[],context:null,selected:null,lastResponse:null,presentation:null,logicComplete:false,revealComplete:false,releaseAuthorized:false,released:false,irisOpen:false,win:false};}
 newContext(){const s=this.s;s.context=s.state==='S1'?context(this.rng,3,s.g):context(this.rng,4,pick(this.rng,s.R),s.R.length===1);}
 present(kind,response=null){this.s.presentation={kind,token:`${this.session}:${++this.seq}`,context:structuredClone(this.s.context),response:structuredClone(response)};}
 dispatch(e){
  const s=this.s,from=s.state;
  if(e.session!==this.session)return false;
  if(e.type==='RESET'){this.reset(e.seed??this.seed);return true;}
  if(s.state==='S4')return false;
  if(s.presentation){
   const kind=s.presentation.kind;
   if(e.token!==s.presentation.token||e.type!==(kind==='reveal'?'REVEAL_END':'PRESENTATION_END'))return false;
   s.presentation=null;
   if(kind==='reveal'){s.revealComplete=true;s.releaseAuthorized=s.logicComplete;s.released=s.releaseAuthorized;s.irisOpen=s.revealComplete;s.state='S4';s.win=s.logicComplete&&s.irisOpen;}
   this.record(e,from);return true;
  }
  if(e.type==='UNSTABLE'){s.selected=null;this.record(e,from);return true;}
  if(['WAKE','SELECT','CONFIRM'].includes(e.type)){
   if(e.stable!==true||typeof e.gesture!=='string'||!e.gesture||this.used.has(e.gesture))return false;
   this.used.add(e.gesture);
  }
  if(e.type==='WAKE'&&s.state==='S0'){s.state='S1';this.newContext();this.present('context');}
  else if(e.type==='SELECT'&&['S1','S2'].includes(s.state)&&Number.isInteger(e.i)&&e.i>=0&&e.i<s.context.A.length){
   s.selected=e.i;
   if(s.state==='S1'){s.lastResponse={context:structuredClone(s.context),i:e.i,d:destination(s.context,e.i)};this.present('preview',s.lastResponse);}
   else s.lastResponse=null;
  }
  else if(e.type==='REPEAT'&&['S1','S2'].includes(s.state)){s.selected=null;this.present('context');}
  else if(e.type==='CONFIRM'&&['S1','S2'].includes(s.state)&&s.selected!==null){
   const c=s.context,i=s.selected,d=destination(c,i),ok=d===c.t;
   s.selected=null;s.lastResponse={context:structuredClone(c),i,d};
   if(s.state==='S1'){
    if(ok){s.g++;if(s.g===3){s.state='S2';s.R=[0,1,2,3];}this.newContext();}
   }else if(!ok){s.R=[0,1,2,3];this.newContext();}
   else {s.R=s.R.filter(r=>r!==c.q);if(s.R.length)this.newContext();else{s.logicComplete=s.g===3&&c.t===3;s.state='S3';}}
   this.present(s.state==='S3'?'reveal':ok||from==='S2'?'response-context':'response',s.lastResponse);
  }
  else return false;
  this.record(e,from);return true;
 }
 record(e,from){this.history.push({index:this.history.length,event:structuredClone(e),from,to:this.s.state,g:this.s.g,R:[...this.s.R],response:structuredClone(this.s.lastResponse),win:this.s.win});assertInvariants(this.s);}
 snapshot(){return structuredClone(this.s);}
}
export function assertInvariants(s){
 const n=Number(s.state[1]);
 if(n>=2&&s.g!==3)throw Error('Aprendizaje omitido');
 if(n>=3&&(!s.logicComplete||s.R.length||s.context.t!==3))throw Error('Transferencia omitida');
 if(!config.states.includes(s.state))throw Error('Estado inválido');
 if(n===4&&(!s.releaseAuthorized||!s.revealComplete||!s.released||!s.irisOpen||!s.win))throw Error('Apertura incompleta');
 if(s.win&&(n!==4||!s.logicComplete||!s.irisOpen||!s.revealComplete))throw Error('WIN inválido');
 if((s.released||s.irisOpen)&&n<4)throw Error('Apertura prematura');
 return true;
}
export function settle(engine){const p=engine.s.presentation;if(p)engine.dispatch({type:p.kind==='reveal'?'REVEAL_END':'PRESENTATION_END',token:p.token,session:engine.session});}
let actionSerial=0;
export function act(engine,type,extra={}){return engine.dispatch({type,session:engine.session,stable:true,gesture:`action-${++actionSerial}`,...extra});}
export function choose(engine,i){act(engine,'SELECT',{i});settle(engine);act(engine,'CONFIRM');settle(engine);}
export function solve(engine){if(engine.s.state==='S0'){act(engine,'WAKE');settle(engine);}settle(engine);let guard=0;while(['S1','S2'].includes(engine.s.state)&&guard++<10)choose(engine,correctInput(engine.s.context));settle(engine);return engine.s.win;}
export function reference(seed=230926){
 const e=new Engine(seed);act(e,'WAKE');settle(e);
 choose(e,(correctInput(e.s.context)+1)%3);act(e,'REPEAT');settle(e);
 while(e.s.state==='S1')choose(e,correctInput(e.s.context));
 choose(e,(correctInput(e.s.context)+1)%4);
 while(e.s.state==='S2')choose(e,correctInput(e.s.context));
 return {seed,events:e.history.map(x=>x.event),trace:e.history,final:e.snapshot()};
}
export function playback(e,event){const x={...event,session:e.session};if(x.type.endsWith('_END'))x.token=e.s.presentation?.token;return e.dispatch(x);}
