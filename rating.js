// Shatranj: Elo rating and in-app titles
(function(){
const $=id=>document.getElementById(id);
const X=window.CCLearn,LS=X.LS,esc=X.esc;
// same thresholds as FIDE uses for its titles; here they are the app's own achievements
const TITLES=[{k:'CM',name:'Candidate Master',min:2200,c:'#c9a227'},{k:'FM',name:'FIDE Master',min:2300,c:'#4f9fd6'},{k:'IM',name:'International Master',min:2400,c:'#b06fd8'},{k:'GM',name:'Grandmaster',min:2500,c:'#e0563b'}];
const store=()=>LS.get('ccc_rating',{start:1500,players:{}});
const save=st=>LS.set('ccc_rating',st);
function myName(){try{return (localStorage.getItem('ccc_yourname')||'').trim()||'You';}catch(e){return 'You';}}
function keyFor(name){const n=String(name||'').trim().toLowerCase();return (!n||n==='you'||n===myName().toLowerCase())?'me':n;}
function player(st,key,name){if(!st.players[key])st.players[key]={name:name||key,r:st.start,n:0,hist:[]};const p=st.players[key];if(key==='me')p.name=myName();else if(name)p.name=name;return p;}
const peakOf=(p,start)=>Math.max(start,...p.hist.map(h=>h.after));
function titleOf(peak){let t=null;for(const T of TITLES)if(peak>=T.min)t=T;return t;}
const K=p=>p.n<30?40:p.r<2400?20:10;
const expected=(a,b)=>1/(1+Math.pow(10,(b-a)/400));
function engineElo(g){if(g.engineElo)return g.engineElo;const s=g.white+' '+g.black;return s.includes('(full)')?3000:+((s.match(/~(\d+)/)||[0,1800])[1]);}
function badgeHtml(T,small){return T?`<span class="tbadge${small?' sm':''}" style="background:${T.c}" title="${T.name} (in-app title)">${T.k}</span>`:'';}

// rate a finished game once
function apply(id){
  const g=X.CCX.games().find(x=>x.id===id);
  if(!g||g.result==='*'||g.rated||g.type==='online')return null;
  if(!g.unrated&&g.uci.length<4)g.unrated='game too short';
  if(g.unrated){X.CCX.saveGame(g,true);return null;}
  const st=store(),S=g.result==='1-0'?1:g.result==='0-1'?0:0.5,ch={};
  const upd=(side,key,name,oppR,oppName,score)=>{const p=player(st,key,name),before=p.r,t0=titleOf(peakOf(p,st.start));
    const d=Math.round(K(p)*(score-expected(p.r,oppR)));p.r+=d;p.n++;
    p.hist.push({t:Date.now(),gid:g.id,before,after:p.r,opp:oppName,oppR,s:score});
    const t1=titleOf(peakOf(p,st.start));ch[side]={key,name:p.name,before,after:p.r,d,newTitle:t1&&(!t0||t1.min>t0.min)?t1.k:null};};
  if(g.type==='engine'){const side=g.human||1,opp=engineElo(g);upd(side,'me',myName(),opp,'Stockfish',side===1?S:1-S);}
  else{const kw=keyFor(g.white),kb=keyFor(g.black);
    if(kw===kb){g.unrated='same player on both sides';X.CCX.saveGame(g,true);return null;}
    const rw=player(st,kw,g.white).r,rb=player(st,kb,g.black).r;
    upd(1,kw,g.white,rb,g.black,S);upd(-1,kb,g.black,rw,g.white,1-S);}
  save(st);g.rated=ch;X.CCX.saveGame(g,true);
  document.dispatchEvent(new CustomEvent('ccrating',{detail:{gid:g.id,ch}}));
  celebrate(ch);refreshBadge();return ch;}
// undo a game's rating change (used when moves are taken back after the game ended)
function revertData(g){if(!g||!g.rated)return;const st=store();
  for(const side in g.rated){const c=g.rated[side],p=st.players[c.key];if(!p)continue;const i=p.hist.findIndex(h=>h.gid===g.id);if(i>=0){p.hist.splice(i,1);p.r-=c.d;p.n=Math.max(0,p.n-1);}}
  save(st);refreshBadge();}
function preview(elo){const st=store(),p=st.players.me||{r:st.start,n:0},e=expected(p.r,elo||3000),k=K(p);
  return {r:p.r,win:Math.round(k*(1-e)),draw:Math.round(k*(0.5-e)),loss:Math.round(k*(0-e))};}
function current(key){const st=store(),p=st.players[key||'me']||{r:st.start,n:0,hist:[],name:myName()};return {r:p.r,n:p.n,peak:peakOf(p,st.start),title:titleOf(peakOf(p,st.start)),name:p.name};}

// ---------- UI ----------
function toast(html){let t=$('rateToast');if(!t){t=document.createElement('div');t.id='rateToast';document.body.appendChild(t);}
  t.innerHTML=html;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),5000);}
