// Chess Cam Coach: game review (analysis, feedback, patterns, puzzles from your mistakes)
(function(){
const $=id=>document.getElementById(id);
const A=window.CCApp,X=window.CCLearn;
const VALS=[0,1,3,3,5,9,0];
const SQ=s=>'abcdefgh'[s&7]+((s>>3)+1);
const esc=X.esc,LS=X.LS;
const wp=cp=>1/(1+Math.exp(-0.00368208*cp));
const clampCp=s=>Math.abs(s)>50000?Math.sign(s)*1500:Math.max(-1500,Math.min(1500,s));
function fmtEval(s){if(Math.abs(s)>50000){const n=100000-Math.abs(s);return n<=0?(s>0?'1-0':'0-1'):(s>0?'+M':'−M')+n;}return (s>=0?'+':'−')+Math.abs(s/100).toFixed(1);}

// ---------- separate Stockfish worker for analysis (so it never slows down a game) ----------
const AN={w:null,ready:null,listeners:[],q:Promise.resolve(),
  init(){if(this.ready)return this.ready;
    this.ready=new Promise(res=>{let done=false;const fin=v=>{if(!done){done=true;res(v);}};
      try{this.w=new Worker('engine/stockfish-19-lite-single.js');}catch(e){return fin(false);}
      const to=setTimeout(()=>fin(false),30000);
      this.w.onmessage=e=>{const l=String(e.data);if(l==='uciok'){this.w.postMessage('setoption name Hash value 32');this.w.postMessage('isready');}else if(l==='readyok'){clearTimeout(to);fin(true);}this.listeners.slice().forEach(f=>f(l));};
      this.w.onerror=()=>fin(false);this.w.postMessage('uci');});
    return this.ready;},
  analyse(fen,depth,ms){const job=()=>new Promise(res=>{const out={cp:0,mate:null,pv:[],best:null};
      const f=l=>{if(l.startsWith('info')&&l.includes(' pv ')){const sc=l.match(/score (cp|mate) (-?\d+)/);if(sc){if(sc[1]==='cp'){out.cp=+sc[2];out.mate=null;}else out.mate=+sc[2];}out.pv=l.split(' pv ')[1].trim().split(/\s+/);}
        else if(l.startsWith('bestmove')){this.listeners.splice(this.listeners.indexOf(f),1);out.best=l.split(' ')[1];res(out);}};
      this.listeners.push(f);this.w.postMessage('position fen '+fen);this.w.postMessage(`go depth ${depth} movetime ${ms}`);});
    const p=this.q.then(job);this.q=p.catch(()=>{});return p;}};

// ---------- helpers ----------
function sanLine(pos,ucis){const p=clonePos(pos),out=[];for(const u of ucis){const m=X.findUci(p,u);if(!m)break;out.push(A.san(p,m));make(p,m);}return out.join(' ');}
function material(p,c){let t=0;for(const x of p.b)if(x&&Math.sign(x)===c)t+=VALS[Math.abs(x)];return t;}
function npMaterial(p){let t=0;for(const x of p.b){const a=Math.abs(x);if(a>=2&&a<=5)t+=VALS[a];}return t;}
// material change for side `me` along a line of uci moves
function lineGain(pos,ucis,me){const p=clonePos(pos),m0=material(p,me)-material(p,-me);for(const u of ucis){const m=X.findUci(p,u);if(!m)break;make(p,m);}return (material(p,me)-material(p,-me))-m0;}
function phaseOf(p,ply){const np=npMaterial(p);if(ply<20&&np>=50)return 'opening';if(np<=26)return 'endgame';return 'middlegame';}
function forkTargets(p1,om,me){const q=clonePos(p1);const u=make(q,om),tg=[];if(inCheck(q,me))tg.push(A.pname(6));
  q.turn=-q.turn;const caps=gen(q,true).filter(x=>x.f===om.t&&x.c&&VALS[x.c]>=3);q.turn=-q.turn;
  const seen=new Set();caps.forEach(x=>{if(!seen.has(x.t)){seen.add(x.t);tg.push(A.pname(x.c));}});return tg;}
function noOf(ply){return Math.floor(ply/2)+1;}
function moveLabel(ply,san){return `${noOf(ply)}${ply%2===0?'.':'…'} ${san}`;}
const CLS={best:{sym:'',name:'Best move',c:'#5fbf7a'},good:{sym:'',name:'Good',c:''},ok:{sym:'',name:'OK',c:''},inacc:{sym:'?!',name:'Inaccuracy',c:'#e2b450'},mistake:{sym:'?',name:'Mistake',c:'#f08a3c'},blunder:{sym:'??',name:'Blunder',c:'#e06c5f'}};

// ---------- what went wrong in a move ----------
function explain(P,M,E,mv){
  const i=mv.i,p0=P[i],p1=P[i+1],me=mv.side,opp=-me;
  const bestM=mv.best?X.findUci(p0,mv.best):null,bestSan=bestM?A.san(p0,bestM):null;
  const pvSan=sanLine(p0,(E[i].pv||[]).slice(0,5));
  const opv=(E[i+1].pv||[]),om=opv[0]?X.findUci(p1,opv[0]):null,oppSan=om?A.san(p1,om):null,oppLine=sanLine(p1,opv.slice(0,5));
  const before=E[i].s,after=-E[i+1].s;
  let motif='positional',text='',piece=0;
  if(after<-50000){motif='allowedMate';text=`This allows a forced checkmate: ${oppLine}.`;}
  else if(before>50000&&after<50000){motif='missedMate';text=`You had a forced checkmate: ${pvSan}.`;}
  else{
    if(om&&om.c&&VALS[om.c]>=1){const t=om.t,def=attacked(p1,t,me),av=VALS[om.pt];
      const bigger=VALS[om.c]<=1&&(lineGain(p1,opv.slice(0,4),me)<=-3||after<-300);
      if((!def||av<VALS[om.c])&&(VALS[om.c]>=3||mv.loss>=0.10)&&!bigger){motif='hang';piece=om.c;
        text=`Your ${A.pname(om.c).toLowerCase()} on ${SQ(t)} ${!def?'was left unprotected':'could be taken by a '+A.pname(om.pt).toLowerCase()}: ${oppSan} wins it.`;}}
    if(motif==='positional'&&om){const f=forkTargets(p1,om,me);if(f.length>=2){motif='fork';text=`This allows ${oppSan}, a fork attacking your ${f.map(x=>x.toLowerCase()).join(' and ')}.`;}}
    if(motif==='positional'&&opv.length>=2&&lineGain(p1,opv.slice(0,4),me)<=-2){motif='tactic';text=`This allows a tactic that wins material: ${oppLine}.`;}
    if(motif==='positional'&&bestM&&bestM.c&&VALS[bestM.c]>=3&&(!attacked(p0,bestM.t,opp)||VALS[bestM.pt]<VALS[bestM.c])){motif='missedWin';piece=bestM.c;text=`You could have won a ${A.pname(bestM.c).toLowerCase()} with ${bestSan}.`;}
    if(motif==='positional'&&bestM&&(E[i].pv||[]).length>=2&&lineGain(p0,E[i].pv.slice(0,5),me)>=2){motif='missedTactic';text=`You missed a tactic that wins material: ${pvSan}.`;}
    if(motif==='positional'&&om&&after<-250){motif='tactic';text=`This allows ${oppLine||oppSan}, and the opponent wins (eval ${fmtEval(-E[i+1].s*1)}).`.replace('(eval','(engine eval');}
    if(motif==='positional')text=oppSan?`This allows ${oppSan}${oppLine&&oppLine!==oppSan?` (${oppLine})`:''}, after which the opponent is better.`:'This weakens your position.';
    if(bestSan&&motif!=='missedMate'&&motif!=='missedWin'&&motif!=='missedTactic')text+=` Better was ${bestSan}${pvSan&&pvSan!==bestSan?` (${pvSan})`:''}.`;}
  return {motif,mtext:text,bestSan,pvSan,oppSan,piece};}

// ---------- opening habits ("things you should not have done") ----------
function habits(P,M,G,side){
  const out=[],home=side===1?{n:[1,6],b:[2,5]}:{n:[57,62],b:[58,61]};let k=0,castled=0,flank=[],arrived={},kingMoved=false;
  for(let i=0;i<M.length;i++){const p=P[i];if(p.turn!==side)continue;k++;const m=M[i],san=G.moves[i]||'';
    const homeMinors=[...home.n,...home.b].filter(s=>Math.abs(p.b[s])===(home.n.includes(s)?2:3)&&Math.sign(p.b[s])===side).length;
    if(m.fl&F_CASTLE)castled=k;
    if(k<=6&&m.pt===5&&!m.c&&homeMinors>=3&&!inCheck(p,side))out.push({key:'earlyQueen',k,text:`Move ${k}: brought the queen out early (${san}) before developing. It can be chased around, costing you time.`});
    if(k<=8&&(m.pt===2||m.pt===3)&&!m.c&&arrived[m.f]&&homeMinors>=2&&!attacked(p,m.f,-side)&&!inCheck(p,side))out.push({key:'samePiece',k,text:`Move ${k}: moved the same piece twice (${san}) while other pieces were still undeveloped.`});
    if(k<=6&&m.pt===1&&!m.c&&[0,1,6,7].includes(m.f&7))flank.push(san);
    if(m.pt===6&&!(m.fl&F_CASTLE)&&!castled&&k<=15&&!kingMoved&&npMaterial(p)>=40&&!inCheck(p,side)){kingMoved=true;out.push({key:'kingWalk',k,text:`Move ${k}: moved the king (${san}) and lost the right to castle.`});}
    if(k===10&&homeMinors>=2)out.push({key:'slowDev',k,text:`By move 10, ${homeMinors} of your minor pieces were still on their starting squares.`});
    if(k===13&&!castled&&!kingMoved){const ks=p.b.indexOf(6*side);const qOpp=p.b.some(x=>x===-5*side);if(qOpp&&[4,60].includes(ks))out.push({key:'lateCastle',k,text:`Move 13 and still not castled: your king stayed in the centre with the enemy queen on the board.`});}
    arrived[m.t]=1;delete arrived[m.f];}
  if(flank.length>=2)out.push({key:'flankPawns',k:1,text:`Spent ${flank.length} early moves on edge pawns (${flank.join(', ')}). Developing pieces and fighting for the centre matter more.`});
  return out;}

// ---------- full analysis of one game ----------
async function compute(g,onProg){
  const ok=await AN.init();
  const pos=startPos(),P=[clonePos(pos)],M=[];
  for(const u of g.uci){const m=X.findUci(pos,u);if(!m)break;M.push(m);make(pos,m);P.push(clonePos(pos));}
  const N=M.length,E=[];
  for(let i=0;i<=N;i++){const p=P[i];
    if(!legal(p).length)E.push({s:inCheck(p,p.turn)?-100000:0,best:null,pv:[]});
    else{let r;
      if(ok)r=await AN.analyse(X.fenOf(p,i),13,650);
      else{const q=await A.SF.search(X.fenOf(p,i),0,500);r={cp:q.score,mate:null,best:q.uci,pv:[q.uci]};}
      const s=r.mate!=null?(r.mate>0?100000-r.mate:r.mate<0?-100000-r.mate:-100000):r.cp;
      E.push({s,best:r.best,pv:(r.pv||[]).slice(0,8)});}
    onProg&&onProg(i+1,N+1);}
  const moves=[];
  for(let i=0;i<N;i++){const p=P[i],m=M[i],side=p.turn,uci=X.uciOf(m),isBest=E[i].best===uci;
    const before=E[i].s,after=-E[i+1].s,wB=wp(clampCp(before)),wA=wp(clampCp(after));
    let loss=isBest?0:Math.max(0,wB-wA);
    if(before>50000&&after>50000)loss=Math.min(loss,0.04); // still mating: fine
    const cls=loss>=0.15?'blunder':loss>=0.10?'mistake':loss>=0.05?'inacc':isBest?'best':loss<0.02?'good':'ok';
    const acc=Math.max(0,Math.min(100,103.1668*Math.exp(-0.04354*(wB-wA)*100)-3.1669));
    const mv={i,side,san:g.moves[i]||A.san(p,m),uci,best:E[i].best,before,after,loss:+loss.toFixed(3),cls,acc:Math.round(acc),phase:phaseOf(p,i),ms:g.ms?g.ms[i]:null};
    if(cls==='inacc'||cls==='mistake'||cls==='blunder')Object.assign(mv,explain(P,M,E,mv));
    moves.push(mv);}
  const acc={},hab={};
  for(const s of [1,-1]){const a=moves.filter(m=>m.side===s);acc[s]=a.length?Math.round(a.reduce((t,m)=>t+m.acc,0)/a.length):null;hab[s]=habits(P,M,g,s);}
  return {v:1,at:Date.now(),evals:E.map((e,i)=>e.s*P[i].turn),moves,acc,hab};}

// ---------- who is "you" in a game ----------
function myName(){try{return (localStorage.getItem('ccc_yourname')||'').trim()||'You';}catch(e){return 'You';}}
function humanSides(g){
  if(g.type==='engine')return [g.human||(String(g.white).startsWith('Stockfish')?-1:1)];
  return [1,-1];}
function nameOf(g,side){return side===1?g.white:g.black;}

// ---------- lessons for one side of one game ----------
const TIPS={
  hang:{t:'You left pieces unprotected',tip:'Before every move, do a blunder check: what does my move leave undefended, and what can my opponent capture or check next?',go:['tactics','tt-fork']},
  allowedMate:{t:'You allowed checkmate',tip:'King safety first: after choosing a move, look at every check your opponent could give in reply.',go:['mates','mt-patterns']},
  fork:{t:'You allowed forks',tip:'Watch the squares where an enemy knight or queen could attack two of your pieces (or king + piece) at once, and keep pieces defended.',go:['tactics','tt-fork']},
  tactic:{t:'You fell for tactics',tip:'After each opponent move, ask “what is the threat?” before thinking about your own plan.',go:['tactics','tt-discovered']},
  missedMate:{t:'You missed checkmates',tip:'In attacking positions, look at all checks first: checks, captures, threats, in that order.',go:['mates','mate2-1']},
  missedWin:{t:'You missed free material',tip:'Every move, scan for pieces you can win: undefended pieces and favourable captures.',go:['tactics','calc-1']},
  missedTactic:{t:'You missed tactics',tip:'When your pieces are active, calculate forcing moves (checks, captures, threats) 2–3 moves deep.',go:['tactics','calc-1']},
  positional:{t:'Positional errors',tip:'With no tactics around, improve your worst piece, fight for open files and outposts, and avoid needless pawn weaknesses.',go:['middlegame','mg-outpost']},
  opening:{t:'Opening principles broken',tip:'Develop knights and bishops first, castle early, don’t move the same piece twice and keep the queen home until development is done.',go:['openings','op-italian']},
  endgame:{t:'Endgame errors',tip:'In the endgame, activate your king, push passed pawns, and learn the key positions: opposition, Lucena, Philidor.',go:['endgames','eg-opp']},
  fast:{t:'Mistakes made too quickly',tip:'Several mistakes came from moves made in a few seconds. Spend at least a short blunder check on every move.',go:null},
  opening_phase:{t:'Mistakes in the opening',tip:'Learn the ideas of one opening for White and one for Black, and follow the principles when you leave known lines.',go:['openings','op-italian']}};
function issuesFor(moves,hab){
  const sc={},cnt={};const add=(k,w)=>{sc[k]=(sc[k]||0)+w;cnt[k]=(cnt[k]||0)+1;};
  for(const m of moves){if(!m.motif)continue;const w=m.cls==='blunder'?3:m.cls==='mistake'?2:0.7;
    if(m.motif!=='positional'||m.cls!=='inacc')add(m.motif,w);
    if(m.phase==='endgame'&&m.cls!=='inacc')add('endgame',w*0.8);
    if(m.phase==='opening'&&m.cls!=='inacc')add('opening_phase',w*0.25);
    if(m.ms!=null&&m.ms<4000&&m.cls!=='inacc')add('fast',w*0.7);}
  if(hab&&hab.length)for(const h of hab)add('opening',1.2);
  return Object.keys(sc).sort((a,b)=>sc[b]-sc[a]).map(k=>({k,score:sc[k],n:cnt[k]}));}

// ---------- queue: review games automatically in the background ----------
const R={queue:[],busy:null,prog:{},listeners:[],
  auto(id){const g=X.CCX.games().find(x=>x.id===id);if(!g||g.review||g.moves.length<4)return;if(this.busy===id||this.queue.includes(id))return;this.queue.push(id);this.run();},
  run(){if(this.busy||!this.queue.length)return;const id=this.queue.shift();const g=X.CCX.games().find(x=>x.id===id);if(!g){this.run();return;}
    this.busy=id;this.prog[id]=0;this.emit();
    compute(g,(a,b)=>{this.prog[id]=a/b;this.emit();}).then(rv=>{
      const cur=X.CCX.games().find(x=>x.id===id);
      if(cur&&cur.uci.join(' ')===g.uci.join(' ')){cur.review=rv;cur.reviewUci=g.uci.length;X.CCX.saveGame(cur,true);}
      delete this.prog[id];this.busy=null;this.emit(id);this.run();
    }).catch(e=>{console.error(e);delete this.prog[id];this.busy=null;this.emit();this.run();});},
  emit(done){this.listeners.forEach(f=>{try{f(done);}catch(e){}});}};

// ---------- rendering: one game's review ----------
function evalGraph(rv,cur){
  const W=600,H=110,N=rv.evals.length-1||1;
  const y=s=>H-wp(clampCp(s))*H;
  let path=`M0,${H} `;rv.evals.forEach((s,i)=>path+=`L${(i/N*W).toFixed(1)},${y(s).toFixed(1)} `);path+=`L${W},${H} Z`;
  let dots='';rv.moves.forEach(m=>{if(m.cls==='blunder'||m.cls==='mistake'){const x=((m.i+1)/N*W).toFixed(1);dots+=`<circle cx="${x}" cy="${y(rv.evals[m.i+1]).toFixed(1)}" r="5" fill="${CLS[m.cls].c}" stroke="#111" data-ply="${m.i+1}" style="cursor:pointer"/>`;}});
  const cx=cur!=null?(cur/N*W).toFixed(1):null;
  return `<svg viewBox="0 0 ${W} ${H}" class="egraph" preserveAspectRatio="none" style="width:100%;height:90px;display:block;border-radius:8px;background:#2a2e36;margin-top:8px">
    <path d="${path}" fill="#e8e6e1" opacity=".9"/><line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#888" stroke-dasharray="4 4"/>
    ${cx?`<line x1="${cx}" y1="0" x2="${cx}" y2="${H}" stroke="#e2b450" stroke-width="2"/>`:''}${dots}</svg>
    <div class="small muted" style="display:flex;justify-content:space-between"><span>White ahead ↑</span><span>tap a dot to jump to that moment</span><span>Black ahead ↓</span></div>`;}
function sideReport(g,rv,side,showName){
  const mv=rv.moves.filter(m=>m.side===side),n=c=>mv.filter(m=>m.cls===c).length,hab=rv.hab[side]||[];
  const name=nameOf(g,side),best=mv.filter(m=>m.cls==='best'||m.cls==='good').length;
  const issues=issuesFor(mv,hab).slice(0,4);
  const key=mv.filter(m=>m.cls==='blunder'||m.cls==='mistake').sort((a,b)=>b.loss-a.loss).slice(0,5).sort((a,b)=>a.i-b.i);
  let h=`<div class="card"><h2>${showName?esc(name):'Your game'} ${side===1?'♔':'♚'}</h2>
    <div class="stats"><div><b>${rv.acc[side]??'–'}%</b><span>accuracy</span></div><div style="color:${CLS.blunder.c}"><b>${n('blunder')}</b><span>blunders ??</span></div><div style="color:${CLS.mistake.c}"><b>${n('mistake')}</b><span>mistakes ?</span></div><div style="color:${CLS.inacc.c}"><b>${n('inacc')}</b><span>inaccuracies ?!</span></div></div>
    <p class="small muted">${best} of ${mv.length} moves were best or good. A <b>blunder</b> throws away a big part of your winning chances (often a piece or the game), a <b>mistake</b> clearly worsens your position, an <b>inaccuracy</b> is a weaker move than the best one.</p>`;
  // what to learn
  h+=`<h3>📌 What to learn from this game</h3>`;
  if(!issues.length)h+=`<p>${n('blunder')+n('mistake')===0?'No mistakes or blunders: excellent, careful play! Keep doing blunder checks every move.':'Only small inaccuracies. Well played.'}</p>`;
  else h+=`<ol class="lessons">${issues.map(it=>{const T=TIPS[it.k];return `<li><b>${T.t}</b> (${it.n}×). ${T.tip}${T.go?` <button class="mini" data-go="${T.go.join(':')}">Practise →</button>`:''}</li>`;}).join('')}</ol>`;
  // things you should not have done
  const bad=[...hab.map(x=>({k:x.k,text:x.text})),...mv.filter(m=>m.cls==='blunder').map(m=>({k:noOf(m.i),text:`Move ${moveLabel(m.i,m.san)}: blunder. ${m.mtext||''}`}))].sort((a,b)=>a.k-b.k);
  if(bad.length)h+=`<h3>🚫 Things you should not have done</h3><ul class="lessons">${bad.map(b=>`<li>${esc(b.text)}</li>`).join('')}</ul>`;
  // key moments
  if(key.length){h+=`<h3>🔑 Key moments</h3>`;
    key.forEach((m,j)=>{h+=`<div class="moment"><div class="mhead" style="border-left:4px solid ${CLS[m.cls].c}"><b>${moveLabel(m.i,esc(m.san))}${CLS[m.cls].sym}</b> · ${CLS[m.cls].name} · <span class="muted">${m.phase}, eval ${fmtEval(m.before)} → ${fmtEval(m.after)}${m.ms!=null?`, played in ${Math.round(m.ms/1000)} s`:''}</span></div>
      <div class="mbody"><div class="cboard mini" id="km-${side}-${j}"></div><div class="mtext">${esc(m.mtext||'')}<div class="row"><button class="mini primary" data-retry="${m.i}">🧩 Find the better move</button><button class="mini" data-ply="${m.i}">Show in game</button></div></div></div></div>`;});}
  return {html:h+'</div>',key};}
function section(g,el,setPly){
  const id=g.id;
  if(!g.review){
    const p=R.prog[id];
    if(p!=null||R.busy===id||R.queue.includes(id)){el.innerHTML=`<div class="card"><h2>📊 Game review</h2><p>Analysing every move with Stockfish… ${Math.round((p||0)*100)}%</p><div class="pbar"><div style="width:${Math.round((p||0)*100)}%"></div></div><p class="small muted">You can keep using the app; the review appears here when it’s ready.</p></div>`;}
    else if(g.moves.length<4)el.innerHTML='';
    else{el.innerHTML=`<div class="card"><h2>📊 Game review</h2><p>See your accuracy, blunders, key moments and what to learn from this game.</p><button class="primary big" id="rvGo">Analyse this game</button></div>`;
      $('rvGo').onclick=()=>{R.queue.unshift(id);R.run();section(g,el,setPly);};}
    return;}
  const rv=g.review,sides=humanSides(g),two=g.type!=='engine';
  let html=`<div class="card"><h2>📊 Game review</h2>${evalGraph(rv,null)}
    ${two?`<div class="stats" style="margin-top:10px"><div><b>${rv.acc[1]}%</b><span>${esc(g.white)}</span></div><div><b>${rv.acc[-1]}%</b><span>${esc(g.black)}</span></div></div>`:''}
    <div class="row"><button id="rvPatterns">📈 My patterns across all games</button><button id="rvPuzzles">🧩 Practise my mistakes</button></div></div>`;
  const reps=sides.map(s=>sideReport(g,rv,s,two));
  html+=reps.map(r=>r.html).join('');
  el.innerHTML=html;
  // mini boards for key moments
  const P=[startPos()];{const p=startPos();for(const u of g.uci){const m=X.findUci(p,u);if(!m)break;make(p,m);P.push(clonePos(p));}}
  sides.forEach((s,si)=>reps[si].key.forEach((m,j)=>{const bm=m.best?X.findUci(P[m.i],m.best):null,pm=X.findUci(P[m.i],m.uci);
    X.drawBoard($(`km-${s}-${j}`),P[m.i],{flip:s===-1,arrows:[pm&&{f:pm.f,t:pm.t,c:'#e06c5f'},bm&&{f:bm.f,t:bm.t,c:'#2e9e52'}].filter(Boolean),last:m.i?X.findUci(P[m.i-1],g.uci[m.i-1]):null});}));
  el.querySelectorAll('[data-ply]').forEach(b=>b.onclick=()=>{setPly(+b.dataset.ply+(b.tagName==='circle'?0:0));window.scrollTo({top:0,behavior:'smooth'});});
  el.querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>{const m=rv.moves[+b.dataset.retry];openRetry(g,m,P);});
  el.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const [c,l]=b.dataset.go.split(':');X.openLesson(c,l);});
  $('rvPatterns').onclick=()=>insights($('viewHist'));
  $('rvPuzzles').onclick=()=>{X.show('learn');X.Learn.course('mine');};}
