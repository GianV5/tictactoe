// --- Game State ---
const boardEl = document.getElementById('board');
const turnText = document.getElementById('turnText');
const sx = document.getElementById('sx');
const so = document.getElementById('so');
const sd = document.getElementById('sd');
const toast = document.getElementById('toast');
const confetti = document.getElementById('confetti');
const winlineSvg = document.getElementById('winlineSvg');

const newGameBtn = document.getElementById('newGameBtn');
const resetBtn = document.getElementById('resetBtn');
const undoBtn = document.getElementById('undoBtn');
const modePvpBtn = document.getElementById('modePvp');
const modeCpuBtn = document.getElementById('modeCpu');
const swapBtn = document.getElementById('swapBtn');

const cells = Array.from({length:9}, (_,i)=>({ i, mark:'' }));
let history = []; // stack of moves for undo
let scores = { X:0, O:0, D:0 };
let first = 'X';
let current = first;
let mode = 'pvp'; // 'pvp' | 'cpu'
let locked = false; // lock input when animating / CPU thinking

const wins = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6]          // diags
];

// Build board cells
function buildBoard(){
  boardEl.innerHTML = '';
  for(let i=0;i<9;i++){
    const btn = document.createElement('button');
    btn.className = 'cell';
    btn.role = 'gridcell';
    btn.setAttribute('data-i', i);
    btn.setAttribute('aria-label', `Cell ${i+1}`);
    btn.addEventListener('click', ()=> handleMove(i));
    btn.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); handleMove(i);} });
    boardEl.appendChild(btn);
  }
}

function setTurn(t){
  current = t; turnText.textContent = `${t} to move`;
  turnText.classList.remove('glow');
  void turnText.offsetWidth; // restart animation
  turnText.classList.add('glow');
}

function render(){
  // apply marks
  boardEl.querySelectorAll('.cell').forEach((cellEl, idx)=>{
    const m = cells[idx].mark;
    cellEl.innerHTML = m ? `<span class="mark ${m.toLowerCase()}">${m}</span>` : '';
    cellEl.classList.toggle('disabled', Boolean(m) || locked);
  });
  sx.textContent = scores.X; so.textContent = scores.O; sd.textContent = scores.D;
}

function toastMsg(msg){
  toast.textContent = msg; toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1600);
}

function clearBoard(){ cells.forEach(c=> c.mark=''); history = []; hideWinLine(); locked=false; render(); }

function newRound(){ clearBoard(); first = first==='X' ? 'O' : 'X'; setTurn(first); maybeCpuMove(); }

function resetAll(){ scores={X:0,O:0,D:0}; first='X'; setTurn(first); clearBoard(); render(); toastMsg('Scores reset ✨'); }

function swapFirst(){ first = first==='X' ? 'O' : 'X'; setTurn(first); clearBoard(); toastMsg(`${first} starts now`); maybeCpuMove(); }

function handleMove(i){
  if(locked) return;
  if(cells[i].mark) return; // already used
  cells[i].mark = current;
  history.push(i);
  render();
  const outcome = checkOutcome();
  if(outcome) return conclude(outcome);
  setTurn(current==='X' ? 'O' : 'X');
  maybeCpuMove();
}

function undo(){
  if(mode !== 'pvp' || locked) return toastMsg('Undo only in 2 Players');
  const last = history.pop(); if(last==null) return;
  cells[last].mark='';
  setTurn(current==='X' ? 'O' : 'X');
  render();
}

function checkOutcome(){
  for(const [a,b,c] of wins){
    if(cells[a].mark && cells[a].mark===cells[b].mark && cells[a].mark===cells[c].mark){
      drawWinLine(a,b,c); return { type:'win', winner: cells[a].mark, line:[a,b,c] };
    }
  }
  if(cells.every(c=> c.mark)) return { type:'draw' };
  return null;
}

function conclude(result){
  locked = true;
  if(result.type==='win'){
    scores[result.winner]++;
    render();
    celebrate(`${result.winner} wins! 🎉`);
  } else {
    scores.D++; render(); toastMsg('Draw 🤝');
  }
  // Automatically reset the board after 2 seconds
  setTimeout(() => {
    clearBoard();
    setTurn(first);
    maybeCpuMove();
  }, 2000);
}

// --- CPU (unbeatable) ---
function maybeCpuMove(){
  if(mode!== 'cpu') return;
  if(current !== 'O') return; // CPU is O by default (second)
  locked = true;
  setTimeout(()=>{
    const best = findBestMove();
    cells[best].mark = 'O'; history.push(best);
    render();
    const out = checkOutcome();
    if(out) { conclude(out); }
    else { locked=false; setTurn('X'); }
  }, 380); // tiny delay for UX
}

