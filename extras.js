// Chess Cam Coach: Two players · History · Learn
// Uses the chess rules from the core script (startPos, legal, make, unmake, inCheck, F_* …)
// and helpers shared by the main app (window.CCApp).
(function(){
const $=id=>document.getElementById(id);
const A=window.CCApp;
const FILES='abcdefgh';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};

// ---------------- chess helpers ----------------
function sq(s){return FILES[s&7]+((s>>3)+1);}
function uciOf(m){return sq(m.f)+sq(m.t)+(m.p?' pnbrq'[m.p]:'');}
function findUci(pos,u){return legal(pos).find(m=>uciOf(m)===u);}
function fromFen(fen){
  const [pl,t,c,e,h]=fen.trim().split(/\s+/);const b=new Int8Array(64);let r=7,f=0;const map={p:1,n:2,b:3,r:4,q:5,k:6};
  for(const ch of pl){if(ch==='/'){r--;f=0;}else if(/\d/.test(ch))f+=+ch;else{const v=map[ch.toLowerCase()];b[r*8+f]=ch===ch.toUpperCase()?v:-v;f++;}}
  let cs=0;if(c&&c.includes('K'))cs|=1;if(c&&c.includes('Q'))cs|=2;if(c&&c.includes('k'))cs|=4;if(c&&c.includes('q'))cs|=8;
  return {b,turn:t==='b'?-1:1,castle:cs,ep:(!e||e==='-')?-1:(e.charCodeAt(0)-97)+(+e[1]-1)*8,half:+(h||0)};}
function fenOf(pos,ply){return A.toFen(pos,ply||0);}
function status(pos){const L=legal(pos);if(!L.length)return inCheck(pos,pos.turn)?'mate':'stalemate';
  if(pos.half>=100)return 'fifty';const pc=[];for(const x of pos.b)if(x&&Math.abs(x)!==6)pc.push(Math.abs(x));
  if(!pc.length||(pc.length===1&&(pc[0]===2||pc[0]===3)))return 'material';return inCheck(pos,pos.turn)?'check':'';}
function askPromo(color){
  return new Promise(res=>{const box=$('promoBtns');box.innerHTML='';
    [5,4,3,2].forEach(pt=>{const b=document.createElement('button');b.innerHTML=`<span class="pc ${color>0?'w':'b'}">${A.GLYPH[pt]}︎</span>`;b.onclick=()=>{$('modal').classList.remove('show');res(pt);};box.appendChild(b);});
    $('modal').classList.add('show');});}

// ---------------- generic clickable board ----------------
// o: {flip, last:{f,t}, sel, targets[], arrows:[{f,t,c}], marks:{sq:color}, onClick(sq)}
function drawBoard(el,pos,o){
  o=o||{};el.innerHTML='';el.classList.add('cboard');
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    const rank=o.flip?i:7-i,file=o.flip?7-j:j,s=rank*8+file,d=document.createElement('div');
    d.className='sq '+(((rank+file)&1)?'l':'d');
    if(o.last&&(o.last.f===s||o.last.t===s))d.classList.add('last');
    if(o.sel===s)d.classList.add('sel');
    if(o.targets&&o.targets.includes(s))d.classList.add('dot');
    if(o.marks&&o.marks[s]){const h=document.createElement('div');h.className='heat';h.style.background=o.marks[s];h.style.opacity=.45;d.appendChild(h);}
    const x=pos.b[s];
    if(x){const sp=document.createElement('span');sp.className='pc '+(x>0?'w':'b');sp.textContent=A.GLYPH[Math.abs(x)]+'︎';d.appendChild(sp);}
    if(i===7){const c=document.createElement('span');c.className='coord f';c.textContent=FILES[file];d.appendChild(c);}
    if(j===0){const c=document.createElement('span');c.className='coord r';c.textContent=rank+1;d.appendChild(c);}
    if(o.onClick)d.onclick=()=>o.onClick(s);
    el.appendChild(d);}
  if(o.arrows&&o.arrows.length){
    const P=s=>{const f=s&7,r=s>>3;return o.flip?[7-f+.5,r+.5]:[f+.5,7-r+.5];};
    let svg='<svg class="arrowsvg" viewBox="0 0 8 8" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6"><defs>';
    const cols=[...new Set(o.arrows.map(a=>a.c||'#2e9e52'))];cols.forEach((c,i)=>svg+=`<marker id="ah${i}${el.id}" markerWidth="3" markerHeight="3" refX="1.4" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 z" fill="${c}"/></marker>`);svg+='</defs>';
    o.arrows.forEach(a=>{const [x1,y1]=P(a.f),[x2,y2]=P(a.t),dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,c=a.c||'#2e9e52';
      svg+=`<line x1="${x1}" y1="${y1}" x2="${x2-dx/L*.32}" y2="${y2-dy/L*.32}" stroke="${c}" stroke-width=".2" stroke-linecap="round" opacity=".85" marker-end="url(#ah${cols.indexOf(c)}${el.id})"/>`;});
    el.insertAdjacentHTML('beforeend',svg+'</svg>');}}
// click-to-move helper: returns a click handler; calls onMove(move) for a legal move
function mover(getPos,onMove,redraw){
  let sel=-1;
  const h=s=>{const pos=getPos();if(!pos)return;const x=pos.b[s];
    if(sel>=0){const ms=legal(pos).filter(m=>m.f===sel&&m.t===s);
      if(ms.length){sel=-1;if(ms.length>1)askPromo(pos.turn).then(pt=>onMove(ms.find(m=>m.p===pt)));else onMove(ms[0]);return;}}
    sel=(x&&(x>0)===(pos.turn>0))?(sel===s?-1:s):-1;redraw();};
  h.sel=()=>sel;h.targets=()=>{const pos=getPos();return sel>=0&&pos?legal(pos).filter(m=>m.f===sel).map(m=>m.t):[];};h.clear=()=>{sel=-1;};
  return h;}


