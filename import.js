// Shatranj: import games from Lichess, chess.com or any PGN, then review them
(function(){
const $=id=>document.getElementById(id);
const A=window.CCApp,X=window.CCLearn,LS=X.LS,esc=X.esc;

// ---------- PGN reading ----------
function splitPGN(text){
  const games=[];let cur=null,inMoves=false;
  for(const raw of String(text).replace(/\r/g,'').split('\n')){const line=raw.trim();
    if(line.startsWith('[')&&/^\[\w+\s+".*"\]$/.test(line)){if(!cur||inMoves){cur={h:{},mt:''};games.push(cur);inMoves=false;}
      const m=line.match(/^\[(\w+)\s+"(.*)"\]$/);cur.h[m[1]]=m[2].replace(/\\"/g,'"');}
    else if(line){if(!cur){cur={h:{},mt:''};games.push(cur);}inMoves=true;cur.mt+=' '+line;}}
  return games.filter(g=>g.mt.trim());}
function tokens(mt){
  const re=/\{([^}]*)\}|;[^\n]*|\(|\)|\$\d+|\d+\.(?:\.\.)?|\.\.\.|(1-0|0-1|1\/2-1\/2|\*)(?=\s|$)|([^\s{}()$;]+)/g;
  const sans=[],clk=[];let m,depth=0;
  while((m=re.exec(mt))){const t=m[0];
    if(t==='('){depth++;continue;}if(t===')'){depth=Math.max(0,depth-1);continue;}if(depth)continue;
    if(m[1]!==undefined){const c=m[1].match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);if(c&&sans.length)clk[sans.length-1]=Math.round((+c[1]*3600+ +c[2]*60+ +c[3])*1000);continue;}
    if(t[0]===';'||t[0]==='$'||/^\d+\.(\.\.)?$/.test(t)||t==='...'||m[2])continue;
    const san=(m[3]||'').replace(/^\d+\.+/,'');if(san)sans.push(san);}
  return {sans,clk};}
const FILES='abcdefgh';
function sanToMove(pos,san){
  let t=san.replace(/[!?]+$/,'').replace(/[+#]+$/,'').replace(/^0-0-0/,'O-O-O').replace(/^0-0/,'O-O');
  const L=legal(pos);
  if(t==='O-O'||t==='O-O-O')return L.find(m=>(m.fl&F_CASTLE)&&((m.t&7)===6)===(t==='O-O'))||null;
  const ex=L.find(m=>A.san(pos,m).replace(/[+#]$/,'')===t);if(ex)return ex;
  const r=t.match(/^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQ]))?$/);if(!r)return null;
  const pt=r[1]?' PNBRQK'.indexOf(r[1]):1,to=(r[4].charCodeAt(0)-97)+(+r[4][1]-1)*8,pr=r[5]?' PNBRQ'.indexOf(r[5]):0;
  const c=L.filter(m=>m.pt===pt&&m.t===to&&(!r[2]||(m.f&7)===r[2].charCodeAt(0)-97)&&(!r[3]||(m.f>>3)===+r[3]-1)&&(m.p||0)===(m.p?(pr||5):0));
  return c.length===1?c[0]:null;}
function tcOf(h){const v=h.TimeControl||'';const m=v.match(/^(\d+)(?:\+(\d+))?$/);if(!m)return null;const base=+m[1],inc=+(m[2]||0);
  return {label:`${+(base/60).toFixed(2)}+${inc}`,base:base*1000,inc:inc*1000};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
// returns {game} or {skip:reason}
function toGame(pg,source,me){
  const h=pg.h;
  if(h.FEN||h.SetUp==='1')return {skip:'starts from a custom position'};
  if(h.Variant&&!/^standard$/i.test(h.Variant))return {skip:h.Variant+' variant'};
  const {sans,clk}=tokens(pg.mt);if(!sans.length)return {skip:'no moves'};
  const pos=startPos(),uci=[],moves=[];
  for(const s of sans){const m=sanToMove(pos,s);if(!m)return {skip:`couldn’t read move “${s}”`};moves.push(A.san(pos,m));uci.push(X.uciOf(m));make(pos,m);}
  const tc=tcOf(h),ms=[];
  if(tc)for(let k=0;k<uci.length;k++){if(clk[k]==null){ms.push(null);continue;}const prev=k>=2?clk[k-2]:tc.base;ms.push(prev!=null?Math.max(0,prev-clk[k]+tc.inc):null);}
  const url=h.Link||(/^https?:/.test(h.Site||'')?h.Site:'');
  let id;const lm=url.match(/lichess\.org\/(\w{8})/),cm=url.match(/chess\.com\/game\/(?:live|daily)\/(\d+)/);
  if(lm)id='li-'+lm[1];else if(cm)id='cc-'+cm[1];else id='pgn-'+hashStr((h.White||'')+(h.Black||'')+(h.Date||'')+uci.join(''));
  const ds=(h.UTCDate||h.Date||'').replace(/\./g,'-'),tm=h.UTCTime||h.StartTime||'12:00:00';
  let date=/^\d{4}-\d\d-\d\d$/.test(ds)?new Date(ds+'T'+tm+(h.UTCTime?'Z':'')).toISOString():new Date().toISOString();
  const names=(me||[]).map(x=>String(x).toLowerCase()).filter(Boolean);
  const human=names.includes(String(h.White||'').toLowerCase())?1:names.includes(String(h.Black||'').toLowerCase())?-1:null;
  const res=['1-0','0-1','1/2-1/2'].includes(h.Result)?h.Result:'*';
  return {game:{id,type:'online',source,date,white:h.White||'White',black:h.Black||'Black',whiteElo:+h.WhiteElo||null,blackElo:+h.BlackElo||null,
    result:res,why:h.Termination||undefined,moves,uci,ms:ms.length?ms:undefined,tc:tc?tc.label:null,url,human,event:h.Event||''}};}

// ---------- fetching ----------
async function fetchLichess(user){
  const r=await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=30&moves=true&clocks=true&tags=true&opening=false&evals=false&literate=false`,{headers:{Accept:'application/x-chess-pgn'}});
  if(r.status===404)throw new Error('No Lichess player called “'+user+'”.');if(!r.ok)throw new Error('Lichess answered with an error ('+r.status+').');
  return splitPGN(await r.text());}
async function fetchChessCom(user){
  const u=encodeURIComponent(user.toLowerCase());
  const r=await fetch(`https://api.chess.com/pub/player/${u}/games/archives`);
  if(r.status===404)throw new Error('No chess.com player called “'+user+'”.');if(!r.ok)throw new Error('chess.com answered with an error ('+r.status+').');
  const arch=((await r.json()).archives||[]).slice(-2).reverse();let games=[];
  for(const a of arch){if(games.length>=30)break;const m=await fetch(a);if(!m.ok)continue;const js=await m.json();
    games=games.concat((js.games||[]).filter(g=>g.rules==='chess'&&g.pgn).sort((x,y)=>(y.end_time||0)-(x.end_time||0)));}
  return games.slice(0,30).map(g=>splitPGN(g.pgn)[0]).filter(Boolean);}

// ---------- UI ----------
function myNames(){const c=LS.get('ccc_accounts',{});return [c.lichess,c.chesscom,(()=>{try{return localStorage.getItem('ccc_yourname')||'';}catch(e){return '';}})()].filter(Boolean);}
let found=[];
function view(el,msg){
  const acc=LS.get('ccc_accounts',{lichess:'',chesscom:''}),have=new Set(X.CCX.games().map(g=>g.id));
  el.innerHTML=`<div class="card"><button id="imBack">← All games</button><h2 style="margin-top:12px">🔗 Import & review your online games</h2>
    <p class="small muted">Enter your usernames. Only your public games are read: no password, nothing is posted. Imported games are reviewed automatically and count towards <b>My patterns</b> (not towards your rating in this app).</p>
    <label style="display:block;margin:10px 0 4px">♞ Lichess username</label>
    <div class="row" style="margin:0"><input class="txt" id="imLi" value="${esc(acc.lichess||'')}" placeholder="e.g. DrNykterstein" style="flex:1"><button id="imLiGo" class="primary">Fetch games</button></div>
    <label style="display:block;margin:12px 0 4px">♟ chess.com username</label>
    <div class="row" style="margin:0"><input class="txt" id="imCc" value="${esc(acc.chesscom||'')}" placeholder="e.g. hikaru" style="flex:1"><button id="imCcGo" class="primary">Fetch games</button></div>
    <details style="margin-top:12px"><summary>📋 Paste PGN instead (from any site)</summary>
      <textarea id="imPgn" class="txt" rows="6" placeholder="[Event &quot;...&quot;] 1. e4 e5 2. Nf3 …" style="margin-top:8px;font-family:ui-monospace,monospace;font-size:12.5px"></textarea>
      <div class="row"><button id="imPgnGo">Read PGN</button></div></details>
    <div class="fb ${msg&&msg.bad?'bad':'good'}" id="imMsg">${msg?msg.text:''}</div></div>
    ${found.length?`<div class="card"><h2>Recent games found (${found.length})</h2>
      <div class="row" style="margin:0 0 8px;justify-content:space-between"><label style="color:var(--text)"><input type="checkbox" id="imAll" checked> Select all new</label><button class="primary" id="imGo">Import & review selected</button></div>
      ${found.map((f,i)=>{const g=f.game,dup=have.has(g.id),meSide=g.human,res=g.result==='1/2-1/2'?'½–½':g.result,won=meSide&&((g.result==='1-0'&&meSide===1)||(g.result==='0-1'&&meSide===-1));
        return `<label class="list-item" style="cursor:pointer;${dup?'opacity:.5':''}"><input type="checkbox" data-i="${i}" ${dup?'disabled':'checked'} style="width:20px;height:20px;flex:none">
        <div style="flex:1"><b>${esc(g.white)}</b>${g.whiteElo?' ('+g.whiteElo+')':''} vs <b>${esc(g.black)}</b>${g.blackElo?' ('+g.blackElo+')':''}
        <div class="small muted">${new Date(g.date).toLocaleDateString()} · ${esc(g.source)}${g.tc?' · ⏱ '+esc(g.tc):''} · ${g.moves.length} moves${dup?' · already imported':''}</div></div>
        <span class="pill ${won?'done':''}">${res}</span></label>`;}).join('')}</div>`:''}`;
  $('imBack').onclick=()=>{found=[];X.Hist.list();};
  const run=async(site,user)=>{user=user.trim();if(!user){view(el,{bad:1,text:'Please enter a username.'});return;}
    const a=LS.get('ccc_accounts',{});a[site==='lichess'?'lichess':'chesscom']=user;LS.set('ccc_accounts',a);
    $('imMsg').className='fb';$('imMsg').textContent='Fetching games…';
    try{const pgs=site==='lichess'?await fetchLichess(user):await fetchChessCom(user);read(pgs,site==='lichess'?'Lichess':'chess.com',el);}
    catch(e){view(el,{bad:1,text:(e&&e.message&&!/Failed to fetch|NetworkError|Load failed/i.test(e.message)?e.message:`Couldn’t reach ${site==='lichess'?'lichess.org':'chess.com'}. Check your internet connection and the username. You can also paste PGN below.`)});}};
  $('imLiGo').onclick=()=>run('lichess',$('imLi').value);
  $('imCcGo').onclick=()=>run('chesscom',$('imCc').value);
  $('imPgnGo').onclick=()=>read(splitPGN($('imPgn').value),'PGN',el);
  if(found.length){
    $('imAll').onchange=e=>el.querySelectorAll('[data-i]:not(:disabled)').forEach(c=>c.checked=e.target.checked);
    $('imGo').onclick=()=>{const pick=[...el.querySelectorAll('[data-i]:checked')].map(c=>found[+c.dataset.i].game);
      if(!pick.length){$('imMsg').textContent='Select at least one game.';return;}
      pick.slice().reverse().forEach(g=>X.CCX.saveGame(g));
      found=[];view(el,{text:`✅ Imported ${pick.length} game${pick.length>1?'s':''}. They are being reviewed now (about 10–30 seconds each). Open them in History.`});};}
  window.scrollTo({top:0});}
function read(pgs,source,el){
  const out=[],skipped=[];
  for(const pg of pgs){const r=toGame(pg,source,myNames());if(r.game)out.push(r);else skipped.push(r.skip);}
  found=out;
  view(el,out.length?{text:`Found ${out.length} game${out.length>1?'s':''}${skipped.length?` (${skipped.length} skipped: ${[...new Set(skipped)].slice(0,2).join(', ')})`:''}. Pick the ones to review.`}:{bad:1,text:pgs.length?'No standard games could be read ('+[...new Set(skipped)].slice(0,2).join(', ')+').':'No games found.'});}

window.CCImport={view,splitPGN,tokens,sanToMove,toGame};
})();