function findBestMove(){
  let bestVal = -Infinity, bestIdx = -1;
  for(let i=0;i<9;i++) if(!cells[i].mark){
    cells[i].mark = 'O';
    const moveVal = minimax(false, -Infinity, Infinity);
    cells[i].mark = '';
    if(moveVal>bestVal){ bestVal=moveVal; bestIdx=i; }
  }
  return bestIdx;
}

function minimax(isMax, alpha, beta){
  const res = checkOutcome();
  if(res){
    if(res.type==='win') return res.winner==='O' ? 10 : -10;
    return 0;
  }
  if(isMax){ // O's turn
    let best = -Infinity;
    for(let i=0;i<9;i++) if(!cells[i].mark){
      cells[i].mark = 'O';
      best = Math.max(best, minimax(false, alpha, beta));
      cells[i].mark='';
      alpha = Math.max(alpha, best);
      if(beta <= alpha) break;
    }
    return best;
  } else { // X's turn
    let best = Infinity;
    for(let i=0;i<9;i++) if(!cells[i].mark){
      cells[i].mark = 'X';
      best = Math.min(best, minimax(true, alpha, beta));
      cells[i].mark='';
      beta = Math.min(beta, best);
      if(beta <= alpha) break;
    }
    return best;
  }
}

// --- Win line ---
function drawWinLine(a,b,c){
  const map = {
    '0,1,2':[ [10,16], [90,16] ],
    '3,4,5':[ [10,50], [90,50] ],
    '6,7,8':[ [10,84], [90,84] ],
    '0,3,6':[ [16,10], [16,90] ],
    '1,4,7':[ [50,10], [50,90] ],
    '2,5,8':[ [84,10], [84,90] ],
    '0,4,8':[ [10,10], [90,90] ],
    '2,4,6':[ [90,10], [10,90] ]
  };
  const k = `${a},${b},${c}`;
  const [[x1,y1],[x2,y2]] = map[k];
  const line = winlineSvg.querySelector('line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x1); line.setAttribute('y2', y1);
  boardEl.classList.add('win');
  // animate
  requestAnimationFrame(()=>{
    setTimeout(()=>{ line.setAttribute('x2', x2); line.setAttribute('y2', y2); }, 20);
  });
}
function hideWinLine(){
  const line = winlineSvg.querySelector('line');
  line.setAttribute('x1', 0); line.setAttribute('y1', 0);
  line.setAttribute('x2', 0); line.setAttribute('y2', 0);
  boardEl.classList.remove('win');
}

// --- Confetti celebration ---
function celebrate(msg){
  toastMsg(msg);
  // simple confetti burst
  confetti.innerHTML = '';
  const W = window.innerWidth, H = window.innerHeight;
  for(let i=0;i<80;i++){
    const p = document.createElement('div'); p.className='p';
    p.style.left = (Math.random()*W) + 'px';
    p.style.top = '-20px';
    p.style.background = `hsl(${Math.random()*360}, 80%, 60%)`;
    const dur = 1200 + Math.random()*1200;
    const tx = (Math.random()*2-1)*120;
    p.animate([
      { transform:`translate(0,0) rotate(0deg)`, opacity:1 },
      { transform:`translate(${tx}px, ${H+60}px) rotate(${Math.random()*720-360}deg)`, opacity:.9 }
    ],{ duration: dur, easing:'cubic-bezier(.2,.7,.1,1)', fill:'forwards' });
    confetti.appendChild(p);
  }
}

// --- Keyboard shortcuts (1..9) ---
window.addEventListener('keydown', (e)=>{
  if(e.key>='1' && e.key<='9'){
    const i = parseInt(e.key,10)-1; handleMove(i);
  }
  if(e.key==='r'){ newRound(); }
  if(e.key==='u'){ undo(); }
});

// --- Wire controls ---
newGameBtn.addEventListener('click', newRound);
resetBtn.addEventListener('click', resetAll);
undoBtn.addEventListener('click', undo);

modePvpBtn.addEventListener('click', ()=>{ mode='pvp'; modePvpBtn.setAttribute('aria-pressed','true'); modeCpuBtn.setAttribute('aria-pressed','false'); undoBtn.disabled=false; clearBoard(); setTurn(first); toastMsg('2 Players mode'); });
modeCpuBtn.addEventListener('click', ()=>{ mode='cpu'; modePvpBtn.setAttribute('aria-pressed','false'); modeCpuBtn.setAttribute('aria-pressed','true'); undoBtn.disabled=true; clearBoard(); setTurn(first); toastMsg('Vs CPU mode'); maybeCpuMove(); });
swapBtn.addEventListener('click', swapFirst);

// --- Init ---
buildBoard();
setTurn(current);
render();