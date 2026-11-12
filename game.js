// ========================================================
// 낭떠러지 줄다리기 가위바위보 - Full Edition Engine
// 싱글 10단계 (3판 2승) + 멀티플레이 대기실 + 칭호/마크 + 필살기
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // --- 상수 설정 ---
  const DECIDE_MS = 15000;  // 15초 선택 시간
  const RESULT_MS = 5000;   // 5초 결과 확인 시간

  const HAND_KEYS = ['scissors', 'rock', 'paper'];
  const HANDS = {
    scissors: { name: '가위', emoji: '✌️', beats: 'paper' },
    rock: { name: '바위', emoji: '✊', beats: 'scissors' },
    paper: { name: '보', emoji: '🖐️', beats: 'rock' }
  };

  const POWER_NAMES = {
    1: '약파워',
    2: '중파워',
    3: '강파워',
    4: '⚡필살기'
  };

  // 싱글 10단계 AI 캐릭터 정보
  const SINGLE_STAGES = [
    { stage: 1, name: '초보 다람쥐', emoji: '🐿️', desc: '단순하고 귀여움' },
    { stage: 2, name: '골목길 대장', emoji: '😼', desc: '성격이 급함' },
    { stage: 3, name: '바위산 수련생', emoji: '🪨', desc: '⭐ 별 1개 관문!' },
    { stage: 4, name: '질풍의 권사', emoji: '🌪️', desc: '연속 공격 특화' },
    { stage: 5, name: '강철 골렘', emoji: '🛡️', desc: '⭐⭐ 별 2개 관문!' },
    { stage: 6, name: '그림자 닌자', emoji: '🥷', desc: '카운터 심리전 구사' },
    { stage: 7, name: '심리전의 마왕', emoji: '😈', desc: '패턴을 꿰뚫어 봄' },
    { stage: 8, name: '절벽의 수호신', emoji: '⚡', desc: '⭐⭐⭐ 별 3개 관문!' },
    { stage: 9, name: '패왕 드래곤', emoji: '🐲', desc: '압도적인 파워' },
    { stage: 10, name: '가위바위보 황제', emoji: '👑', desc: '💎 달인 등극 최종 보스!' }
  ];

  // --- 사용자 영구 데이터 (localStorage) ---
  const USER_KEY = 'jump2you_user_profile_v2';
  let userProfile = loadUserProfile();

  function loadUserProfile() {
    try {
      const data = JSON.parse(localStorage.getItem(USER_KEY));
      if (data && typeof data === 'object') {
        return {
          nickname: data.nickname || '',
          highestStage: data.highestStage || 1,
          masterTitle: !!data.masterTitle
        };
      }
    } catch (e) { /* ignore */ }
    return { nickname: '', highestStage: 1, masterTitle: false };
  }

  function saveUserProfile() {
    localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
    updateMainBadgeUI();
  }

  // 칭호 마크 계산 (⭐, ⭐⭐, ⭐⭐⭐, 💎)
  function getBadgeMark(highest, isMaster) {
    if (isMaster || highest >= 10) return '💎';
    if (highest >= 8) return '⭐⭐⭐';
    if (highest >= 5) return '⭐⭐';
    if (highest >= 3) return '⭐';
    return '';
  }

  function getTierText(highest, isMaster) {
    if (isMaster || highest >= 10) return '가위바위보 달인 💎';
    if (highest >= 8) return '절벽의 정복자 ⭐⭐⭐';
    if (highest >= 5) return '강철의 파이터 ⭐⭐';
    if (highest >= 3) return '바위산 수련생 ⭐';
    return '새내기 도전자';
  }

  // --- 게임 상태 관리 ---
  const state = {
    mode: 'SINGLE',       // 'SINGLE' | 'MULTI'
    currentStage: 1,      // 싱글 1~10단계
    pos: 0,               // -5 ~ +5 (내 땅 = 5 + pos)
    round: 1,             // 현재 세트 내 라운드

    // 3판 2승제 (Best of 3)
    setWinsPlayer: 0,
    setWinsOpponent: 0,
    setHistory: [],       // ['P', 'O', 'P']

    playerBet: 1,         // 1, 2, 3, 4
    aiBet: 1,
    phase: 'IDLE',        // IDLE | ACTIVE | RESULT | SET_OVER | MATCH_OVER

    // 필살기 추적용: 약파워(1) 연속 사용 횟수
    weakStreakPlayer: 0,
    weakStreakOpponent: 0,

    // 멀티플레이 관련
    isHost: false,
    roomId: null,
    opponentNickname: '',
    opponentBadge: '',
    multiReadyPlayer: false,
    multiReadyOpponent: false,
    multiChoices: { player: null, opponent: null }
  };

  // 타이머 & 인터벌 참조
  let shuffleId = null;
  let countdownId = null;
  let resultTimeoutId = null;
  let pIdx = 0, aIdx = 1;

  // --- DOM 캐싱 ---
  const $ = (id) => document.getElementById(id);

  // 화면들
  const screenMain = $('screen-main');
  const screenLobby = $('screen-lobby');
  const screenGame = $('screen-game');
  const screenWaiting = $('screen-waiting');

  // 메인 화면
  const inputNickname = $('input-nickname');
  const mainUserBadge = $('main-user-badge');
  const tierBadgeText = $('tier-badge-text');
  const btnModeSingle = $('btn-mode-single');
  const btnModeMulti = $('btn-mode-multi');
  const btnMainRules = $('btn-main-rules');

  // 대기실
  const btnLobbyBack = $('btn-lobby-back');
  const lobbyMyProfile = $('lobby-my-profile');
  const lobbyNetStatus = $('lobby-net-status');
  const btnOpenCreateRoom = $('btn-open-create-room');
  const btnRefreshRooms = $('btn-refresh-rooms');
  const roomListContainer = $('room-list-container');
  const emptyRoomMsg = $('empty-room-msg');

  // 대기방
  const waitRoomTitle = $('wait-room-title');
  const waitHostName = $('wait-host-name');
  const waitGuestName = $('wait-guest-name');
  const waitGuestAvatar = $('wait-guest-avatar');
  const waitGuestRole = $('wait-guest-role');
  const waitStatusMsg = $('wait-status-msg');
  const btnLeaveRoom = $('btn-leave-room');

  // 게임 화면
  const matchStageTitle = $('match-stage-title');
  const territoryEl = $('territory-score');
  const roundEl = $('round-num');
  const btnSoundToggle = $('btn-sound-toggle');
  const btnInGameExit = $('btn-in-game-exit');
  const tilesEl = $('tiles-container');
  const playerUnit = $('player-unit');
  const aiUnit = $('ai-unit');
  const timerWrap = $('timer-wrap');
  const timerFill = $('timer-bar-fill');
  const timerSec = $('timer-seconds');

  // 3판 2승제 상황판
  const bo3PLabel = $('bo3-p-label');
  const bo3ALabel = $('bo3-a-label');
  const bo3PDots = $('bo3-p-dots');
  const bo3ADots = $('bo3-a-dots');

  // 대결 아레나
  const pZone = $('player-fighter-zone');
  const aZone = $('ai-fighter-zone');
  const pHand = $('player-hand-symbol');
  const aHand = $('ai-hand-symbol');
  const pNameEl = $('player-fighter-name');
  const aNameEl = $('ai-fighter-name');
  const pPower = $('player-power-tag');
  const aPower = $('ai-power-tag');
  const overlay = $('result-overlay');
  const resultText = $('result-text');
  const resultSub = $('result-sub');

  // 하단 조작부
  const decisionPanel = $('decision-panel');
  const powerBtns = document.querySelectorAll('.power-btn');
  const btnSpecial = $('btn-special');
  const rpsBtns = document.querySelectorAll('.rps-btn');
  const gameContainer = $('game-container');

  // 모달들
  const modalCreateRoom = $('modal-create-room');
  const inputRoomTitle = $('input-room-title');
  const btnConfirmCreateRoom = $('btn-confirm-create-room');
  const btnCancelCreateRoom = $('btn-cancel-create-room');

  const gameoverModal = $('gameover-modal');
  const modalTrophy = $('modal-trophy');
  const modalTitle = $('modal-title');
  const modalDesc = $('modal-desc');
  const modalActionBtns = $('modal-action-btns');

  const rulesModal = $('rules-modal');
  const btnCloseRules = $('btn-close-rules');

  // ---------- 음성 합성 (TTS) ----------
  function speak(text) {
    if (!window.soundEngine.enabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 1.05;
      u.pitch = 1.15;
      const ko = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('ko'));
      if (ko) u.voice = ko;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();

  // ---------- 화면 전환 헬퍼 ----------
  function showScreen(screen) {
    [screenMain, screenLobby, screenGame].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
  }

  // ---------- 메인 닉네임 & 칭호 초기화 ----------
  function initMainScreen() {
    inputNickname.value = userProfile.nickname || '';
    updateMainBadgeUI();

    inputNickname.addEventListener('input', () => {
      userProfile.nickname = inputNickname.value.trim();
      saveUserProfile();
    });
  }

  function updateMainBadgeUI() {
    const badge = getBadgeMark(userProfile.highestStage, userProfile.masterTitle);
    mainUserBadge.textContent = badge;
    tierBadgeText.textContent = getTierText(userProfile.highestStage, userProfile.masterTitle);
  }

  function validateNickname() {
    const nick = inputNickname.value.trim();
    if (!nick) {
      alert('닉네임을 입력해 주세요!');
      inputNickname.focus();
      return false;
    }
    userProfile.nickname = nick;
    saveUserProfile();
    return true;
  }

  // ---------- 10칸 영토 보드 렌더링 ----------
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
    territoryEl.textContent = `🔴 ${mine} : ${10 - mine} 🔵`;

    tilesEl.querySelectorAll('.tile').forEach(t => {
      const i = +t.dataset.i;
      t.classList.toggle('mine', i <= mine);
      t.classList.toggle('theirs', i > mine);
    });

    const boundary = (mine / 10) * 100;
    playerUnit.style.left = `${Math.max(3, boundary - 5)}%`;
    aiUnit.style.left = `${Math.min(97, boundary + 5)}%`;
  }

  // ---------- 3판 2승제 UI 갱신 ----------
  function updateBo3UI() {
    const pNick = userProfile.nickname || '나';
    const pBadge = getBadgeMark(userProfile.highestStage, userProfile.masterTitle);
    bo3PLabel.textContent = `${pBadge} ${pNick} (${state.setWinsPlayer}승)`;

    let oppLabel = '상대';
    if (state.mode === 'SINGLE') {
      const stg = SINGLE_STAGES[state.currentStage - 1];
      oppLabel = `${stg.emoji} ${stg.name}`;
    } else {
      oppLabel = `${state.opponentBadge} ${state.opponentNickname || '상대'}`;
    }
    bo3ALabel.textContent = `${oppLabel} (${state.setWinsOpponent}승)`;

    // 도트 갱신 (1, 2, 3세트)
    const pDots = bo3PDots.querySelectorAll('.dot');
    const aDots = bo3ADots.querySelectorAll('.dot');

    pDots.forEach((d, idx) => {
      d.className = 'dot';
      d.textContent = '－';
      if (idx < state.setHistory.length) {
        if (state.setHistory[idx] === 'P') {
          d.classList.add('win');
          d.textContent = '⭕';
        } else {
          d.classList.add('lose');
          d.textContent = '❌';
        }
      }
    });

    aDots.forEach((d, idx) => {
      d.className = 'dot';
      d.textContent = '－';
      if (idx < state.setHistory.length) {
        if (state.setHistory[idx] === 'O') {
          d.classList.add('win');
          d.textContent = '⭕';
        } else {
          d.classList.add('lose');
          d.textContent = '❌';
        }
      }
    });
  }

  // ---------- 필살기 활성화 상태 점검 ----------
  function updateSpecialButton() {
    // 상대방이 약파워를 3회 이상 연속 사용 시 나에게 필살기 활성화!
    if (state.weakStreakOpponent >= 3) {
      if (btnSpecial.classList.contains('locked')) {
        window.soundEngine.playThunder();
        triggerScreenShake();
      }
      btnSpecial.classList.remove('locked');
      btnSpecial.classList.add('active');
      btnSpecial.title = '상대 3연속 약파워! ⚡필살기 4칸 사용 가능!';
    } else {
      btnSpecial.classList.add('locked');
      btnSpecial.classList.remove('active');
      btnSpecial.title = '상대 3연속 약파워 시 활성화';
      if (state.playerBet === 4) {
        setPlayerPower(1); // 만약 필살기가 잠기면 약파워로 전환
      }
    }
  }

  function setPlayerPower(p) {
    if (p === 4 && btnSpecial.classList.contains('locked')) {
      alert('상대방이 약파워를 3회 연속 사용할 때 필살기가 열립니다!');
      return;
    }
    state.playerBet = p;
    pPower.textContent = POWER_NAMES[p];
    pPower.className = `power-chip p${p}`;

    powerBtns.forEach(b => {
      b.classList.toggle('selected', +b.dataset.bet === p);
    });
  }

  // ---------- 싱글 AI 의사결정 ----------
  function getSingleAiDecision() {
    const stgNum = state.currentStage;
    let bet = 2;

    // 만약 플레이어가 약파워를 3회 이상 연속 사용했으면 AI가 필살기 사용!
    if (state.weakStreakPlayer >= 3 && Math.random() < 0.75) {
      bet = 4; // AI 필살기!
    } else {
      // 단계별 파워 성향
      if (stgNum <= 2) {
        bet = Math.random() < 0.6 ? 1 : 2;
      } else if (stgNum <= 5) {
        bet = Math.random() < 0.3 ? 1 : Math.random() < 0.7 ? 2 : 3;
      } else {
        // 고단계: 카운터 심리전
        if (state.pos >= 3) bet = Math.random() < 0.5 ? 3 : 1;
        else if (state.pos <= -3) bet = Math.random() < 0.6 ? 3 : 2;
        else bet = Math.random() < 0.25 ? 1 : Math.random() < 0.65 ? 2 : 3;
      }
    }

    let hand = HAND_KEYS[Math.floor(Math.random() * 3)];
    return { bet, hand };
  }

  function judgeRPS(pHand, aHand) {
    if (pHand === aHand) return 'draw';
    return HANDS[pHand].beats === aHand ? 'win' : 'lose';
  }

  // ---------- 싱글 라운드 시작 ----------
  function startSingleGame(stageNum = 1) {
    state.mode = 'SINGLE';
    state.currentStage = stageNum;
    state.setWinsPlayer = 0;
    state.setWinsOpponent = 0;
    state.setHistory = [];

    initSet(true);
  }

  // 세트 초기화 (영토 0으로)
  function initSet(isNewMatch = false) {
    state.pos = 0;
    state.round = 1;
    state.weakStreakPlayer = 0;
    state.weakStreakOpponent = 0;

    const stg = SINGLE_STAGES[state.currentStage - 1] || SINGLE_STAGES[0];
    const pNick = userProfile.nickname || '나';
    const pBadge = getBadgeMark(userProfile.highestStage, userProfile.masterTitle);

    matchStageTitle.textContent = state.mode === 'SINGLE'
      ? `싱글 ${stg.stage}단계: ${stg.name}`
      : `멀티 대전 vs ${state.opponentNickname}`;

    pNameEl.textContent = `${pBadge} ${pNick}`;
    aNameEl.textContent = state.mode === 'SINGLE'
      ? `${stg.name} ${stg.emoji}`
      : `${state.opponentBadge} ${state.opponentNickname}`;

    updateBoard();
    updateBo3UI();
    updateSpecialButton();
    setPlayerPower(1);

    showScreen(screenGame);
    startRound();
  }

  // ---------- 가위바위보 턴 시작 (15초 카운트다운) ----------
  function startRound() {
    state.phase = 'ACTIVE';
    decisionPanel.classList.remove('locked');
    overlay.classList.add('hidden');
    pZone.classList.remove('win', 'lose');
    aZone.classList.remove('win', 'lose');
    aPower.textContent = '?';
    aPower.className = 'power-chip';

    pHand.classList.add('shuffling');
    aHand.classList.add('shuffling');
    window.soundEngine.playRPSVoiceMelody();

    // 손 셔플 애니메이션
    clearInterval(shuffleId);
    let tick = 0;
    shuffleId = setInterval(() => {
      pIdx = (pIdx + 1) % 3;
      aIdx = (aIdx + 1) % 3;
      pHand.textContent = HANDS[HAND_KEYS[pIdx]].emoji;
      aHand.textContent = HANDS[HAND_KEYS[aIdx]].emoji;
      if (++tick % 2 === 0) window.soundEngine.playShuffleTick();
    }, 70);

    // 15초 타이머
    timerWrap.classList.remove('invisible');
    timerFill.classList.remove('urgent');
    let left = DECIDE_MS;
    timerFill.style.width = '100%';
    timerSec.textContent = '15';

    clearInterval(countdownId);
    countdownId = setInterval(() => {
      left -= 100;
      timerSec.textContent = Math.ceil(Math.max(0, left) / 1000);
      timerFill.style.width = `${Math.max(0, (left / DECIDE_MS) * 100)}%`;

      if (left <= 4000) {
        timerFill.classList.add('urgent');
        if (left % 1000 === 0) window.soundEngine.playTimerTick(true);
      }

      // ★ [요구사항] 15초 동안 선택하지 못한 경우: 약파워(1칸)로 패배한 것으로 처리!
      if (left <= 0) {
        clearInterval(countdownId);
        handleTimeoutDefeat();
      }
    }, 100);
  }

  // 타임아웃 패배 처리
  function handleTimeoutDefeat() {
    if (state.phase !== 'ACTIVE') return;

    if (state.mode === 'SINGLE') {
      const ai = getSingleAiDecision();
      // AI의 손을 이기는 손이 아닌, AI에게 지는 손을 플레이어에게 부여
      const losingHand = Object.keys(HANDS).find(k => HANDS[ai.hand].beats === k) || 'scissors';
      state.playerBet = 1; // 약파워로 패배
      resolveRound(losingHand, ai.hand, 1, ai.bet, true);
    } else {
      // 멀티 타임아웃
      if (mqttClient && mqttClient.isConnected()) {
        sendMqttMessage({
          type: 'TIMEOUT',
          roomId: state.roomId,
          sender: state.isHost ? 'HOST' : 'GUEST'
        });
      }
      resolveTimeoutMulti();
    }
  }

  // 플레이어가 손 버튼 클릭 시
  function onPlayerChooseHand(hand) {
    if (state.phase !== 'ACTIVE') return;

    window.soundEngine.playLockIn();

    if (state.mode === 'SINGLE') {
      const ai = getSingleAiDecision();
      resolveRound(hand, ai.hand, state.playerBet, ai.bet, false);
    } else {
      // 멀티플레이: 내 선택 브로드캐스트
      submitMultiChoice(hand, state.playerBet);
    }
  }

  // ---------- 라운드 결과 판정 & 애니메이션 (5초 대기) ----------
  function resolveRound(pHandKey, aHandKey, pBet, aBet, isTimeout = false) {
    state.phase = 'RESULT';
    clearInterval(shuffleId);
    clearInterval(countdownId);

    timerWrap.classList.add('invisible');
    decisionPanel.classList.add('locked');
    pHand.classList.remove('shuffling');
    aHand.classList.remove('shuffling');

    pHand.textContent = HANDS[pHandKey].emoji;
    aHand.textContent = HANDS[aHandKey].emoji;
    pPower.textContent = POWER_NAMES[pBet];
    pPower.className = `power-chip p${pBet}`;
    aPower.textContent = POWER_NAMES[aBet];
    aPower.className = `power-chip p${aBet}`;

    // 연속 약파워 카운트 갱신
    if (pBet === 1) state.weakStreakPlayer++;
    else state.weakStreakPlayer = 0;

    if (aBet === 1) state.weakStreakOpponent++;
    else state.weakStreakOpponent = 0;

    updateSpecialButton();

    let delta = 0;
    let label = '';
    let sub = '';

    if (isTimeout) {
      // 타임아웃 시 상대 파워만큼 패배
      delta = -aBet;
      label = '시간 초과!';
      sub = `약파워 패배 (${-delta}칸 후퇴)`;
      overlay.classList.remove('hidden');
      resultText.textContent = label;
      resultText.className = 'result-text lose';
      resultSub.textContent = sub;
      aZone.classList.add('win');
      pZone.classList.add('lose');
      window.soundEngine.playDefeat();
      speak('시간 초과 졌다');
    } else {
      const rps = judgeRPS(pHandKey, aHandKey);

      if (rps === 'win') {
        delta = pBet;
        label = '이겼다!';
        sub = `+${pBet}칸 전진`;
        pZone.classList.add('win');
        aZone.classList.add('lose');
      } else if (rps === 'lose') {
        delta = -aBet;
        label = '졌다!';
        sub = `${-aBet}칸 후퇴`;
        aZone.classList.add('win');
        pZone.classList.add('lose');
      } else {
        // 비겼을 때: "비겼다!" 말하고 이동 정보만 표시
        label = '비겼다!';
        if (pBet < aBet) {
          delta = aBet - pBet;
          sub = `+${delta}칸 전진`;
          pZone.classList.add('win');
        } else if (pBet > aBet) {
          delta = -(pBet - aBet);
          sub = `${delta}칸 후퇴`;
          aZone.classList.add('win');
        } else {
          delta = 0;
          sub = '이동 없음';
        }
      }

      resultText.textContent = label;
      resultText.className = `result-text ${delta > 0 ? 'win' : delta < 0 ? 'lose' : 'draw'}`;
      resultSub.textContent = sub;
      overlay.classList.remove('hidden');

      if (pBet === 4 || aBet === 4) {
        window.soundEngine.playSpecialHit();
        triggerScreenShake();
      } else if (delta !== 0) {
        window.soundEngine.playHit(Math.abs(delta));
      } else {
        window.soundEngine.playEqualDraw();
      }

      setTimeout(() => speak(label.replace('!', '')), 200);
    }

    state.pos += delta;
    updateBoard();

    // 5초 대기 후 다음 단계 진행
    clearTimeout(resultTimeoutId);
    resultTimeoutId = setTimeout(checkSetOrNextRound, RESULT_MS);
  }

  // ---------- 세트 종료(절벽 추락) 판정 또는 다음 라운드 ----------
  function checkSetOrNextRound() {
    // 플레이어 승리 (상대 절벽 추락)
    if (state.pos >= 5) {
      handleSetOver('PLAYER');
    }
    // 상대 승리 (플레이어 절벽 추락)
    else if (state.pos <= -5) {
      handleSetOver('OPPONENT');
    }
    // 계속 진행
    else {
      state.round++;
      roundEl.textContent = state.round;
      startRound();
    }
  }

  // 한 세트(1판) 종료 처리
  function handleSetOver(winner) {
    state.phase = 'SET_OVER';

    if (winner === 'PLAYER') {
      state.setWinsPlayer++;
      state.setHistory.push('P');
      aiUnit.classList.add('falling');
      window.soundEngine.playFall();
    } else {
      state.setWinsOpponent++;
      state.setHistory.push('O');
      playerUnit.classList.add('falling');
      window.soundEngine.playFall();
    }

    updateBo3UI();

    setTimeout(() => {
      // 3판 2승제 매치 완료 여부 검사 (누군가 2승 달성)
      if (state.setWinsPlayer >= 2 || state.setWinsOpponent >= 2) {
        handleMatchOver(state.setWinsPlayer >= 2);
      } else {
        // 다음 세트 진행!
        alert(`세트 종료! 현재 스코어: 나 ${state.setWinsPlayer}승 : ${state.setWinsOpponent}승 상대`);
        playerUnit.classList.remove('falling');
        aiUnit.classList.remove('falling');
        state.pos = 0;
        state.round = 1;
        updateBoard();
        startRound();
      }
    }, 1000);
  }

  // 매치(3판 2승제) 최종 종료 처리
  function handleMatchOver(isPlayerWon) {
    state.phase = 'MATCH_OVER';

    modalActionBtns.innerHTML = '';

    if (state.mode === 'SINGLE') {
      if (isPlayerWon) {
        window.soundEngine.playVictory();
        modalTrophy.textContent = '🏆';

        // 칭호 갱신
        const nextStage = state.currentStage + 1;
        if (nextStage > userProfile.highestStage) {
          userProfile.highestStage = nextStage;
        }

        // 10단계 클리어 확인
        if (state.currentStage === 10) {
          userProfile.masterTitle = true;
          saveUserProfile();
          modalTitle.textContent = '가위바위보 달인에 등극하였습니다!';
          modalTitle.style.color = '#ffd600';
          modalDesc.textContent = '10단계 가위바위보 황제를 꺾고 💎 다이아몬드 마크를 획득하셨습니다!';
          speak('가위바위보 달인에 등극하였습니다!');

          const btnRestart = document.createElement('button');
          btnRestart.className = 'primary-btn';
          btnRestart.textContent = '1단계부터 다시 시작 🔥';
          btnRestart.onclick = () => { gameoverModal.classList.add('hidden'); startSingleGame(1); };

          const btnHome = document.createElement('button');
          btnHome.className = 'secondary-btn';
          btnHome.textContent = '메인 화면으로 돌아가기';
          btnHome.onclick = () => { gameoverModal.classList.add('hidden'); showScreen(screenMain); };

          modalActionBtns.appendChild(btnRestart);
          modalActionBtns.appendChild(btnHome);
        } else {
          // 3, 5, 8단계 마크 달성 메시지
          let bonusMsg = '';
          if (state.currentStage === 3) bonusMsg = ' (⭐ 별 마크 획득!)';
          if (state.currentStage === 5) bonusMsg = ' (⭐⭐ 별 2개 마크 획득!)';
          if (state.currentStage === 8) bonusMsg = ' (⭐⭐⭐ 별 3개 마크 획득!)';

          saveUserProfile();
          modalTitle.textContent = `${state.currentStage}단계 승리!${bonusMsg}`;
          modalTitle.style.color = '#00e676';
          modalDesc.textContent = `3판 2승으로 승리했습니다! 다음 단계로 도전하세요.`;
          speak('승리');

          const btnNext = document.createElement('button');
          btnNext.className = 'primary-btn';
          btnNext.textContent = `다음 단계로 진행 (${nextStage}단계) ➔`;
          btnNext.onclick = () => { gameoverModal.classList.add('hidden'); startSingleGame(nextStage); };

          const btnHome = document.createElement('button');
          btnHome.className = 'secondary-btn';
          btnHome.textContent = '메인 화면으로 돌아가기';
          btnHome.onclick = () => { gameoverModal.classList.add('hidden'); showScreen(screenMain); };

          modalActionBtns.appendChild(btnNext);
          modalActionBtns.appendChild(btnHome);
        }
      } else {
        // 싱글 패배
        window.soundEngine.playDefeat();
        modalTrophy.textContent = '💀';
        modalTitle.textContent = `${state.currentStage}단계 패배...`;
        modalTitle.style.color = '#ff5252';
        modalDesc.textContent = '아쉽게도 3판 2승 승부에서 패배했습니다.';
        speak('패배');

        const btnRestart = document.createElement('button');
        btnRestart.className = 'primary-btn';
        btnRestart.textContent = '1단계부터 다시 시작 🔄';
        btnRestart.onclick = () => { gameoverModal.classList.add('hidden'); startSingleGame(1); };

        const btnHome = document.createElement('button');
        btnHome.className = 'secondary-btn';
        btnHome.textContent = '메인 화면으로 돌아가기 🏠';
        btnHome.onclick = () => { gameoverModal.classList.add('hidden'); showScreen(screenMain); };

        modalActionBtns.appendChild(btnRestart);
        modalActionBtns.appendChild(btnHome);
      }
    } else {
      // 멀티플레이 매치 종료
      if (isPlayerWon) {
        window.soundEngine.playVictory();
        modalTrophy.textContent = '🏆';
        modalTitle.textContent = '멀티 대전 최종 승리!';
        modalTitle.style.color = '#00e676';
        modalDesc.textContent = `${state.opponentNickname}님과의 3판 2승 승부에서 승리했습니다!`;
        speak('최종 승리');
      } else {
        window.soundEngine.playDefeat();
        modalTrophy.textContent = '💀';
        modalTitle.textContent = '멀티 대전 최종 패배';
        modalTitle.style.color = '#ff5252';
        modalDesc.textContent = `${state.opponentNickname}님에게 패배했습니다.`;
        speak('최종 패배');
      }

      // [대기실로 돌아가기], [메인화면으로 돌아가기] 버튼
      const btnToLobby = document.createElement('button');
      btnToLobby.className = 'primary-btn';
      btnToLobby.textContent = '대기실로 돌아가기 🌐';
      btnToLobby.onclick = () => {
        gameoverModal.classList.add('hidden');
        leaveRoom();
        showScreen(screenLobby);
      };

      const btnToMain = document.createElement('button');
      btnToMain.className = 'secondary-btn';
      btnToMain.textContent = '메인화면으로 돌아가기 🏠';
      btnToMain.onclick = () => {
        gameoverModal.classList.add('hidden');
        leaveRoom();
        showScreen(screenMain);
      };

      modalActionBtns.appendChild(btnToLobby);
      modalActionBtns.appendChild(btnToMain);
    }

    gameoverModal.classList.remove('hidden');
  }

  function triggerScreenShake() {
    gameContainer.classList.add('screen-shake');
    setTimeout(() => gameContainer.classList.remove('screen-shake'), 380);
  }

  // ========================================================
  // 🌐 멀티플레이 네트워크 엔진 (Paho MQTT over WebSocket)
  // ========================================================
  let mqttClient = null;
  const MQTT_BROKER = 'broker.hivemq.com';
  const MQTT_PORT = 8884;
  const MQTT_PATH = '/mqtt';
  const TOPIC_LOBBY = 'jump2you/lobby/v2/rooms';
  let roomAnnounceTimer = null;
  let activeRooms = {};

  function initMqtt() {
    if (mqttClient && mqttClient.isConnected()) return;

    const clientId = 'j2u_' + Math.random().toString(36).substring(2, 10);
    mqttClient = new Paho.MQTT.Client(MQTT_BROKER, MQTT_PORT, MQTT_PATH, clientId);

    mqttClient.onConnectionLost = (resp) => {
      lobbyNetStatus.textContent = '연결 끊김 (재접속 중)';
      lobbyNetStatus.previousElementSibling.className = 'status-dot offline';
      setTimeout(initMqtt, 3000);
    };

    mqttClient.onMessageArrived = (message) => {
      try {
        const payload = JSON.parse(message.payloadString);
        handleMqttMessage(message.destinationName, payload);
      } catch (e) { /* ignore */ }
    };

    mqttClient.connect({
      useSSL: true,
      timeout: 5,
      onSuccess: () => {
        lobbyNetStatus.textContent = '온라인 연결됨';
        lobbyNetStatus.previousElementSibling.className = 'status-dot online';
        mqttClient.subscribe(TOPIC_LOBBY);
      },
      onFailure: (err) => {
        lobbyNetStatus.textContent = '연결 실패 (재시도)';
        lobbyNetStatus.previousElementSibling.className = 'status-dot offline';
        setTimeout(initMqtt, 4000);
      }
    });
  }

  function sendMqttMessage(obj, topic = null) {
    if (!mqttClient || !mqttClient.isConnected()) return;
    const dest = topic || `jump2you/room/${state.roomId}`;
    const msg = new Paho.MQTT.Message(JSON.stringify(obj));
    msg.destinationName = dest;
    mqttClient.send(msg);
  }

  function handleMqttMessage(topic, data) {
    // 1. 로비 방 목록 수신
    if (topic === TOPIC_LOBBY) {
      if (data.type === 'ANNOUNCE_ROOM') {
        activeRooms[data.roomId] = {
          ...data,
          lastSeen: Date.now()
        };
        renderRoomList();
      }
      return;
    }

    // 2. 인게임/대기방 메시지
    if (topic === `jump2you/room/${state.roomId}`) {
      switch (data.type) {
        case 'GUEST_JOINED':
          if (state.isHost) {
            state.opponentNickname = data.guestNick;
            state.opponentBadge = data.guestBadge;
            waitGuestName.textContent = `${data.guestBadge} ${data.guestNick}`;
            waitGuestAvatar.textContent = '🤠';
            waitStatusMsg.textContent = '상대방이 입장했습니다! 3초 후 시작됩니다...';

            // 참가 승인 및 게임 시작 신호
            setTimeout(() => {
              sendMqttMessage({
                type: 'GAME_START',
                hostNick: userProfile.nickname,
                hostBadge: getBadgeMark(userProfile.highestStage, userProfile.masterTitle)
              });
              startMultiGame();
            }, 3000);
          }
          break;

        case 'GAME_START':
          if (!state.isHost) {
            state.opponentNickname = data.hostNick;
            state.opponentBadge = data.hostBadge;
            startMultiGame();
          }
          break;

        case 'CHOICE_SUBMIT':
          // 상대방의 선택 수신
          if ((state.isHost && data.sender === 'GUEST') || (!state.isHost && data.sender === 'HOST')) {
            state.multiChoices.opponent = { hand: data.hand, bet: data.bet };
            checkMultiTurnReady();
          }
          break;

        case 'TIMEOUT':
          // 상대방 타임아웃
          if ((state.isHost && data.sender === 'GUEST') || (!state.isHost && data.sender === 'HOST')) {
            resolveTimeoutOpponent();
          }
          break;

        case 'LEAVE':
          alert('상대방이 게임에서 나갔습니다.');
          leaveRoom();
          showScreen(screenLobby);
          break;
      }
    }
  }

  // 로비 방 목록 렌더링
  function renderRoomList() {
    const now = Date.now();
    roomListContainer.innerHTML = '';
    let count = 0;

    Object.keys(activeRooms).forEach(id => {
      const r = activeRooms[id];
      if (now - r.lastSeen > 6000) {
        delete activeRooms[id];
        return;
      }
      count++;
      const item = document.createElement('div');
      item.className = 'room-item-card';
      item.innerHTML = `
        <div class="room-info-col">
          <span class="room-card-title">${escapeHtml(r.title)}</span>
          <span class="room-card-meta">방장: ${escapeHtml(r.hostBadge)} ${escapeHtml(r.hostNick)}</span>
        </div>
        <button class="room-join-btn">입장하기</button>
      `;
      item.querySelector('.room-join-btn').onclick = () => joinRoom(r.roomId, r.title, r.hostNick, r.hostBadge);
      roomListContainer.appendChild(item);
    });

    if (count === 0) {
      roomListContainer.appendChild(emptyRoomMsg);
      emptyRoomMsg.classList.remove('hidden');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 방 만들기
  function createRoom(title) {
    state.isHost = true;
    state.roomId = 'rm_' + Math.random().toString(36).substring(2, 8);
    const hostBadge = getBadgeMark(userProfile.highestStage, userProfile.masterTitle);

    waitRoomTitle.textContent = title;
    waitHostName.textContent = `${hostBadge} ${userProfile.nickname}`;
    waitGuestName.textContent = '유저 대기 중...';
    waitGuestAvatar.textContent = '⏳';
    waitStatusMsg.textContent = '다른 플레이어의 입장을 기다리고 있습니다...';

    screenWaiting.classList.remove('hidden');

    if (mqttClient && mqttClient.isConnected()) {
      mqttClient.subscribe(`jump2you/room/${state.roomId}`);

      // 2초마다 로비에 방 알림
      clearInterval(roomAnnounceTimer);
      roomAnnounceTimer = setInterval(() => {
        sendMqttMessage({
          type: 'ANNOUNCE_ROOM',
          roomId: state.roomId,
          title: title,
          hostNick: userProfile.nickname,
          hostBadge: hostBadge
        }, TOPIC_LOBBY);
      }, 2000);
    }
  }

  // 방 참가하기
  function joinRoom(roomId, title, hostNick, hostBadge) {
    state.isHost = false;
    state.roomId = roomId;
    state.opponentNickname = hostNick;
    state.opponentBadge = hostBadge;

    const guestBadge = getBadgeMark(userProfile.highestStage, userProfile.masterTitle);

    waitRoomTitle.textContent = title;
    waitHostName.textContent = `${hostBadge} ${hostNick}`;
    waitGuestName.textContent = `${guestBadge} ${userProfile.nickname}`;
    waitGuestAvatar.textContent = '🤠';
    waitStatusMsg.textContent = '방에 접속했습니다. 게임 시작 대기 중...';

    screenWaiting.classList.remove('hidden');

    if (mqttClient && mqttClient.isConnected()) {
      mqttClient.subscribe(`jump2you/room/${roomId}`);
      setTimeout(() => {
        sendMqttMessage({
          type: 'GUEST_JOINED',
          guestNick: userProfile.nickname,
          guestBadge: guestBadge
        });
      }, 500);
    }
  }

  function leaveRoom() {
    clearInterval(roomAnnounceTimer);
    if (state.roomId && mqttClient && mqttClient.isConnected()) {
      sendMqttMessage({ type: 'LEAVE' });
      mqttClient.unsubscribe(`jump2you/room/${state.roomId}`);
    }
    state.roomId = null;
    state.isHost = false;
    screenWaiting.classList.add('hidden');
  }

  // 멀티플레이 게임 시작
  function startMultiGame() {
    screenWaiting.classList.add('hidden');
    state.mode = 'MULTI';
    state.setWinsPlayer = 0;
    state.setWinsOpponent = 0;
    state.setHistory = [];

    initSet(true);
  }

  function submitMultiChoice(hand, bet) {
    state.multiChoices.player = { hand, bet };
    sendMqttMessage({
      type: 'CHOICE_SUBMIT',
      sender: state.isHost ? 'HOST' : 'GUEST',
      hand,
      bet
    });
    decisionPanel.classList.add('locked');
    pHand.classList.remove('shuffling');
    pHand.textContent = HANDS[hand].emoji;

    checkMultiTurnReady();
  }

  function checkMultiTurnReady() {
    if (state.multiChoices.player && state.multiChoices.opponent) {
      const p = state.multiChoices.player;
      const o = state.multiChoices.opponent;
      state.multiChoices.player = null;
      state.multiChoices.opponent = null;
      resolveRound(p.hand, o.hand, p.bet, o.bet, false);
    }
  }

  function resolveTimeoutMulti() {
    // 내가 타임아웃
    state.playerBet = 1;
    resolveRound('scissors', 'rock', 1, 1, true);
  }

  function resolveTimeoutOpponent() {
    // 상대방 타임아웃 ➔ 내가 승리
    resolveRound('rock', 'scissors', state.playerBet, 1, false);
  }

  // ========================================================
  // 이벤트 바인딩
  // ========================================================

  // 1. 메인 화면 버튼들
  btnModeSingle.addEventListener('click', () => {
    if (!validateNickname()) return;
    window.soundEngine.init();
    startSingleGame(userProfile.highestStage <= 10 ? userProfile.highestStage : 1);
  });

  btnModeMulti.addEventListener('click', () => {
    if (!validateNickname()) return;
    window.soundEngine.init();
    lobbyMyProfile.textContent = `나: ${getBadgeMark(userProfile.highestStage, userProfile.masterTitle)} ${userProfile.nickname}`;
    initMqtt();
    showScreen(screenLobby);
  });

  btnMainRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));

  // 2. 대기실 버튼들
  btnLobbyBack.addEventListener('click', () => showScreen(screenMain));

  btnOpenCreateRoom.addEventListener('click', () => {
    inputRoomTitle.value = `${userProfile.nickname}의 한판 승부!`;
    modalCreateRoom.classList.remove('hidden');
  });

  btnConfirmCreateRoom.addEventListener('click', () => {
    const title = inputRoomTitle.value.trim() || '즐거운 가위바위보 방';
    modalCreateRoom.classList.add('hidden');
    createRoom(title);
  });

  btnCancelCreateRoom.addEventListener('click', () => modalCreateRoom.classList.add('hidden'));

  btnRefreshRooms.addEventListener('click', () => {
    activeRooms = {};
    renderRoomList();
  });

  btnLeaveRoom.addEventListener('click', () => {
    leaveRoom();
    showScreen(screenLobby);
  });

  // 3. 인게임 버튼들
  btnInGameExit.addEventListener('click', () => {
    if (confirm('게임을 중단하고 나가시겠습니까?')) {
      clearInterval(shuffleId);
      clearInterval(countdownId);
      clearTimeout(resultTimeoutId);
      if (state.mode === 'MULTI') leaveRoom();
      showScreen(screenMain);
    }
  });

  btnSoundToggle.addEventListener('click', (e) => {
    e.currentTarget.textContent = window.soundEngine.toggle() ? '🔊' : '🔇';
  });

  // 1단계 파워 버튼 (약, 중, 강, 필살기)
  powerBtns.forEach(b => {
    b.addEventListener('click', () => {
      if (state.phase !== 'ACTIVE') return;
      window.soundEngine.playBetSelect();
      setPlayerPower(+b.dataset.bet);
    });
  });

  // 2단계 가위/바위/보 버튼
  rpsBtns.forEach(b => {
    b.addEventListener('click', () => {
      if (state.phase !== 'ACTIVE') return;
      onPlayerChooseHand(b.dataset.hand);
    });
  });

  btnCloseRules.addEventListener('click', () => rulesModal.classList.add('hidden'));

  // 초기화 실행
  initTiles();
  initMainScreen();
  showScreen(screenMain);
});