// ================= CHESS CLOCK (shared by Play and 2 Players) =================
const TIMERS=[['none','No timer'],['1+0','Bullet · 1 min'],['2+1','Bullet · 2 min + 1 s'],['3+0','Blitz · 3 min'],['3+2','Blitz · 3 min + 2 s'],
  ['5+0','Blitz · 5 min'],['5+3','Blitz · 5 min + 3 s'],['10+0','Rapid · 10 min'],['10+5','Rapid · 10 min + 5 s'],['15+10','Rapid · 15 min + 10 s'],
  ['30+0','Classical · 30 min'],['30+20','Classical · 30 min + 20 s'],['60+30','Classical · 60 min + 30 s'],['custom','Custom…']];
// "5+3" -> {base:300000, inc:3000}; custom uses the minutes / seconds inputs
function parseTC(v,minEl,incEl){
  if(!v||v==='none')return null;
  let m,i;if(v==='custom'){m=parseFloat(minEl&&minEl.value);i=parseFloat(incEl&&incEl.value)||0;}else[m,i]=v.split('+').map(Number);
  if(!(m>0))return null;m=Math.min(m,600);i=Math.max(0,Math.min(i,120));
  return {base:Math.round(m*60000),inc:Math.round(i*1000),label:`${+m.toFixed(2)}+${+i.toFixed(1)}`};}
function fmtClock(ms){ms=Math.max(0,ms);
  if(ms<10000)return (Math.floor(ms/100)/10).toFixed(1);
  const t=Math.ceil(ms/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),sec=t%60;
  return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(sec).padStart(2,'0');}
class Clock{
  // t[1]=White ms, t[-1]=Black ms
  constructor(tc,onFlag,onTick,times){this.tc=tc;this.inc=tc.inc;this.t={1:tc.base,'-1':tc.base};if(times){this.t[1]=times.w;this.t[-1]=times.b;}
    this.side=0;this.running=false;this.last=0;this.onFlag=onFlag;this.onTick=onTick;this.iv=null;this.flagged=false;this.warned={};}
  now(){return performance.now();}
  left(side){let v=this.t[side];if(this.running&&this.side===side)v-=this.now()-this.last;return Math.max(0,v);}
  start(side){this.pauseRaw();this.side=side;this.resume();}
  // the player `side` finished their move `earlierMs` ago (e.g. the camera noticed the hand leaving a moment before reading the move)
  moved(side,earlierMs){
    if(this.flagged)return;
    const now=this.now(),end=now-Math.max(0,Math.min(earlierMs||0,4000));
    if(this.running&&this.side===side){this.t[side]=Math.max(0,this.t[side]-Math.max(0,end-this.last))+this.inc;}
    this.side=-side;this.last=now;if(!this.running&&!this.held)this.resume();this.onTick&&this.onTick();}
  pauseRaw(){if(this.running){this.t[this.side]=this.left(this.side);this.running=false;}clearInterval(this.iv);this.iv=null;}
  pause(){this.pauseRaw();this.held=true;this.onTick&&this.onTick();}
  resume(){this.held=false;if(this.running||!this.side||this.flagged)return;this.running=true;this.last=this.now();clearInterval(this.iv);this.iv=setInterval(()=>this.tick(),100);this.onTick&&this.onTick();}
  stop(){this.pauseRaw();this.side=0;this.onTick&&this.onTick();}
  tick(){const r=this.left(this.side);
    if(r<=10000&&!this.warned[this.side]&&this.tc.base>30000){this.warned[this.side]=1;try{window.CCApp.beep(false);}catch(e){}}
    this.onTick&&this.onTick();
    if(r<=0&&!this.flagged){this.flagged=true;const s=this.side;this.pauseRaw();this.onFlag&&this.onFlag(s);}}
  times(){return {w:this.left(1),b:this.left(-1)};}
}
// renders two clock faces into el: [{side,label}] in display order
function clockHtml(clk,faces){
  return faces.map(f=>{const ms=clk.left(f.side),on=clk.running&&clk.side===f.side;
    return `<div class="clk ${on?'on':''} ${ms<=10000?'low':''} ${clk.flagged&&clk.side===f.side?'flag':''}"><span class="clkName">${f.label}</span><span class="clkTime">${fmtClock(ms)}</span></div>`;}).join('');}
function timerSelectHtml(id,value){return `<select id="${id}">${TIMERS.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select>`;}
function hasMatingMaterial(pos,color){let n=0,minor=0;for(const x of pos.b){if(!x||Math.sign(x)!==color||Math.abs(x)===6)continue;n++;if(Math.abs(x)===2||Math.abs(x)===3)minor++;}
  return !(n===0||(n===1&&minor===1));}
window.CCClock={Clock,TIMERS,parseTC,fmtClock,clockHtml,timerSelectHtml,hasMatingMaterial};

// ---------------- History storage ----------------
const CCX=window.CCX={
  newId(){return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);},
  games(){return LS.get('ccc_games',[]);},
  saveGame(g,fromReview){const all=CCX.games();const i=all.findIndex(x=>x.id===g.id);
    if(i>=0&&!fromReview){const old=all[i];if(old.review&&!g.review&&(old.uci||[]).join(' ')===(g.uci||[]).join(' ')){g.review=old.review;g.reviewUci=old.reviewUci;}
      if(g.review&&g.reviewUci!==(g.uci||[]).length){delete g.review;delete g.reviewUci;}}
    if(i>=0)all[i]=g;else all.unshift(g);LS.set('ccc_games',all.slice(0,500));
    if(!fromReview&&g.result!=='*'&&!g.review&&window.CCReview)setTimeout(()=>CCReview.R.auto(g.id),200);},
  deleteGame(id){LS.set('ccc_games',CCX.games().filter(g=>g.id!==id));}};