function puzzleFrom(g,m,P,label){
  const p=P[m.i];return {type:'puzzle',fen:X.fenOf(p,m.i),last:m.i?g.uci[m.i-1]:null,solution:[m.best],flip:m.side===-1,
    text:`<b>${label||'Find a better move.'}</b> In the game ${m.side===1?'White':'Black'} played <b>${esc(m.san)}</b> here (${CLS[m.cls].name.toLowerCase()}). What should ${m.side===1?'White':'Black'} play instead?`};}
function openRetry(g,m,P){const st=puzzleFrom(g,m,P,`Move ${moveLabel(m.i,'')}`.trim());
  X.show('learn');X.Learn.playCustom({id:'__review',icon:'🧩',title:'Game review',desc:'',lessons:[{id:'__r'+g.id+m.i,title:'Retry the position',steps:[st]}]},0);}
// annotation for the replay board
function note(g,ply){const rv=g.review;if(!rv||!ply)return null;const m=rv.moves[ply-1];if(!m)return null;
  return {cls:m.cls,sym:CLS[m.cls].sym,color:CLS[m.cls].c,name:CLS[m.cls].name,best:m.best&&m.cls!=='best'?m.best:null,
    text:`${moveLabel(m.i,m.san)}${CLS[m.cls].sym} · ${CLS[m.cls].name} · eval ${fmtEval(rv.evals[ply])}`+(m.mtext?` · ${m.mtext}`:(m.best&&m.best!==m.uci&&m.loss>0.02&&m.bestSan?` · Best was ${m.bestSan}`:''))};}

