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

// ---------------- History storage ----------------
const CCX=window.CCX={
  newId(){return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);},
  games(){return LS.get('ccc_games',[]);},
  saveGame(g){const all=CCX.games();const i=all.findIndex(x=>x.id===g.id);if(i>=0)all[i]=g;else all.unshift(g);LS.set('ccc_games',all.slice(0,500));},
  deleteGame(id){LS.set('ccc_games',CCX.games().filter(g=>g.id!==id));}};
function pgnOf(g){
  const d=new Date(g.date||Date.now());const ds=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  let mv='';g.moves.forEach((m,i)=>{if(i%2===0)mv+=(i/2+1)+'. ';mv+=m+' ';});
  return `[Event "${g.type==='engine'?'Game vs engine':'Two-player game'}"]\n[Site "Chess Cam Coach"]\n[Date "${ds}"]\n[White "${g.white}"]\n[Black "${g.black}"]\n[Result "${g.result}"]\n\n${mv}${g.result}\n`;}
function copyText(t,btn){
  const done=()=>{const o=btn.textContent;btn.textContent='✓ Copied';setTimeout(()=>btn.textContent=o,1500);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,()=>fallback());else fallback();
  function fallback(){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){}ta.remove();}}
function resultText(g){
  if(g.result==='1-0')return `${g.white} won`;if(g.result==='0-1')return `${g.black} won`;if(g.result==='1/2-1/2')return 'Draw';return 'Unfinished';}