function pgnOf(g){
  const d=new Date(g.date||Date.now());const ds=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  let mv='';g.moves.forEach((m,i)=>{if(i%2===0)mv+=(i/2+1)+'. ';mv+=m+' ';});
  const tc=g.tc?`[TimeControl "${Math.round(parseFloat(g.tc)*60)}+${parseFloat(g.tc.split('+')[1])||0}"]\n`:'';
  return `[Event "${g.type==='engine'?'Game vs engine':'Two-player game'}"]\n[Site "Chess Cam Coach"]\n[Date "${ds}"]\n[White "${g.white}"]\n[Black "${g.black}"]\n[Result "${g.result}"]\n${tc}${g.why?`[Termination "${g.why}"]\n`:''}\n${mv}${g.result}\n`;}
function copyText(t,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='✓ Copied';setTimeout(()=>btn.textContent=o,1500);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,()=>fallback());else fallback();
  function fallback(){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){}ta.remove();}}
function resultText(g){
  if(g.result==='1-0')return `${g.white} won`;if(g.result==='0-1')return `${g.black} won`;if(g.result==='1/2-1/2')return 'Draw';return 'Unfinished';}

// ---------------- Tabs ----------------
let curView='play';
function show(v){
  if(v!=='two'&&Two.clock&&Two.clock.running){Two.clock.pause();Two.saveClock();if(Two.g)CCX.saveGame(Two.g);}
  curView=v;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  $('viewPlay').classList.toggle('hide',v!=='play');
  ['two','learn','hist'].forEach(x=>$('view'+x[0].toUpperCase()+x.slice(1)).classList.toggle('hide',v!==x));
  document.body.classList.toggle('otherview',v!=='play');
  if(v==='two')Two.render();if(v==='learn')Learn.home();if(v==='hist'){Hist.sel=null;Hist.list();}
  window.scrollTo({top:0});}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>show(b.dataset.v));
const st=document.createElement('style');st.textContent='body.otherview #camPanel{display:none!important}';document.head.appendChild(st);