function celebrate(ch){
  const parts=Object.values(ch).map(c=>`${esc(c.name)} ${c.before} → <b>${c.after}</b> <span style="color:${c.d>=0?'#5fbf7a':'#e06c5f'}">(${c.d>=0?'+':''}${c.d})</span>`);
  toast('🏆 '+parts.join('<br>'));
  const nt=Object.values(ch).find(c=>c.newTitle);
  if(nt){const T=TITLES.find(x=>x.k===nt.newTitle);let m=$('titleModal');if(!m){m=document.createElement('div');m.id='titleModal';document.body.appendChild(m);}
    m.innerHTML=`<div class="tbox"><div style="font-size:56px">🎉</div><div class="tbig" style="background:${T.c}">${T.k}</div><h2 style="font-size:20px;color:var(--text);text-transform:none;letter-spacing:0">${esc(nt.name)} is now a ${T.name}!</h2><p class="muted">Rating ${nt.after}. You crossed ${T.min}. This in-app title is yours to keep.</p><button class="primary big" id="tmOk">Thanks!</button></div>`;
    m.classList.add('show');$('tmOk').onclick=()=>m.classList.remove('show');try{window.CCApp.speak(`Congratulations! ${nt.name} is now a ${T.name}.`);}catch(e){}}}
function refreshBadge(){const el=$('ratingBadge');if(!el)return;const c=current('me');el.innerHTML=`${badgeHtml(c.title,true)} ${esc(c.name)} · <b>${c.r}</b>`;}
function graph(hist,start){
  const pts=[start,...hist.map(h=>h.after)];if(pts.length<2)return '<p class="muted small">Play rated games to see your rating graph.</p>';
  const W=600,H=140,lo=Math.min(...pts,...TITLES.filter(t=>t.min<=Math.max(...pts)+80).map(t=>t.min))-30,hi=Math.max(...pts)+30,y=v=>H-(v-lo)/(hi-lo)*H,x=i=>i/(pts.length-1)*W;
  let lines='';TITLES.forEach(T=>{if(T.min>lo&&T.min<hi)lines+=`<line x1="0" x2="${W}" y1="${y(T.min)}" y2="${y(T.min)}" stroke="${T.c}" stroke-dasharray="5 5" opacity=".7"/><text x="4" y="${y(T.min)-3}" fill="${T.c}" font-size="12">${T.k} ${T.min}</text>`;});
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:150px;background:var(--field);border-radius:8px">${lines}<polyline points="${pts.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ')}" fill="none" stroke="#e2b450" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;}
function view(el){
  const st=store(),me=player(st,'me',myName()),peak=peakOf(me,st.start),T=titleOf(peak),next=TITLES.find(t=>t.min>peak);
  const w=me.hist.filter(h=>h.s===1).length,d=me.hist.filter(h=>h.s===0.5).length,l=me.hist.filter(h=>h.s===0).length;
  const prev=next?(TITLES[TITLES.indexOf(next)-1]||{min:Math.min(st.start,1000)}).min:0;
  const others=Object.entries(st.players).filter(([k])=>k!=='me').map(([k,p])=>p).sort((a,b)=>b.r-a.r);
  el.innerHTML=`<div class="card"><button id="rtBack">← All games</button><h2 style="margin-top:12px">🏆 My rating</h2>
    <div style="display:flex;align-items:center;gap:14px;margin:8px 0"><div style="font-size:46px;font-weight:800">${me.r}</div>
      <div>${T?`<div class="tbig sm" style="background:${T.c}">${T.k}</div><div><b>${T.name}</b></div>`:'<div class="muted">No title yet</div>'}<div class="small muted">Peak ${peak} · ${me.n} rated game${me.n===1?'':'s'} · ${w}W ${d}D ${l}L</div></div></div>
    ${next?`<div class="small">Next title: <b>${next.name} (${next.k})</b> at ${next.min}. ${next.min-me.r} points to go.</div><div class="pbar" style="margin:6px 0 10px"><div style="width:${Math.max(2,Math.min(100,Math.round((me.r-prev)/(next.min-prev)*100)))}%;background:${next.c}"></div></div>`:'<p>🏆 You hold the highest title. Keep the rating up!</p>'}
    ${graph(me.hist,st.start)}
    <div class="titles">${TITLES.map(t=>`<div class="${peak>=t.min?'got':''}">${badgeHtml(t)} <span>${t.name}</span><b>${t.min}</b>${peak>=t.min?' ✓':''}</div>`).join('')}</div>
    <p class="small muted">Games against the engine are rated against the engine level you chose (Full strength counts as 3000). Two-player games rate both named players. Games where you used <b>take-backs or hints</b>, or very short games, are unrated. Titles use FIDE’s rating thresholds and are kept once earned, but they are this app’s own titles, not official FIDE titles.</p>
    ${me.n===0?`<div class="row"><label>Starting rating <input id="rtStart" type="number" min="100" max="3000" value="${st.start}" style="width:90px;background:var(--field);color:var(--text);border:1px solid var(--line2);border-radius:8px;padding:7px"></label><button id="rtSave">Save</button></div><p class="small muted">Set this to your rating elsewhere (e.g. lichess or chess.com) before your first rated game.</p>`
      :`<div class="row"><button id="rtReset">Reset my rating</button></div>`}</div>
    ${me.hist.length?`<div class="card"><h2>Recent rated games</h2>${me.hist.slice(-12).reverse().map(h=>`<div class="list-item" data-g="${h.gid}"><div>${h.s===1?'✅ Win':h.s===0?'❌ Loss':'½ Draw'} vs ${esc(h.opp)} (${h.oppR})<div class="small muted">${new Date(h.t).toLocaleString()}</div></div><b style="color:${h.after>=h.before?'#5fbf7a':'#e06c5f'}">${h.after>=h.before?'+':''}${h.after-h.before} → ${h.after}</b></div>`).join('')}</div>`:''}
    ${others.length?`<div class="card"><h2>Two-player ratings</h2>${others.map(p=>{const t=titleOf(peakOf(p,st.start));return `<div class="list-item"><div>${badgeHtml(t,true)} <b>${esc(p.name)}</b><div class="small muted">${p.n} games</div></div><b>${p.r}</b></div>`;}).join('')}</div>`:''}`;
  $('rtBack').onclick=()=>X.Hist.list();
  el.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>X.Hist.open(x.dataset.g,0));
  if($('rtSave'))$('rtSave').onclick=()=>{const v=Math.max(100,Math.min(3000,Math.round(+$('rtStart').value||1500)));st.start=v;me.r=v;save(st);refreshBadge();view(el);};
  if($('rtReset'))$('rtReset').onclick=e=>{const b=e.target;if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Tap again: reset rating to '+st.start+' and clear rating history';return;}
    st.players.me={name:myName(),r:st.start,n:0,hist:[]};save(st);refreshBadge();view(el);};
  window.scrollTo({top:0});}

// header badge
const hb=document.createElement('button');hb.id='ratingBadge';hb.title='My rating';document.querySelector('header').appendChild(hb);
hb.onclick=()=>{X.show('hist');view($('viewHist'));};
refreshBadge();
window.CCRating={apply,revertData,preview,current,view,refreshBadge,keyFor,titleOf,TITLES,badgeHtml};
// rate finished games that were saved before this feature existed? No: only games finished from now on are rated.
})();