// ---------- patterns across all games ----------
function insights(el,who){
  const games=X.CCX.games().filter(g=>g.review);
  const people={};games.forEach(g=>humanSides(g).forEach(s=>{const nm=nameOf(g,s),k=String(nm).toLowerCase();(people[k]=people[k]||{name:nm,list:[]}).list.push({g,side:s});}));
  const keys=Object.keys(people).sort((a,b)=>people[b].list.length-people[a].list.length);
  const me=myName().toLowerCase();who=who||(people[me]?me:keys[0]);
  if(!keys.length){el.innerHTML=`<div class="card"><button id="inBack">← All games</button><h2 style="margin-top:12px">📈 My patterns</h2><p>No reviewed games yet. Finish a game (against the engine or two players). It’s analysed automatically, and your patterns build up here.</p></div>`;$('inBack').onclick=()=>X.Hist.list();return;}
  const L=people[who].list.sort((a,b)=>new Date(a.g.date)-new Date(b.g.date));
  const mv=[],hab=[];L.forEach(({g,side})=>{g.review.moves.filter(m=>m.side===side).forEach(m=>mv.push(Object.assign({gid:g.id},m)));(g.review.hab[side]||[]).forEach(h=>hab.push(h));});
  const accs=L.map(({g,side})=>g.review.acc[side]).filter(x=>x!=null),avg=accs.length?Math.round(accs.reduce((a,b)=>a+b,0)/accs.length):0;
  const per=c=>(mv.filter(m=>m.cls===c).length/L.length).toFixed(1);
  const issues=issuesFor(mv,hab);
  const phases=['opening','middlegame','endgame'].map(ph=>[ph,mv.filter(m=>m.phase===ph&&(m.cls==='mistake'||m.cls==='blunder')).length]);
  const pieces={};mv.filter(m=>m.motif==='hang'&&m.piece).forEach(m=>{const n=A.pname(m.piece);pieces[n]=(pieces[n]||0)+1;});
  const habCount={};hab.forEach(h=>habCount[h.key]=(habCount[h.key]||0)+1);
  const HAB={earlyQueen:'Queen out too early',samePiece:'Same piece moved twice in the opening',flankPawns:'Too many early edge-pawn moves',kingWalk:'King moved, losing castling',slowDev:'Slow development (minor pieces at home on move 10)',lateCastle:'Castled late / king stuck in the centre'};
  const maxI=Math.max(1,...issues.map(i=>i.n)),maxP=Math.max(1,...phases.map(p=>p[1]));
  const spark=(()=>{if(accs.length<2)return '';const W=300,H=60,pts=accs.slice(-20).map((a,i,arr)=>`${(i/(arr.length-1)*W).toFixed(1)},${(H-a/100*H).toFixed(1)}`).join(' ');return `<svg viewBox="0 0 300 60" style="width:100%;height:60px;background:#2a2e36;border-radius:8px"><polyline points="${pts}" fill="none" stroke="#e2b450" stroke-width="2.5"/></svg><div class="small muted">Accuracy over your last ${Math.min(20,accs.length)} reviewed games</div>`;})();
  const top=issues.slice(0,3);
  el.innerHTML=`<div class="card"><button id="inBack">← All games</button><h2 style="margin-top:12px">📈 Patterns across your games</h2>
    ${keys.length>1?`<label>Player <select id="inWho">${keys.map(k=>`<option value="${esc(k)}" ${k===who?'selected':''}>${esc(people[k].name)} (${people[k].list.length})</option>`).join('')}</select></label>`:''}
    <div class="stats" style="margin-top:10px"><div><b>${L.length}</b><span>games reviewed</span></div><div><b>${avg}%</b><span>average accuracy</span></div><div style="color:${CLS.blunder.c}"><b>${per('blunder')}</b><span>blunders / game</span></div><div style="color:${CLS.mistake.c}"><b>${per('mistake')}</b><span>mistakes / game</span></div></div>
    ${spark}</div>
    <div class="card"><h2>🎯 Your top things to work on</h2>${top.length?`<ol class="lessons">${top.map(it=>{const T=TIPS[it.k];return `<li><b>${T.t}</b>: ${it.n} time${it.n>1?'s':''}. ${T.tip}${T.go?` <button class="mini" data-go="${T.go.join(':')}">Practise →</button>`:''}</li>`;}).join('')}</ol>`:'<p>No recurring problems found yet. Great!</p>'}
      <button class="primary" id="inPuz">🧩 Practise positions from my games</button></div>
    <div class="card"><h2>🔁 Your most common mistakes</h2>${issues.length?issues.map(it=>`<div class="bar"><span>${TIPS[it.k].t}</span><div><i style="width:${Math.round(it.n/maxI*100)}%"></i></div><b>${it.n}</b></div>`).join(''):'<p class="muted">None yet.</p>'}</div>
    <div class="card"><h2>⏳ When your mistakes happen</h2>${phases.map(([ph,n])=>`<div class="bar"><span>${ph[0].toUpperCase()+ph.slice(1)}</span><div><i style="width:${Math.round(n/maxP*100)}%"></i></div><b>${n}</b></div>`).join('')}
      <p class="small muted">Mistakes and blunders only. ${phases[2][1]>phases[0][1]+phases[1][1]?'Most of your errors happen in the endgame: study the Endgames course.':phases[0][1]>=Math.max(phases[1][1],phases[2][1])&&phases[0][1]>0?'Many errors come early: work on opening principles and your repertoire.':''}</p></div>
    ${Object.keys(pieces).length?`<div class="card"><h2>♟ Pieces you leave hanging most</h2>${Object.entries(pieces).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<div class="bar"><span>${n}</span><div><i style="width:${Math.round(c/Math.max(...Object.values(pieces))*100)}%"></i></div><b>${c}</b></div>`).join('')}</div>`:''}
    ${Object.keys(habCount).length?`<div class="card"><h2>📖 Opening habits to fix</h2>${Object.entries(habCount).sort((a,b)=>b[1]-a[1]).map(([k,c])=>`<div class="bar"><span>${HAB[k]||k}</span><div><i style="width:${Math.round(c/L.length*100)}%"></i></div><b>${c}/${L.length}</b></div>`).join('')}<p class="small muted">Number of games where it happened.</p></div>`:''}`;
  $('inBack').onclick=()=>X.Hist.list();
  if($('inWho'))$('inWho').onchange=e=>insights(el,e.target.value);
  $('inPuz').onclick=()=>{X.show('learn');X.Learn.course('mine');};
  el.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const [c,l]=b.dataset.go.split(':');X.openLesson(c,l);});
  window.scrollTo({top:0});}

// ---------- "From your games" course for Learn ----------
function mistakeCourse(){
  const games=X.CCX.games().filter(g=>g.review),lessons=[];
  for(const g of games){
    const P=[startPos()];{const p=startPos();for(const u of g.uci){const m=X.findUci(p,u);if(!m)break;make(p,m);P.push(clonePos(p));}}
    const steps=[];humanSides(g).forEach(s=>g.review.moves.filter(m=>m.side===s&&(m.cls==='blunder'||m.cls==='mistake')&&m.best&&P[m.i]).forEach(m=>steps.push(puzzleFrom(g,m,P,`${esc(nameOf(g,s))}, move ${noOf(m.i)}.`))));
    if(steps.length)lessons.push({id:'my-'+g.id,title:`${g.white} vs ${g.black}`,sub:`${new Date(g.date).toLocaleDateString()} · ${steps.length} position${steps.length>1?'s':''} to fix`,steps});}
  return {id:'mine',icon:'🧩',title:'From your games',desc:lessons.length?'Positions where you went wrong in your own games. Find the better move.':'Play and finish games: your mistakes become puzzles here.',lessons};}

window.CCReview={R,section,note,insights,mistakeCourse,compute,fmtEval,CLS};
// review finished games that haven't been analysed yet (e.g. from before this feature)
setTimeout(()=>{X.CCX.games().filter(g=>g.result!=='*'&&!g.review&&g.moves.length>=4).slice(0,5).forEach(g=>R.auto(g.id));},4000);
})();