// ================= TWO PLAYERS (pass and play on screen) =================
const Two={g:null,pos:null,view:'setup',
  render(){if(this.g&&this.view==='game')this.draw();else this.setup();},
  setup(){
    this.view='setup';const n=LS.get('ccc_2p_names',{w:'',b:''}),fl=LS.get('ccc_2p_flip',true);
    $('viewTwo').innerHTML=`<div class="card"><h2>Two players on this screen</h2>
      <p class="muted small">Pass the phone or laptop between moves. Every game is saved in History.</p>
      <label style="display:block;margin:12px 0 4px">♔ White player’s name</label><input class="txt" id="pW" maxlength="24" placeholder="e.g. Arindam" value="${esc(n.w)}">
      <label style="display:block;margin:12px 0 4px">♚ Black player’s name</label><input class="txt" id="pB" maxlength="24" placeholder="e.g. Rahul" value="${esc(n.b)}">
      <label style="display:block;margin:12px 0 4px">⏱ Timer (each player)</label>${CCClock.timerSelectHtml('pTimer',LS.get('ccc_2p_timer','none'))}
      <span id="pCustom" class="${LS.get('ccc_2p_timer','none')==='custom'?'':'hide'}" style="display:inline-flex;gap:8px;align-items:center;margin-left:8px">
        <input class="txt" id="pMin" type="number" min="0.25" max="600" step="0.25" value="${LS.get('ccc_2p_cmin',10)}" style="width:80px"> min +
        <input class="txt" id="pInc" type="number" min="0" max="120" step="1" value="${LS.get('ccc_2p_cinc',0)}" style="width:70px"> s per move</span>
      <label style="margin-top:12px"><input type="checkbox" id="pFlip" ${fl?'checked':''}> Turn the board around after each move (for sitting opposite each other)</label>
      <div class="fb bad" id="pErr"></div>
      <div class="row" style="justify-content:center"><button class="primary big" id="pStart">Start game</button></div></div>
      ${this.unfinishedHtml()}`;
    $('pTimer').onchange=()=>$('pCustom').classList.toggle('hide',$('pTimer').value!=='custom');
    $('pStart').onclick=()=>{
      const w=$('pW').value.trim(),b=$('pB').value.trim();
      const tv=$('pTimer').value,tc=CCClock.parseTC(tv,$('pMin'),$('pInc'));
      if(tv==='custom'&&!tc){$('pErr').textContent='Please enter the minutes for the custom timer.';return;}
      LS.set('ccc_2p_timer',tv);if(tv==='custom'){LS.set('ccc_2p_cmin',+$('pMin').value);LS.set('ccc_2p_cinc',+$('pInc').value||0);}
      if(!w||!b){$('pErr').textContent='Please enter both players’ names.';(w?$('pB'):$('pW')).focus();return;}
      if(w.toLowerCase()===b.toLowerCase()){$('pErr').textContent='Please use two different names.';return;}
      LS.set('ccc_2p_names',{w,b});LS.set('ccc_2p_flip',$('pFlip').checked);
      this.start({id:CCX.newId(),type:'2p',date:new Date().toISOString(),white:w,black:b,result:'*',moves:[],uci:[],tc:tc?tc.label:null,tcBase:tc?tc.base:0,tcInc:tc?tc.inc:0});};
    document.querySelectorAll('[data-resume]').forEach(el=>el.onclick=()=>{const g=CCX.games().find(x=>x.id===el.dataset.resume);if(g)this.start(g);});},
  unfinishedHtml(){const u=CCX.games().filter(g=>g.type==='2p'&&g.result==='*'&&g.moves.length).slice(0,3);
    if(!u.length)return '';
    return `<div class="card"><h2>Continue a game</h2>${u.map(g=>`<div class="list-item" data-resume="${g.id}"><div><b>${esc(g.white)}</b> vs <b>${esc(g.black)}</b><div class="small muted">${new Date(g.date).toLocaleString()} · ${g.moves.length} moves</div></div><span class="pill">Resume ▶</span></div>`).join('')}</div>`;},
  start(g){if(this.clock)this.clock.stop();this.clock=null;
    this.g=JSON.parse(JSON.stringify(g));this.pos=startPos();this.stack=[];
    for(const u of this.g.uci){const m=findUci(this.pos,u);if(!m)break;this.stack.push({m,u:make(this.pos,m)});}
    if(this.g.tcBase){this.clock=new CCClock.Clock({base:this.g.tcBase,inc:this.g.tcInc||0},side=>this.flag(side),()=>this.drawClocks(),this.g.clock);
      if(this.g.result==='*'){if(this.g.clock){this.clock.side=this.pos.turn;this.paused=true;}else{this.clock.start(this.pos.turn);this.paused=false;}}}
    this.view='game';this.drawOffer=false;this.lastAt=Date.now();this.click=mover(()=>this.g.result==='*'?this.pos:null,m=>this.play(m),()=>this.draw());this.draw();},
  play(m){if(this.clock){if(this.paused){this.paused=false;this.clock.held=false;}this.clock.moved(this.pos.turn);}
    const now=Date.now();this.g.ms=this.g.ms||[];this.g.ms[this.g.uci.length]=this.lastAt?now-this.lastAt:null;this.lastAt=now;
    const s=A.san(this.pos,m);this.stack.push({m,u:make(this.pos,m)});this.g.moves.push(s);this.g.uci.push(uciOf(m));this.drawOffer=false;
    const st=status(this.pos);
    if(st==='mate')this.g.result=this.pos.turn===1?'0-1':'1-0';else if(st==='stalemate'||st==='fifty'||st==='material')this.g.result='1/2-1/2';
    if(this.g.result!=='*'&&this.clock)this.clock.stop();
    this.saveClock();CCX.saveGame(this.g);A.beep(true);this.draw();},
  saveClock(){if(this.clock)this.g.clock=this.clock.times();},
  flag(side){const winner=-side,pos=this.pos;const name=side===1?this.g.white:this.g.black;
    if(!CCClock.hasMatingMaterial(pos,winner))this.end('1/2-1/2',`${name} ran out of time, but the opponent can’t checkmate: draw`);
    else this.end(winner===1?'1-0':'0-1',`${name} lost on time`);A.speak(`${name} ran out of time.`);},
  drawClocks(){const el=$('twoClocks');if(!el||!this.clock)return;
    el.innerHTML=CCClock.clockHtml(this.clock,[{side:1,label:'♔ '+esc(this.g.white)},{side:-1,label:'♚ '+esc(this.g.black)}]);
    const pb=$('tPause');if(pb)pb.textContent=this.clock.running?'⏸ Pause':'▶ Resume clock';},
  undo(){if(!this.stack.length)return;const x=this.stack.pop();unmake(this.pos,x.m,x.u);this.g.moves.pop();this.g.uci.pop();this.g.result='*';delete this.g.why;
    if(this.clock){this.clock.flagged=false;if(this.clock.running)this.clock.start(this.pos.turn);else this.clock.side=this.pos.turn;}
    this.saveClock();CCX.saveGame(this.g);this.click.clear();this.draw();},
  end(res,why){this.g.result=res;this.g.why=why;if(this.clock)this.clock.stop();this.saveClock();CCX.saveGame(this.g);this.draw();},
  draw(){
    const g=this.g,pos=this.pos,turnW=pos.turn===1,st=status(pos),over=g.result!=='*';
    const flip=LS.get('ccc_2p_flip',true)?!turnW&&!over:false;
    const name=turnW?g.white:g.black,last=this.stack.length?this.stack[this.stack.length-1].m:null;
    let label,main,cls;
    if(over){cls='over';label='Game over';
      main=g.why?esc(g.why):st==='mate'?`Checkmate! ${esc(turnW?g.black:g.white)} wins`:g.result==='1/2-1/2'?(st==='stalemate'?'Stalemate: draw':'Draw'):esc(resultText(g));}
    else{cls='you';label=st==='check'?'Check!':(this.clock&&!this.clock.running?'To move · clock paused':'To move');main=`<span class="pc ${turnW?'w':'b'}">${turnW?'♔':'♚'}︎</span>${esc(name)}`;}
    let mv='';g.moves.forEach((m,i)=>{if(i%2===0)mv+=`<b>${i/2+1}.</b> `;mv+=esc(m)+' ';});
    $('viewTwo').innerHTML=`<div class="card">
      <div class="players"><span class="${turnW&&!over?'on':''}">♔ ${esc(g.white)}</span><span class="muted small">vs</span><span class="${!turnW&&!over?'on':''}">♚ ${esc(g.black)}</span></div>
      <div id="twoCard" class="mcard ${cls}"><div class="mcLabel">${label}</div><div class="mcMain">${main}</div><div class="mcSub">${last&&!over?'Last move: '+esc(g.moves[g.moves.length-1]):''}</div></div>
      ${this.clock?`<div class="clocks" id="twoClocks"></div>`:''}
      <div id="twoBoard"></div>
      <div class="row" style="justify-content:center">
        ${over?'':legal(pos).filter(m=>m.fl&F_CASTLE).sort((a,b)=>(b.t&7)-(a.t&7)).map(m=>`<button class="primary" data-castle="${m.t}">🏰 Castle ${(m.t&7)===6?'king side (O-O)':'queen side (O-O-O)'}</button>`).join('')}
        <button id="tUndo" ${this.stack.length?'':'disabled'}>↶ Undo move</button>
        ${this.clock&&!over?'<button id="tPause">⏸ Pause</button>':''}
        ${over?'':`<button id="tDraw">${this.drawOffer?'✓ Agree draw':'½ Offer draw'}</button><button id="tResign">🏳 ${esc(name)} resigns</button>`}
        ${over&&g.moves.length>=4?'<button id="tRev" class="primary">📊 Game review</button>':''}<button id="tNew">New game</button></div>
      <div class="mlist">${mv||'No moves yet.'}</div></div>`;
    drawBoard($('twoBoard'),pos,{flip,last,sel:this.click.sel(),targets:this.click.targets(),onClick:over?null:this.click});
    $('tUndo').onclick=()=>this.undo();
    if($('tRev'))$('tRev').onclick=()=>{show('hist');Hist.open(g.id,0);};
    document.querySelectorAll('[data-castle]').forEach(el=>el.onclick=()=>{const m=legal(this.pos).find(x=>(x.fl&F_CASTLE)&&x.t===+el.dataset.castle);if(m)this.play(m);});
    this.drawClocks();
    if($('tPause'))$('tPause').onclick=()=>{if(this.clock.running){this.clock.pause();this.saveClock();CCX.saveGame(this.g);}else{this.paused=false;this.clock.resume();}this.drawClocks();};
    $('tNew').onclick=()=>{if(this.clock){this.clock.pause();this.saveClock();CCX.saveGame(this.g);this.clock=null;}this.g=null;this.setup();};
    if(!over){$('tDraw').onclick=()=>{if(this.drawOffer)this.end('1/2-1/2','Draw agreed');else{this.drawOffer=true;this.draw();}};
      $('tResign').onclick=e=>{const b=e.target;if(b.dataset.sure){this.end(turnW?'0-1':'1-0',`${name} resigned`);}else{b.dataset.sure=1;b.textContent='Tap again to resign';}};}}
};