// ---------------- Tabs ----------------
let curView='play';
function show(v){
  curView=v;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  $('viewPlay').classList.toggle('hide',v!=='play');
  ['two','learn','hist'].forEach(x=>$('view'+x[0].toUpperCase()+x.slice(1)).classList.toggle('hide',v!==x));
  document.body.classList.toggle('otherview',v!=='play');
  if(v==='two')Two.render();if(v==='learn')Learn.home();if(v==='hist')Hist.list();
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
      <label style="margin-top:12px"><input type="checkbox" id="pFlip" ${fl?'checked':''}> Turn the board around after each move (for sitting opposite each other)</label>
      <div class="fb bad" id="pErr"></div>
      <div class="row" style="justify-content:center"><button class="primary big" id="pStart">Start game</button></div></div>
      ${this.unfinishedHtml()}`;
    $('pStart').onclick=()=>{
      const w=$('pW').value.trim(),b=$('pB').value.trim();
      if(!w||!b){$('pErr').textContent='Please enter both players’ names.';(w?$('pB'):$('pW')).focus();return;}
      if(w.toLowerCase()===b.toLowerCase()){$('pErr').textContent='Please use two different names.';return;}
      LS.set('ccc_2p_names',{w,b});LS.set('ccc_2p_flip',$('pFlip').checked);
      this.start({id:CCX.newId(),type:'2p',date:new Date().toISOString(),white:w,black:b,result:'*',moves:[],uci:[]});};
    document.querySelectorAll('[data-resume]').forEach(el=>el.onclick=()=>{const g=CCX.games().find(x=>x.id===el.dataset.resume);if(g)this.start(g);});},
  unfinishedHtml(){const u=CCX.games().filter(g=>g.type==='2p'&&g.result==='*'&&g.moves.length).slice(0,3);
    if(!u.length)return '';
    return `<div class="card"><h2>Continue a game</h2>${u.map(g=>`<div class="list-item" data-resume="${g.id}"><div><b>${esc(g.white)}</b> vs <b>${esc(g.black)}</b><div class="small muted">${new Date(g.date).toLocaleString()} · ${g.moves.length} moves</div></div><span class="pill">Resume ▶</span></div>`).join('')}</div>`;},
  start(g){this.g=JSON.parse(JSON.stringify(g));this.pos=startPos();this.stack=[];
    for(const u of this.g.uci){const m=findUci(this.pos,u);if(!m)break;this.stack.push({m,u:make(this.pos,m)});}
    this.view='game';this.drawOffer=false;this.click=mover(()=>this.g.result==='*'?this.pos:null,m=>this.play(m),()=>this.draw());this.draw();},
  play(m){const s=A.san(this.pos,m);this.stack.push({m,u:make(this.pos,m)});this.g.moves.push(s);this.g.uci.push(uciOf(m));this.drawOffer=false;
    const st=status(this.pos);
    if(st==='mate')this.g.result=this.pos.turn===1?'0-1':'1-0';else if(st==='stalemate'||st==='fifty'||st==='material')this.g.result='1/2-1/2';
    CCX.saveGame(this.g);A.beep(true);this.draw();},
  undo(){if(!this.stack.length)return;const x=this.stack.pop();unmake(this.pos,x.m,x.u);this.g.moves.pop();this.g.uci.pop();this.g.result='*';CCX.saveGame(this.g);this.click.clear();this.draw();},
  end(res,why){this.g.result=res;this.g.why=why;CCX.saveGame(this.g);this.draw();},
  draw(){
    const g=this.g,pos=this.pos,turnW=pos.turn===1,st=status(pos),over=g.result!=='*';
    const flip=LS.get('ccc_2p_flip',true)?!turnW&&!over:false;
    const name=turnW?g.white:g.black,last=this.stack.length?this.stack[this.stack.length-1].m:null;
    let label,main,cls;
    if(over){cls='over';label='Game over';
      main=st==='mate'?`Checkmate! ${esc(turnW?g.black:g.white)} wins`:g.result==='1/2-1/2'?(st==='stalemate'?'Stalemate: draw':g.why||'Draw'):esc(g.why||resultText(g));}
    else{cls='you';label=st==='check'?'Check!':'To move';main=`<span class="pc ${turnW?'w':'b'}">${turnW?'♔':'♚'}︎</span>${esc(name)}`;}
    let mv='';g.moves.forEach((m,i)=>{if(i%2===0)mv+=`<b>${i/2+1}.</b> `;mv+=esc(m)+' ';});
    $('viewTwo').innerHTML=`<div class="card">
      <div class="players"><span class="${turnW&&!over?'on':''}">♔ ${esc(g.white)}</span><span class="muted small">vs</span><span class="${!turnW&&!over?'on':''}">♚ ${esc(g.black)}</span></div>
      <div id="twoCard" class="mcard ${cls}"><div class="mcLabel">${label}</div><div class="mcMain">${main}</div><div class="mcSub">${last&&!over?'Last move: '+esc(g.moves[g.moves.length-1]):''}</div></div>
      <div id="twoBoard"></div>
      <div class="row" style="justify-content:center">
        <button id="tUndo" ${this.stack.length?'':'disabled'}>↶ Undo move</button>
        ${over?'':`<button id="tDraw">${this.drawOffer?'✓ Agree draw':'½ Offer draw'}</button><button id="tResign">🏳 ${esc(name)} resigns</button>`}
        <button id="tNew">New game</button></div>
      <div class="mlist">${mv||'No moves yet.'}</div></div>`;
    drawBoard($('twoBoard'),pos,{flip,last,sel:this.click.sel(),targets:this.click.targets(),onClick:over?null:this.click});
    $('tUndo').onclick=()=>this.undo();
    $('tNew').onclick=()=>{this.g=null;this.setup();};
    if(!over){$('tDraw').onclick=()=>{if(this.drawOffer)this.end('1/2-1/2','Draw agreed');else{this.drawOffer=true;this.draw();}};
      $('tResign').onclick=e=>{const b=e.target;if(b.dataset.sure){this.end(turnW?'0-1':'1-0',`${name} resigned`);}else{b.dataset.sure=1;b.textContent='Tap again to resign';}};}}
};

// ================= HISTORY =================
const Hist={
  list(){
    const all=CCX.games();
    $('viewHist').innerHTML=`<div class="card"><h2>Game history</h2>
      ${all.length?`<p class="muted small">${all.length} saved game${all.length>1?'s':''} on this device. Tap a game to replay it.</p>`:'<p class="muted">No games yet. Games against the engine and two-player games are saved here automatically.</p>'}
      ${all.map(g=>`<div class="list-item" data-g="${g.id}"><div><b>${esc(g.white)}</b> vs <b>${esc(g.black)}</b>
        <div class="small muted">${new Date(g.date).toLocaleString()} · ${g.type==='engine'?'vs engine':'two players'} · ${g.moves.length} moves</div></div>
        <span class="pill ${g.result!=='*'?'done':''}">${esc(resultText(g))}</span></div>`).join('')}
      ${all.length?'<div class="row"><button id="hAll">📋 Copy all games (PGN)</button></div>':''}</div>`;
    document.querySelectorAll('[data-g]').forEach(el=>el.onclick=()=>this.open(el.dataset.g));
    if(all.length)$('hAll').onclick=e=>copyText(all.map(pgnOf).join('\n'),e.target);},
  open(id){
    const g=CCX.games().find(x=>x.id===id);if(!g)return this.list();
    const ps=[startPos()],ms=[];for(const u of g.uci){const p=clonePos(ps[ps.length-1]),m=findUci(p,u);if(!m)break;make(p,m);ps.push(p);ms.push(m);}
    let i=ps.length-1,flip=false;
    const draw=()=>{
      let mv='';g.moves.slice(0,ms.length).forEach((m,k)=>{if(k%2===0)mv+=`<b>${k/2+1}.</b> `;mv+=`<span data-k="${k+1}" class="${k+1===i?'cur':''}">${esc(m)}</span> `;});
      $('viewHist').innerHTML=`<div class="card"><button id="hBack">← All games</button>
        <div class="players" style="margin-top:12px"><span>♔ ${esc(g.white)}</span><span class="pill ${g.result!=='*'?'done':''}">${esc(resultText(g))}</span><span>♚ ${esc(g.black)}</span></div>
        <div class="small muted" style="text-align:center;margin-top:4px">${new Date(g.date).toLocaleString()} · ${g.type==='engine'?'vs engine':'two players'}</div>
        <div id="histBoard"></div>
        <div class="row" style="justify-content:center"><button id="h0">⏮</button><button id="hP">◀</button><span class="muted">${i} / ${ps.length-1}</span><button id="hN">▶</button><button id="hE">⏭</button><button id="hF">⇅ Flip</button></div>
        <div class="mlist">${mv||'No moves.'}</div>
        <div class="row"><button id="hCopy">📋 Copy PGN</button>${g.type==='2p'&&g.result==='*'?'<button id="hResume" class="primary">▶ Continue this game</button>':''}<button id="hDel">🗑 Delete</button></div></div>`;
      drawBoard($('histBoard'),ps[i],{flip,last:i?ms[i-1]:null});
      $('hBack').onclick=()=>this.list();
      $('h0').onclick=()=>{i=0;draw();};$('hP').onclick=()=>{if(i>0)i--;draw();};$('hN').onclick=()=>{if(i<ps.length-1)i++;draw();};$('hE').onclick=()=>{i=ps.length-1;draw();};
      $('hF').onclick=()=>{flip=!flip;draw();};
      document.querySelectorAll('.mlist [data-k]').forEach(el=>el.onclick=()=>{i=+el.dataset.k;draw();});
      $('hCopy').onclick=e=>copyText(pgnOf(g),e.target);
      if($('hResume'))$('hResume').onclick=()=>{show('two');Two.start(g);};
      $('hDel').onclick=e=>{const b=e.target;if(b.dataset.sure){CCX.deleteGame(g.id);this.list();}else{b.dataset.sure=1;b.textContent='Tap again to delete';}};};
    draw();}
};

// ================= LEARN =================
// Step types (see courses.js):
//  {type:'show', fen, text, arrows:['e2e4'], marks:{e4:'#5fbf7a'}}
//  {type:'line', fen?, text, moves:[['e2e4','comment'],...]}            step through a line move by move
//  {type:'drill', fen?, text, moves:['e2e4','e7e5',...], side:'w'|'b'}     play your side of a line from memory
//  {type:'puzzle', fen, text, solution:['uci',...], mate?:N, hint?}        find the best move(s)
const prog=()=>LS.get('ccc_progress',{});
const Learn={
  home(){
    const P=prog(),C=window.COURSES||[];
    $('viewLearn').innerHTML=`<div class="card"><h2>Courses</h2><p class="muted small">Lessons explain an idea on the board, then let you practise it. Puzzles are checked by Stockfish, so any move that works is accepted.</p>
      ${C.map(c=>{const n=c.lessons.length,d=c.lessons.filter(l=>P[l.id]).length;return `<div class="list-item" data-c="${c.id}"><div><b>${c.icon} ${esc(c.title)}</b><div class="small muted">${esc(c.desc)}</div></div><span class="pill ${d===n?'done':''}">${d}/${n}</span></div>`;}).join('')}</div>`;
    document.querySelectorAll('[data-c]').forEach(el=>el.onclick=()=>this.course(el.dataset.c));},
  course(cid){
    const c=(window.COURSES||[]).find(x=>x.id===cid),P=prog();this.c=c;
    $('viewLearn').innerHTML=`<div class="card"><button id="lBack">← Courses</button><h2 style="margin-top:12px">${c.icon} ${esc(c.title)}</h2><p class="muted small">${esc(c.desc)}</p>
      ${c.lessons.map((l,i)=>`<div class="list-item" data-l="${i}"><div><b>${i+1}. ${esc(l.title)}</b><div class="small muted">${esc(l.sub||'')}</div></div><span class="pill ${P[l.id]?'done':''}">${P[l.id]?'✓ Done':l.steps.length+' steps'}</span></div>`).join('')}</div>`;
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
    $('lBack').onclick=()=>this.course(this.c.id);
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
    if(next)$('lNextL').onclick=()=>this.lesson(this.li+1);$('lCourse').onclick=()=>this.course(this.c.id);},
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
window.CCLearn={fromFen,Learn,Two,Hist,show};
})();
