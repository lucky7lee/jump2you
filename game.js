// ==========================================
// 낭떠러지 줄다리기 가위바위보 - 심플 버전
// 20초 결정 / 10초 결과 / 큰 화면 결과 + 음성
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  const DECIDE_MS = 20000;
  const RESULT_MS = 3000;

  const state = {
    pos: 0,            // -5 ~ +5 (내 땅 = 5 + pos)
    round: 1,
    wins: 0,
    losses: 0,
    playerBet: 1,
    phase: 'IDLE',     // IDLE | ACTIVE | RESULT | GAMEOVER
    history: []
  };

  const HAND_KEYS = ['scissors', 'rock', 'paper'];
  const HANDS = {
    scissors: { name: '가위', emoji: '✌️', beats: 'paper' },
    rock: { name: '바위', emoji: '✊', beats: 'scissors' },
    paper: { name: '보', emoji: '🖐️', beats: 'rock' }
  };
  const POWER = { 1: '약파워', 2: '중파워', 3: '강파워' };

  let shuffleId = null, countdownId = null, resultTimeoutId = null;
  let pIdx = 0, aIdx = 1;

  const $ = (id) => document.getElementById(id);
  const tilesEl = $('tiles-container');
  const playerUnit = $('player-unit');
  const aiUnit = $('ai-unit');
  const territoryEl = $('territory-score');
  const roundEl = $('round-num');
  const recordEl = $('win-record');
  const timerWrap = $('timer-wrap');
  const timerFill = $('timer-bar-fill');
  const timerSec = $('timer-seconds');
  const pZone = $('player-fighter-zone');
  const aZone = $('ai-fighter-zone');
  const pHand = $('player-hand-symbol');
  const aHand = $('ai-hand-symbol');
  const pPower = $('player-power-tag');
  const aPower = $('ai-power-tag');
  const overlay = $('result-overlay');
  const resultText = $('result-text');
  const resultSub = $('result-sub');
  const startBtn = $('btn-start-game');
  const panel = $('decision-panel');
  const powerBtns = document.querySelectorAll('.power-btn');
  const rpsBtns = document.querySelectorAll('.rps-btn');
  const container = $('game-container');

  // ---------- 음성 ----------
  function speak(text) {
    if (!window.soundEngine.enabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 1.05;
      u.pitch = 1.2;
      const ko = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('ko'));
      if (ko) u.voice = ko;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

  // ---------- 보드 ----------
  function initTiles() {
    tilesEl.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const t = document.createElement('div');
      t.className = 'tile';
      if (i === 1 || i === 10) t.classList.add('edge');
      t.dataset.i = i;
      t.textContent = i;
      tilesEl.appendChild(t);
    }
  }

  function updateBoard() {
    const mine = Math.max(0, Math.min(10, 5 + state.pos));
    territoryEl.textContent = `🔴${mine} : ${10 - mine}🔵`;

    tilesEl.querySelectorAll('.tile').forEach(t => {
      const i = +t.dataset.i;
      t.classList.toggle('mine', i <= mine);
      t.classList.toggle('theirs', i > mine);
    });

    const boundary = (mine / 10) * 100;
    playerUnit.style.left = `${Math.max(3, boundary - 5)}%`;
    aiUnit.style.left = `${Math.min(97, boundary + 5)}%`;
  }

  function setPlayerPower(p) {
    state.playerBet = p;
    pPower.textContent = POWER[p];
    pPower.className = `power-chip p${p}`;
    powerBtns.forEach(b => b.classList.toggle('selected', +b.dataset.bet === p));
  }

  // ---------- AI ----------
  function aiDecide() {
    const cur = state.pos;
    const recent = state.history.slice(-3).map(h => h.pBet);
    const heavy = recent.filter(b => b === 3).length >= 2;
    let bet;
    if (cur >= 3) bet = Math.random() < 0.6 ? 3 : 1;
    else if (cur <= -3) bet = Math.random() < 0.55 ? 3 : 2;
    else if (heavy) bet = Math.random() < 0.65 ? 1 : 2;
    else { const r = Math.random(); bet = r < 0.3 ? 1 : r < 0.75 ? 2 : 3; }

    let hand = HAND_KEYS[Math.floor(Math.random() * 3)];
    const last = state.history[state.history.length - 1];
    if (last && last.result === 'win' && Math.random() < 0.5) {
      hand = HAND_KEYS.find(k => HANDS[k].beats === last.pHand);
    }
    return { bet, hand };
  }

  function judge(p, a) {
    if (p === a) return 'draw';
    return HANDS[p].beats === a ? 'win' : 'lose';
  }

  // ---------- 라운드 ----------
  function startRound() {
    state.phase = 'ACTIVE';
    startBtn.classList.add('hidden');
    panel.classList.remove('hidden', 'locked');
    overlay.classList.add('hidden');
    pZone.classList.remove('win', 'lose');
    aZone.classList.remove('win', 'lose');
    aPower.textContent = '?'; aPower.className = 'power-chip';

    pHand.classList.add('shuffling');
    aHand.classList.add('shuffling');
    window.soundEngine.playRPSVoiceMelody();

    clearInterval(shuffleId);
    let tick = 0;
    shuffleId = setInterval(() => {
      pIdx = (pIdx + 1) % 3;
      aIdx = (aIdx + 1) % 3;
      pHand.textContent = HANDS[HAND_KEYS[pIdx]].emoji;
      aHand.textContent = HANDS[HAND_KEYS[aIdx]].emoji;
      if (++tick % 2 === 0) window.soundEngine.playShuffleTick();
    }, 70);

    // 20초 타이머 (결정 시간에만 표시)
    timerWrap.classList.remove('invisible');
    timerFill.classList.remove('urgent');
    let left = DECIDE_MS;
    timerFill.style.width = '100%';
    timerSec.textContent = '20';

    clearInterval(countdownId);
    countdownId = setInterval(() => {
      left -= 100;
      timerSec.textContent = Math.ceil(Math.max(0, left) / 1000);
      timerFill.style.width = `${Math.max(0, left / DECIDE_MS * 100)}%`;
      if (left <= 5000) {
        timerFill.classList.add('urgent');
        if (left % 1000 === 0) window.soundEngine.playTimerTick(true);
      }
      if (left <= 0) {
        clearInterval(countdownId);
        resolve(HAND_KEYS[pIdx]);
      }
    }, 100);
  }

  function resolve(playerHand) {
    if (state.phase !== 'ACTIVE') return;
    state.phase = 'RESULT';
    clearInterval(shuffleId);
    clearInterval(countdownId);

    timerWrap.classList.add('invisible');
    panel.classList.add('locked');
    pHand.classList.remove('shuffling');
    aHand.classList.remove('shuffling');

    const ai = aiDecide();
    const pBet = state.playerBet;
    pHand.textContent = HANDS[playerHand].emoji;
    aHand.textContent = HANDS[ai.hand].emoji;
    aPower.textContent = POWER[ai.bet];
    aPower.className = `power-chip p${ai.bet}`;

    const rps = judge(playerHand, ai.hand);
    let delta = 0;

    if (rps === 'win') delta = pBet;
    else if (rps === 'lose') delta = -ai.bet;
    else if (pBet < ai.bet) delta = ai.bet - pBet;      // 무승부 카운터
    else if (pBet > ai.bet) delta = -(pBet - ai.bet);   // 헛스윙 후딜레이

    // 결과 문구: 가위바위보 결과 그대로 + 내 칸 이동 정보만
    const outcome = rps;
    const label = { win: '이겼다!', lose: '졌다!', draw: '비겼다!' }[outcome];
    const sub = delta > 0 ? `${delta}칸 전진` : delta < 0 ? `${-delta}칸 후퇴` : '이동 없음';

    resultText.textContent = label;
    resultText.className = `result-text ${outcome}`;
    resultSub.textContent = sub;
    overlay.classList.remove('hidden');

    if (delta > 0) { pZone.classList.add('win'); aZone.classList.add('lose'); }
    if (delta < 0) { aZone.classList.add('win'); pZone.classList.add('lose'); }

    window.soundEngine.playRevealImpact();
    if (rps === 'draw' && delta !== 0) window.soundEngine.playCounter();
    else if (delta !== 0) window.soundEngine.playHit(Math.abs(delta));
    else window.soundEngine.playEqualDraw();
    if (Math.abs(delta) >= 2) shake();
    setTimeout(() => speak(label.replace('!', '')), 250);

    state.history.push({ pHand: playerHand, pBet, result: rps });
    state.pos += delta;
    updateBoard();

    // 결과 10초 후 자동 진행 (메시지/시간 표시 없음)
    clearTimeout(resultTimeoutId);
    resultTimeoutId = setTimeout(nextOrEnd, RESULT_MS);
  }

  function nextOrEnd() {
    if (state.pos >= 5 || state.pos <= -5) {
      const victory = state.pos >= 5;
      state.phase = 'GAMEOVER';
      (victory ? aiUnit : playerUnit).classList.add('falling');
      window.soundEngine.playFall();
      setTimeout(() => {
        if (victory) { state.wins++; window.soundEngine.playVictory(); }
        else { state.losses++; window.soundEngine.playDefeat(); }
        recordEl.textContent = `${state.wins}승 ${state.losses}패`;
        $('modal-trophy').textContent = victory ? '🏆' : '💀';
        $('modal-title').textContent = victory ? '최종 승리!' : '최종 패배';
        $('modal-title').style.color = victory ? '#ffd600' : '#ff5252';
        $('modal-desc').textContent = `${state.round} 라운드 만에 ${victory ? '상대를 떨어뜨렸습니다!' : '절벽으로 떨어졌습니다.'}`;
        $('gameover-modal').classList.remove('hidden');
        speak(victory ? '최종 승리' : '최종 패배');
      }, 900);
      return;
    }
    state.round++;
    roundEl.textContent = state.round;
    startRound();
  }

  function shake() {
    container.classList.add('screen-shake');
    setTimeout(() => container.classList.remove('screen-shake'), 380);
  }

  function resetAll() {
    clearInterval(shuffleId);
    clearInterval(countdownId);
    clearTimeout(resultTimeoutId);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    Object.assign(state, { pos: 0, round: 1, phase: 'IDLE', history: [] });
    roundEl.textContent = 1;
    playerUnit.className = 'char';
    aiUnit.className = 'char';
    $('gameover-modal').classList.add('hidden');
    overlay.classList.add('hidden');
    panel.classList.add('hidden');
    startBtn.classList.remove('hidden');
    timerWrap.classList.add('invisible');
    pZone.classList.remove('win', 'lose');
    aZone.classList.remove('win', 'lose');
    pHand.classList.remove('shuffling');
    aHand.classList.remove('shuffling');
    pHand.textContent = '✊';
    aHand.textContent = '✌️';
    aPower.textContent = '?'; aPower.className = 'power-chip';
    setPlayerPower(1);
    updateBoard();
  }

  // ---------- 이벤트 ----------
  startBtn.addEventListener('click', () => {
    window.soundEngine.init();
    speak('');
    startRound();
  });
  powerBtns.forEach(b => b.addEventListener('click', () => {
    if (state.phase !== 'ACTIVE') return;
    window.soundEngine.playBetSelect();
    setPlayerPower(+b.dataset.bet);
  }));
  rpsBtns.forEach(b => b.addEventListener('click', () => {
    if (state.phase !== 'ACTIVE') return;
    window.soundEngine.playLockIn();
    resolve(b.dataset.hand);
  }));
  $('btn-play-again').addEventListener('click', resetAll);
  $('btn-reset-game').addEventListener('click', () => {
    if (confirm('새 게임을 시작할까요?')) resetAll();
  });
  $('btn-sound-toggle').addEventListener('click', (e) => {
    e.currentTarget.textContent = window.soundEngine.toggle() ? '🔊' : '🔇';
  });
  $('btn-rules-open').addEventListener('click', () => $('rules-modal').classList.remove('hidden'));
  $('btn-close-rules').addEventListener('click', () => $('rules-modal').classList.add('hidden'));

  initTiles();
  resetAll();
});