// ================= HISTORY =================
const Hist={sel:null, // null = normal view; Set of ids = select mode
  list(){
    const all=CCX.games(),sel=this.sel;
    if(sel)for(const id of [...sel])if(!all.some(g=>g.id===id))sel.delete(id);
    const n=sel?sel.size:0,allOn=sel&&all.length&&n===all.length;
    $('viewHist').innerHTML=`<div class="card"><h2>Game history</h2>
      ${all.length?`<p class="muted small">${all.length} saved game${all.length>1?'s':''} on this device. ${sel?'Tap games to select them.':'Tap a game to replay it.'}</p>`:'<p class="muted">No games yet. Games against the engine and two-player games are saved here automatically.</p>'}
      ${all.length?(sel?`<div class="row" style="margin:0 0 10px;justify-content:space-between">
          <label style="font-size:15px;color:var(--text)"><input type="checkbox" id="hSelAll" ${allOn?'checked':''} style="width:20px;height:20px"> Select all</label>
          <span><button id="hDelSel" class="${n?'primary':''}" ${n?'':'disabled'}>🗑 Delete selected (${n})</button> <button id="hSelDone">Cancel</button></span></div>`
        :`<div class="row" style="margin:0 0 10px"><button id="hPat" class="primary">📈 My patterns</button><button id="hSelect">☑ Select / delete</button><button id="hAll">📋 Copy all (PGN)</button></div>`):''}
      ${all.map(g=>`<div class="list-item${sel&&sel.has(g.id)?' picked':''}" data-g="${g.id}">
        ${sel?`<input type="checkbox" ${sel.has(g.id)?'checked':''} style="width:20px;height:20px;flex:none;pointer-events:none">`:''}
        <div style="flex:1"><b>${esc(g.white)}</b> vs <b>${esc(g.black)}</b>
        <div class="small muted">${new Date(g.date).toLocaleString()} · ${g.type==='engine'?'vs engine':'two players'} · ${g.moves.length} moves${g.tc?' · ⏱ '+esc(g.tc):''}</div></div>
        <span style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"><span class="pill ${g.result!=='*'?'done':''}">${esc(resultText(g))}</span>${g.review?`<span class="pill">📊 ${g.type==='engine'?(g.review.acc[g.human||1]??'–')+'%':g.review.acc[1]+'% · '+g.review.acc[-1]+'%'}</span>`:(window.CCReview&&(CCReview.R.busy===g.id||CCReview.R.queue.includes(g.id))?'<span class="pill">analysing…</span>':'')}</span></div>`).join('')}</div>`;
    document.querySelectorAll('[data-g]').forEach(el=>el.onclick=()=>{
      if(!this.sel)return this.open(el.dataset.g);
      const id=el.dataset.g;if(this.sel.has(id))this.sel.delete(id);else this.sel.add(id);this.list();});
    if(!all.length)return;
    if(sel){
      $('hSelAll').onchange=e=>{this.sel=new Set(e.target.checked?all.map(g=>g.id):[]);this.list();};
      $('hSelDone').onclick=()=>{this.sel=null;this.list();};
      $('hDelSel').onclick=e=>{const b=e.target;if(!this.sel.size)return;
        if(!b.dataset.sure){b.dataset.sure=1;b.textContent=`Tap again to delete ${this.sel.size} game${this.sel.size>1?'s':''}`;b.classList.add('primary');return;}
        const ids=this.sel;LS.set('ccc_games',CCX.games().filter(g=>!ids.has(g.id)));this.sel=null;this.list();};
    }else{
      $('hSelect').onclick=()=>{this.sel=new Set();this.list();};
      $('hPat').onclick=()=>window.CCReview&&CCReview.insights($('viewHist'));
      $('hAll').onclick=e=>copyText(all.map(pgnOf).join('\n'),e.target);}},
  open(id,startPly){
    const g0=CCX.games().find(x=>x.id===id);if(!g0)return this.list();let g=g0;
    const ps=[startPos()],ms=[];for(const u of g.uci){const p=clonePos(ps[ps.length-1]),m=findUci(p,u);if(!m)break;make(p,m);ps.push(p);ms.push(m);}
    let i=startPly!=null?startPly:(g.review?0:ps.length-1),flip=g.type==='engine'&&g.human===-1;
    this.openId=id;
    $('viewHist').innerHTML=`<div class="card" id="hTop"></div><div id="hReview"></div>`;
    const RV=window.CCReview;
    const draw=()=>{
      const rv=g.review;
      let mv='';g.moves.slice(0,ms.length).forEach((m,k)=>{if(k%2===0)mv+=`<b>${k/2+1}.</b> `;const r=rv&&rv.moves[k],c=r&&RV?RV.CLS[r.cls]:null;
        mv+=`<span data-k="${k+1}" class="${k+1===i?'cur':''}" style="${c&&c.c&&r.cls!=='best'?'color:'+c.c+';font-weight:700':''}">${esc(m)}${c?c.sym:''}</span> `;});
      const nt=RV&&rv?RV.note(g,i):null;
      $('hTop').innerHTML=`<button id="hBack">← All games</button>
        <div class="players" style="margin-top:12px"><span>♔ ${esc(g.white)}</span><span class="pill ${g.result!=='*'?'done':''}">${esc(resultText(g))}</span><span>♚ ${esc(g.black)}</span></div>
        <div class="small muted" style="text-align:center;margin-top:4px">${new Date(g.date).toLocaleString()} · ${g.type==='engine'?'vs engine':'two players'}${g.tc?' · ⏱ '+esc(g.tc):''}${g.why?' · '+esc(g.why):''}</div>
        <div id="histBoard"></div>
        ${nt?`<div class="lesson-text" style="border-left:4px solid ${nt.color||'#3a3f49'};font-size:14.5px">${esc(nt.text)}${nt.best?' <span class="muted">(green arrow = best move)</span>':''}</div>`:rv&&i===0?'<div class="lesson-text small">Step through the game with ▶. Mistakes are coloured in the move list; the review is below.</div>':''}
        <div class="row" style="justify-content:center"><button id="h0">⏮</button><button id="hP">◀</button><span class="muted">${i} / ${ps.length-1}</span><button id="hN">▶</button><button id="hE">⏭</button><button id="hF">⇅ Flip</button></div>
        <div class="mlist">${mv||'No moves.'}</div>
        <div class="row"><button id="hCopy">📋 Copy PGN</button>${g.type==='2p'&&g.result==='*'?'<button id="hResume" class="primary">▶ Continue this game</button>':''}<button id="hDel">🗑 Delete</button></div>`;
      const arrows=[];if(nt&&nt.best){const bm=findUci(ps[i-1],nt.best);if(bm)arrows.push({f:bm.f,t:bm.t,c:'#2e9e52'});}
      drawBoard($('histBoard'),ps[i],{flip,last:i?ms[i-1]:null,arrows,marks:nt&&nt.color&&ms[i-1]&&nt.cls!=='best'?{[ms[i-1].t]:nt.color}:null});
      $('hBack').onclick=()=>{this.openId=null;this.list();};
      $('h0').onclick=()=>{i=0;draw();};$('hP').onclick=()=>{if(i>0)i--;draw();};$('hN').onclick=()=>{if(i<ps.length-1)i++;draw();};$('hE').onclick=()=>{i=ps.length-1;draw();};
      $('hF').onclick=()=>{flip=!flip;draw();};
      document.querySelectorAll('.mlist [data-k]').forEach(el=>el.onclick=()=>{i=+el.dataset.k;draw();});
      $('hCopy').onclick=e=>copyText(pgnOf(g),e.target);
      if($('hResume'))$('hResume').onclick=()=>{show('two');Two.start(g);};
      $('hDel').onclick=e=>{const b=e.target;if(b.dataset.sure){CCX.deleteGame(g.id);this.openId=null;this.list();}else{b.dataset.sure=1;b.textContent='Tap again to delete';}};};
    const drawReview=()=>{if(RV)RV.section(g,$('hReview'),k=>{i=Math.max(0,Math.min(ps.length-1,k));draw();});};
    draw();drawReview();
    // live progress while the review is being computed
    if(RV){const f=done=>{if(this.openId!==id||curView!=='hist'){RV.R.listeners.splice(RV.R.listeners.indexOf(f),1);return;}
        if(done===id){g=CCX.games().find(x=>x.id===id)||g;draw();drawReview();}else if(!g.review)drawReview();};
      RV.R.listeners.push(f);}}
};

// ================= LEARN =================
// Step types (see courses.js):
//  {type:'show', fen, text, arrows:['e2e4'], marks:{e4:'#5fbf7a'}}
//  {type:'line', fen?, text, moves:[['e2e4','comment'],...]}            step through a line move by move
//  {type:'drill', fen?, text, moves:['e2e4','e7e5',...], side:'w'|'b'}     play your side of a line from memory
//  {type:'puzzle', fen, text, solution:['uci',...], mate?:N, hint?}        find the best move(s)
const prog=()=>LS.get('ccc_progress',{});
const Learn={
  all(){const C=(window.COURSES||[]).slice();if(window.CCReview){const m=CCReview.mistakeCourse();C.unshift(m);}if(this.custom)C.push(this.custom);return C;},
  playCustom(c,li){this.custom=c;this.c=c;this.lesson(li||0);},
  home(){
    const P=prog(),C=this.all().filter(c=>c.id!=='__review');
    $('viewLearn').innerHTML=`<div class="card"><h2>Courses</h2><p class="muted small">Lessons explain an idea on the board, then let you practise it. Puzzles are checked by Stockfish, so any move that works is accepted.</p>
      ${C.map(c=>{const n=c.lessons.length,d=c.lessons.filter(l=>P[l.id]).length;return `<div class="list-item" data-c="${c.id}" ${c.id==='mine'?'style="border-color:#5a5aff"':''}><div><b>${c.icon} ${esc(c.title)}</b><div class="small muted">${esc(c.desc)}</div></div><span class="pill ${d===n?'done':''}">${d}/${n}</span></div>`;}).join('')}</div>`;
    document.querySelectorAll('[data-c]').forEach(el=>el.onclick=()=>this.course(el.dataset.c));},
  course(cid){
    const c=this.all().find(x=>x.id===cid),P=prog();if(!c)return this.home();if(cid==='__review')return this.home();this.c=c;
    $('viewLearn').innerHTML=`<div class="card"><button id="lBack">← Courses</button><h2 style="margin-top:12px">${c.icon} ${esc(c.title)}</h2><p class="muted small">${esc(c.desc)}</p>
      ${c.lessons.length?'':'<p class="muted">Nothing here yet.</p>'}${c.lessons.map((l,i)=>`<div class="list-item" data-l="${i}"><div><b>${i+1}. ${esc(l.title)}</b><div class="small muted">${esc(l.sub||'')}</div></div><span class="pill ${P[l.id]?'done':''}">${P[l.id]?'✓ Done':l.steps.length+' steps'}</span></div>`).join('')}</div>`;
    $('lBack').onclick=()=>this.home();
    document.querySelectorAll('[data-l]').forEach(el=>el.onclick=()=>this.lesson(+el.dataset.l));},
  lesson(li,si){
    this.li=li;this.l=this.c.lessons[li];this.si=si||0;this.enter();},
  enter(){
    const s=this.l.steps[this.si];this.s=s;this.k=0;this.solved=false;this.busy=false;this.fb='';this.fbc='';this.arrows=null;this.marks=null;
    this.pos=fromFen(s.fen||'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');this.start=clonePos(this.pos);this.last=null;this.mi=0;this.engineMode=false;
    this.flip=s.flip!==undefined?s.flip:(s.side==='b'||(s.type==='puzzle'&&this.pos.turn===-1));
    if(s.type==='show'){this.arrows=(s.arrows||[]).map(u=>({f:sqi(u.slice(0,2)),t:sqi(u.slice(2,4)),c:'#2e9e52'}));this.marks=marksOf(s.marks);this.solved=true;}
    if(s.type==='line'){this.solved=true;}
    if(s.type==='drill'){this.side=s.side==='b'?-1:1;this.autoReply();}
    if(s.type==='puzzle'&&s.last)this.last={f:sqi(s.last.slice(0,2)),t:sqi(s.last.slice(2,4))};
    this.click=mover(()=>(this.s.type==='puzzle'||this.s.type==='drill')&&!this.solved&&!this.busy&&this.pos.turn===this.userSide()?this.pos:null,m=>this.userMove(m),()=>this.draw());
    this.draw();},
  userSide(){return this.s.type==='drill'?this.side:this.start.turn;},
  draw(){
    const s=this.s,l=this.l,n=l.steps.length;
    let text=s.text||'';
    if(s.type==='line'){const w0=this.start.turn===1,ply=this.k-1,wm=w0?ply%2===0:ply%2===1,no=Math.floor((ply+(w0?0:1))/2)+1;
      text=(this.k===0?(s.text||''):`<b>${no}${wm?'.':'…'} ${esc(this.lineSan[this.k-1]||'')}</b>: ${s.moves[this.k-1][1]||''}`);}
    const lastStep=this.si===n-1;
    $('viewLearn').innerHTML=`<div class="card"><button id="lBack">← ${esc(this.c.title)}</button>
      <h2 style="margin-top:12px">${esc(l.title)} <span class="pill">${this.si+1}/${n}</span></h2>
      <div id="learnBoard"></div>
      <div class="lesson-text">${text}</div>
      <div class="fb ${this.fbc}">${this.fb}</div>
      <div class="row" style="justify-content:center">
        ${s.type==='line'?`<button id="lPrev" ${this.k?'':'disabled'}>◀ Move</button><span class="muted">${this.k}/${s.moves.length}</span><button id="lNextM" ${this.k<s.moves.length?'':'disabled'}>Move ▶</button>`:''}
        ${(s.type==='puzzle'||s.type==='drill')&&!this.solved?`<button id="lHint">💡 Hint</button><button id="lSol">👁 Show answer</button><button id="lRetry">↺ Restart</button>`:''}
      </div>
      <div class="row" style="justify-content:space-between">
        <button id="lPrevS" ${this.si?'':'disabled'}>← Back</button>
        <button id="lNext" class="${this.solved&&(s.type!=='line'||this.k===s.moves.length)?'primary':''}">${lastStep?'Finish lesson ✓':'Next →'}</button></div></div>`;
    if(s.type==='line'&&!this.lineSan){this.lineSan=[];const p=clonePos(this.start);for(const [u] of s.moves){const m=findUci(p,u);if(!m)break;this.lineSan.push(A.san(p,m));make(p,m);}}
    drawBoard($('learnBoard'),this.pos,{flip:this.flip,last:this.last,sel:this.click.sel(),targets:this.click.targets(),arrows:this.arrows,marks:this.marks,onClick:this.click});
    $('lBack').onclick=()=>this.c.id==='__review'?show('hist'):this.course(this.c.id);
    $('lPrevS').onclick=()=>{this.si--;this.lineSan=null;this.enter();};
    $('lNext').onclick=()=>{if(lastStep){const P=prog();P[l.id]=true;LS.set('ccc_progress',P);this.done();}else{this.si++;this.lineSan=null;this.enter();}};
    if(s.type==='line'){$('lPrev').onclick=()=>this.lineGo(this.k-1);$('lNextM').onclick=()=>this.lineGo(this.k+1);}
    if($('lHint'))$('lHint').onclick=()=>this.hint();
    if($('lSol'))$('lSol').onclick=()=>this.showSolution();
    if($('lRetry'))$('lRetry').onclick=()=>{this.lineSan=null;this.enter();};},
  done(){
    const next=this.c.lessons[this.li+1];
    $('viewLearn').innerHTML=`<div class="card" style="text-align:center"><div style="font-size:46px">🏆</div><h2>Lesson complete</h2><p>${esc(this.l.title)}</p>
      <div class="row" style="justify-content:center">${next?`<button class="primary big" id="lNextL">Next: ${esc(next.title)} →</button>`:''}<button id="lCourse">Back to course</button></div></div>`;
    if(next)$('lNextL').onclick=()=>this.lesson(this.li+1);$('lCourse').onclick=()=>this.c.id==='__review'?show('hist'):this.course(this.c.id);},
  lineGo(k){const s=this.s;k=Math.max(0,Math.min(s.moves.length,k));this.pos=clonePos(this.start);this.last=null;
    for(let i=0;i<k;i++){const m=findUci(this.pos,s.moves[i][0]);if(!m)break;make(this.pos,m);this.last=m;}
    this.k=k;const ar=s.moves[k-1]&&s.moves[k-1][2];this.arrows=ar?ar.map(u=>({f:sqi(u.slice(0,2)),t:sqi(u.slice(2,4)),c:'#5a5aff'})):null;this.draw();},
  // ---- drills: play your side of a line from memory ----
  autoReply(){const s=this.s;
    while(this.mi<s.moves.length&&this.pos.turn!==this.side){const m=findUci(this.pos,s.moves[this.mi]);if(!m)break;make(this.pos,m);this.last=m;this.mi++;}
    if(this.mi>=s.moves.length){this.solved=true;this.fb='✅ Well done, you know this line!';this.fbc='good';}},
  // ---- user move in drill / puzzle ----
  userMove(m){
    const s=this.s,u=uciOf(m);this.click.clear();this.arrows=null;
    if(s.type==='drill'){
      if(u===s.moves[this.mi]){make(this.pos,m);this.last=m;this.mi++;this.fb='✓ Correct';this.fbc='good';A.beep(true);
        setTimeout(()=>{this.autoReply();this.draw();},350);this.draw();}
      else{this.fb=`✗ ${esc(A.san(this.pos,m))} isn’t the move in this line. Try again (💡 for a hint).`;this.fbc='bad';A.beep(false);this.draw();}
      return;}
    // puzzle
    const sol=s.solution||[];
    if(!this.engineMode&&u===sol[this.mi])return this.acceptPuzzleMove(m,false);
    this.checkWithEngine(m);},
  acceptPuzzleMove(m,viaEngine){
    const s=this.s,sanStr=A.san(this.pos,m);make(this.pos,m);this.last=m;this.mi++;A.beep(true);
    const st=status(this.pos);
    if(st==='mate'||this.mi>=(s.solution||[]).length){this.solved=true;this.fb=st==='mate'?`✅ ${esc(sanStr)}: checkmate! Solved.`:`✅ ${esc(sanStr)}: correct, puzzle solved!`;this.fbc='good';this.draw();return;}
    this.fb=`✓ ${esc(sanStr)}: good. Now the opponent replies…`;this.fbc='good';this.busy=true;this.draw();
    setTimeout(()=>this.opponentReply(),500);},
  opponentReply(){
    const s=this.s,sol=s.solution||[];
    const finish=m=>{if(!m){this.busy=false;this.solved=true;this.fb='✅ Solved!';this.fbc='good';this.draw();return;}
      const sanStr=A.san(this.pos,m);make(this.pos,m);this.last=m;this.mi++;this.busy=false;
      if(this.mate&&this.mateLeft)this.mateLeft--;
      this.fb=`Opponent played ${esc(sanStr)}. Your move.`;this.fbc='';
      if(this.mi>=sol.length){this.solved=true;this.fb='✅ Solved!';this.fbc='good';}
      this.draw();};
    if(!this.engineMode&&sol[this.mi]){finish(findUci(this.pos,sol[this.mi]));return;}
    if(A.SF.ready)A.SF.search(fenOf(this.pos),0,700).then(r=>finish(findUci(this.pos,r.uci)));
    else{const L=legal(this.pos);finish(L[0]);}},
  // a move that differs from the stored answer: let Stockfish judge it
  checkWithEngine(m){
    const s=this.s,sanStr=A.san(this.pos,m);
    if(!A.SF.ready){this.fb=`✗ ${esc(sanStr)} is not the answer. Try again.`;this.fbc='bad';A.beep(false);this.draw();return;}
    const p=clonePos(this.pos);const u=make(p,m);
    if(status(p)==='mate')return this.acceptPuzzleMove(m,true);
    this.busy=true;this.fb='Checking your move…';this.fbc='';this.draw();
    const movesLeft=s.mate?Math.ceil(((s.solution||[]).length-this.mi)/2):0;
    const judge=s.mate?
      A.SF.search(fenOf(p),0,1500).then(r=>r.mate!=null&&r.mate<0&&-r.mate<=movesLeft-1)
      :Promise.all([A.SF.search(fenOf(this.pos),0,1200),A.SF.search(fenOf(p),0,1200)]).then(([best,after])=>{const bs=best.score,as=-after.score;return as>=bs-60||(bs>300&&as>300&&as>=bs-150);});
    judge.then(ok=>{this.busy=false;
      if(ok){this.engineMode=true;this.acceptPuzzleMove(m,true);}
      else{this.fb=`✗ ${esc(sanStr)} isn’t good enough here. Try again.`;this.fbc='bad';A.beep(false);this.draw();}});},
  hint(){const s=this.s;let u=s.type==='drill'?s.moves[this.mi]:(!this.engineMode?(s.solution||[])[this.mi]:null);
    if(!u&&this.lastHintFen===fenOf(this.pos))return;
    const show=u=>{const f=sqi(u.slice(0,2));this.marks={[f]:'#5a5aff'};this.fb=s.hint&&s.type==='puzzle'&&this.mi===0?'💡 '+s.hint:'💡 Move the highlighted piece.';this.fbc='';this.draw();};
    if(u)show(u);else if(A.SF.ready){this.lastHintFen=fenOf(this.pos);A.SF.search(fenOf(this.pos),0,800).then(r=>show(r.uci));}},
  showSolution(){const s=this.s;let u=s.type==='drill'?s.moves[this.mi]:(!this.engineMode?(s.solution||[])[this.mi]:null);
    const show=u=>{const m=findUci(this.pos,u);if(!m)return;this.arrows=[{f:m.f,t:m.t,c:'#5a5aff'}];this.fb=`Answer: ${esc(A.san(this.pos,m))}. Play it on the board to continue.`;this.fbc='';this.draw();};
    if(u)show(u);else if(A.SF.ready)A.SF.search(fenOf(this.pos),0,800).then(r=>show(r.uci));}
};
function sqi(n){return (n.charCodeAt(0)-97)+(+n[1]-1)*8;}
function marksOf(o){if(!o)return null;const r={};for(const k in o)r[sqi(k)]=o[k];return r;}
function openLesson(cid,lid){show('learn');const c=Learn.all().find(x=>x.id===cid);if(!c)return;Learn.c=c;const li=Math.max(0,c.lessons.findIndex(l=>l.id===lid||l.id.startsWith(lid)));if(c.lessons.length)Learn.lesson(li);else Learn.course(cid);}
window.CCLearn={fromFen,Learn,Two,Hist,show,openLesson,drawBoard,esc,LS,findUci,uciOf,fenOf,CCX};
})();
