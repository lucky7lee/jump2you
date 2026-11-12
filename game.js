// ========================================================
// 낭떠러지 가위바위보 - Full Edition Engine
// 파워 횟수 제한 + 멀티 방장 시작/폭파 + Host 동기화 완벽 보장
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // --- 상수 설정 ---
  const DECIDE_MS = 15000;      // 15초 선택 시간
  const RESULT_MS = 5000;       // 5초 가위바위보 결과("이겼다/졌다/비겼다") 확인 시간
  const SET_RESULT_MS = 3000;   // 3초 한판 스코어("1승!/1패!/1승 1패! 등") 확인 시간

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
    { stage: 1, name: '초보 다람쥐', emoji: '🐿️' },
    { stage: 2, name: '골목길 대장', emoji: '😼' },
    { stage: 3, name: '바위산 수련생', emoji: '🪨' },
    { stage: 4, name: '질풍의 권사', emoji: '🌪️' },
    { stage: 5, name: '강철 골렘', emoji: '🛡️' },
    { stage: 6, name: '그림자 닌자', emoji: '🥷' },
    { stage: 7, name: '심리전의 마왕', emoji: '😈' },
    { stage: 8, name: '절벽의 수호신', emoji: '⚡' },
    { stage: 9, name: '패왕 드래곤', emoji: '🐲' },
    { stage: 10, name: '가위바위보 황제', emoji: '👑' }
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
          masterTitle: !!data.masterTitle,
          wins: typeof data.wins === 'number' ? data.wins : 0,
          losses: typeof data.losses === 'number' ? data.losses : 0
        };
      }
    } catch (e) { /* ignore */ }
    return { nickname: '', highestStage: 1, masterTitle: false, wins: 0, losses: 0 };
  }

  function saveUserProfile() {
    localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
    updateMainBadgeUI();
  }

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

    playerBet: 1,
    phase: 'IDLE',        // IDLE | ACTIVE | RESULT | SET_OVER | MATCH_OVER

    // ★ [요구사항 1] 파워 사용 횟수 제한 (1판당 기준)
    // 약파워 무제한 / 중파워 7회 / 강파워 5회 / 필살기 조건충족 시 3회
    powerCounts: {
      p1: Infinity,
      p2: 7,
      p3: 5,
      p4: 0
    },
    aiPowerCounts: {
      p1: Infinity,
      p2: 7,
      p3: 5,
      p4: 0
    },

    // 필살기 추적용: 약파워(1) 연속 사용 횟수
    weakStreakPlayer: 0,
    weakStreakOpponent: 0,

    // 멀티플레이 상태
    isHost: false,
    roomId: null,
    opponentNickname: '',
    opponentBadge: '',
    multiChoices: { host: null, guest: null }
  };

  // 타이머 참조
  let shuffleId = null;
  let countdownId = null;
  let resultTimeoutId = null;
  let hostAutoStartTimer = null;
  let hostAutoStartSec = 30;
  let pIdx = 0, aIdx = 1;

  // --- DOM 캐싱 ---
  const $ = (id) => document.getElementById(id);

  const screenMain = $('screen-main');
  const screenLobby = $('screen-lobby');
  const screenGame = $('screen-game');
  const screenWaiting = $('screen-waiting');

  const inputNickname = $('input-nickname');
  const mainUserBadge = $('main-user-badge');
  const tierBadgeText = $('tier-badge-text');
  const tierRecordText = $('tier-record-text');
  const btnModeSingle = $('btn-mode-single');
  const btnModeMulti = $('btn-mode-multi');
  const btnMainRules = $('btn-main-rules');

  const btnLobbyBack = $('btn-lobby-back');
  const lobbyMyProfile = $('lobby-my-profile');
  const lobbyNetStatus = $('lobby-net-status');
  const btnOpenCreateRoom = $('btn-open-create-room');
  const btnRefreshRooms = $('btn-refresh-rooms');
  const roomListContainer = $('room-list-container');
  const emptyRoomMsg = $('empty-room-msg');

  const waitRoomTitle = $('wait-room-title');
  const waitHostName = $('wait-host-name');
  const waitGuestName = $('wait-guest-name');
  const waitGuestAvatar = $('wait-guest-avatar');
  const waitStatusMsg = $('wait-status-msg');
  const btnHostStartGame = $('btn-host-start-game');
  const btnLeaveRoom = $('btn-leave-room');

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

  // BO3 상황판 (깔끔한 한 줄 말줄임)
  const bo3PName = $('bo3-p-name');
  const bo3PScore = $('bo3-p-score');
  const bo3AName = $('bo3-a-name');
  const bo3AScore = $('bo3-a-score');
  const bo3PDots = $('bo3-p-dots');
  const bo3ADots = $('bo3-a-dots');

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

  const decisionPanel = $('decision-panel');
  const powerBtns = document.querySelectorAll('.power-btn');
  const btnSpecial = $('btn-special');
  const rpsBtns = document.querySelectorAll('.rps-btn');
  const gameContainer = $('game-container');

  const pCnt2 = $('p-cnt-2');
  const pCnt3 = $('p-cnt-3');
  const pCnt4 = $('p-cnt-4');

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

  function showScreen(screen) {
    [screenMain, screenLobby, screenGame].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
  }

  // ---------- 메인 닉네임 관리 ----------
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
    if (tierRecordText) {
      tierRecordText.textContent = `${userProfile.wins || 0}승 ${userProfile.losses || 0}패`;
    }
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

  // ---------- 10칸 영토 보드 ----------
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

  // ---------- ★ [요구사항 2] 3판 2승제 상황표 (아이디 한 줄 깔끔 처리) ----------
  function updateBo3UI() {
    const pNick = userProfile.nickname || '나';
    const pBadge = getBadgeMark(userProfile.highestStage, userProfile.masterTitle);
    bo3PName.textContent = `${pBadge} ${pNick}`;
    bo3PScore.textContent = `${state.setWinsPlayer}승`;

    let oppNick = '상대';
    let oppBadge = '';
    if (state.mode === 'SINGLE') {
      const stg = SINGLE_STAGES[state.currentStage - 1];
      oppNick = `${stg.emoji} ${stg.name}`;
    } else {
      oppBadge = state.opponentBadge;
      oppNick = state.opponentNickname || '상대';
    }
    bo3AName.textContent = `${oppBadge} ${oppNick}`;
    bo3AScore.textContent = `${state.setWinsOpponent}승`;

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

  // ---------- ★ [요구사항 1] 파워 사용 횟수 UI 및 필살기 충전 관리 ----------
  function updatePowerCountsUI() {
    pCnt2.textContent = state.powerCounts.p2;
    pCnt3.textContent = state.powerCounts.p3;
    pCnt4.textContent = state.powerCounts.p4;

    // 소진된 버튼 비활성화
    const btnP2 = document.querySelector('.power-btn.p2');
    const btnP3 = document.querySelector('.power-btn.p3');
    if (btnP2) btnP2.classList.toggle('depleted', state.powerCounts.p2 <= 0);
    if (btnP3) btnP3.classList.toggle('depleted', state.powerCounts.p3 <= 0);

    // 필살기 버튼 활성화/잠금 상태
    if (state.powerCounts.p4 > 0) {
      btnSpecial.classList.remove('locked');
      btnSpecial.classList.add('active');
      btnSpecial.title = `⚡필살기 사용 가능! (남은 횟수: ${state.powerCounts.p4}회)`;
    } else {
      btnSpecial.classList.add('locked');
      btnSpecial.classList.remove('active');
      btnSpecial.title = '상대 3연속 약파워 시 3회 활성화';
      if (state.playerBet === 4) setPlayerPower(1);
    }
  }

  // 상대방이 약파워를 3회 연속 썼는지 확인하여 필살기 3회 충전
  function checkOpponentWeakStreak() {
    if (state.weakStreakOpponent >= 3) {
      // 3회 이상 연속 약파워 사용 시 다시 3회로 활성화 및 충전!
      if (state.powerCounts.p4 === 0) {
        window.soundEngine.playThunder();
        triggerScreenShake();
      }
      state.powerCounts.p4 = 3;
      updatePowerCountsUI();
    }
  }

  function setPlayerPower(p) {
    // 횟수 소진 여부 확인
    if (p === 2 && state.powerCounts.p2 <= 0) {
      alert('이번 판의 중파워(7회)를 모두 사용했습니다!');
      return;
    }
    if (p === 3 && state.powerCounts.p3 <= 0) {
      alert('이번 판의 강파워(5회)를 모두 사용했습니다!');
      return;
    }
    if (p === 4 && state.powerCounts.p4 <= 0) {
      alert('상대방이 약파워를 3회 연속 사용할 때 필살기(3회)가 열립니다!');
      return;
    }

    state.playerBet = p;
    pPower.textContent = POWER_NAMES[p];
    pPower.className = `power-chip p${p}`;

    powerBtns.forEach(b => {
      b.classList.toggle('selected', +b.dataset.bet === p);
    });
  }

  // ---------- 세트 초기화 (1판 시작 시 파워 횟수 리셋) ----------
  function initSet(isNewMatch = false) {
    state.pos = 0;
    state.round = 1;
    state.weakStreakPlayer = 0;
    state.weakStreakOpponent = 0;

    // 1판당 횟수 리셋: 중파워 7회, 강파워 5회, 필살기 0회
    state.powerCounts.p1 = Infinity;
    state.powerCounts.p2 = 7;
    state.powerCounts.p3 = 5;
    state.powerCounts.p4 = 0;

    state.aiPowerCounts.p1 = Infinity;
    state.aiPowerCounts.p2 = 7;
    state.aiPowerCounts.p3 = 5;
    state.aiPowerCounts.p4 = 0;

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
    updatePowerCountsUI();
    setPlayerPower(1);

    showScreen(screenGame);
    startRound();
  }

  // ---------- 싱글 AI 의사결정 (횟수 제한 반영) ----------
  function getSingleAiDecision() {
    let bet = 1;
    const canUseSpecial = state.aiPowerCounts.p4 > 0;
    const canUseHeavy = state.aiPowerCounts.p3 > 0;
    const canUseMid = state.aiPowerCounts.p2 > 0;

    if (canUseSpecial && Math.random() < 0.7) {
      bet = 4;
    } else if (state.pos >= 3 && canUseHeavy && Math.random() < 0.6) {
      bet = 3;
    } else if (state.pos <= -3 && canUseHeavy && Math.random() < 0.5) {
      bet = 3;
    } else if (canUseMid && Math.random() < 0.65) {
      bet = 2;
    } else if (canUseHeavy && Math.random() < 0.4) {
      bet = 3;
    } else {
      bet = 1; // 약파워는 무제한
    }

    const hand = HAND_KEYS[Math.floor(Math.random() * 3)];
    return { bet, hand };
  }

  function judgeRPS(pHand, aHand) {
    if (pHand === aHand) return 'draw';
    return HANDS[pHand].beats === aHand ? 'win' : 'lose';
  }

  // ---------- 싱글 게임 시작 ----------
  function startSingleGame(stageNum = 1) {
    state.mode = 'SINGLE';
    state.currentStage = stageNum;
    state.setWinsPlayer = 0;
    state.setWinsOpponent = 0;
    state.setHistory = [];

    initSet(true);
  }

  // ---------- 라운드 시작 (15초 결정 카운트다운) ----------
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

      // 15초 동안 미선택 시 타임아웃 패널티: 약파워(1칸)로 패배 처리!
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
      const losingHand = Object.keys(HANDS).find(k => HANDS[ai.hand].beats === k) || 'scissors';
      state.playerBet = 1;
      resolveRoundSingle(losingHand, ai.hand, 1, ai.bet, true);
    } else {
      // 멀티 타임아웃
      if (state.isHost) {
        const hostHand = 'scissors';
        const hostBet = 1;
        state.multiChoices.host = { hand: hostHand, bet: hostBet, isTimeout: true };
        checkMultiTurnReadyOnHost();
      } else {
        sendMqttMessage({
          type: 'CHOICE_SUBMIT',
          sender: 'GUEST',
          hand: 'scissors',
          bet: 1,
          isTimeout: true
        });
        decisionPanel.classList.add('locked');
      }
    }
  }

  // 손 버튼 클릭 시
  function onPlayerChooseHand(hand) {
    if (state.phase !== 'ACTIVE') return;

    // 파워 횟수 유효성 검사
    if (state.playerBet === 2 && state.powerCounts.p2 <= 0) state.playerBet = 1;
    if (state.playerBet === 3 && state.powerCounts.p3 <= 0) state.playerBet = 1;
    if (state.playerBet === 4 && state.powerCounts.p4 <= 0) state.playerBet = 1;

    window.soundEngine.playLockIn();

    if (state.mode === 'SINGLE') {
      const ai = getSingleAiDecision();
      resolveRoundSingle(hand, ai.hand, state.playerBet, ai.bet, false);
    } else {
      // 멀티플레이 제출
      if (state.isHost) {
        state.multiChoices.host = { hand, bet: state.playerBet, isTimeout: false };
        decisionPanel.classList.add('locked');
        pHand.classList.remove('shuffling');
        pHand.textContent = HANDS[hand].emoji;
        checkMultiTurnReadyOnHost();
      } else {
        state.multiChoices.guest = { hand, bet: state.playerBet, isTimeout: false };
        sendMqttMessage({
          type: 'CHOICE_SUBMIT',
          sender: 'GUEST',
          hand,
          bet: state.playerBet,
          isTimeout: false
        });
        decisionPanel.classList.add('locked');
        pHand.classList.remove('shuffling');
        pHand.textContent = HANDS[hand].emoji;
      }
    }
  }

  // ---------- 싱글 라운드 결과 판정 ----------
  function resolveRoundSingle(pHandKey, aHandKey, pBet, aBet, isTimeout = false) {
    // 횟수 차감
    if (pBet === 2 && state.powerCounts.p2 > 0) state.powerCounts.p2--;
    if (pBet === 3 && state.powerCounts.p3 > 0) state.powerCounts.p3--;
    if (pBet === 4 && state.powerCounts.p4 > 0) state.powerCounts.p4--;

    if (aBet === 2 && state.aiPowerCounts.p2 > 0) state.aiPowerCounts.p2--;
    if (aBet === 3 && state.aiPowerCounts.p3 > 0) state.aiPowerCounts.p3--;
    if (aBet === 4 && state.aiPowerCounts.p4 > 0) state.aiPowerCounts.p4--;

    // 연속 약파워 카운트
    if (pBet === 1) state.weakStreakPlayer++;
    else state.weakStreakPlayer = 0;

    if (aBet === 1) state.weakStreakOpponent++;
    else state.weakStreakOpponent = 0;

    // AI에게 플레이어의 3연속 약파워 감지 시 필살기 3회 부여
    if (state.weakStreakPlayer >= 3) state.aiPowerCounts.p4 = 3;

    // 플레이어 필살기 3회 충전 검사
    checkOpponentWeakStreak();
    updatePowerCountsUI();

    let delta = 0;
    let label = '';
    let sub = '';

    if (isTimeout) {
      delta = -aBet;
      label = '시간 초과!';
      sub = `약파워 패배 (${-delta}칸 후퇴)`;
    } else {
      const rps = judgeRPS(pHandKey, aHandKey);
      if (rps === 'win') {
        delta = pBet;
        label = '이겼다!';
        sub = `+${pBet}칸 전진`;
      } else if (rps === 'lose') {
        delta = -aBet;
        label = '졌다!';
        sub = `${-aBet}칸 후퇴`;
      } else {
        label = '비겼다!';
        if (pBet < aBet) {
          delta = aBet - pBet;
          sub = `+${delta}칸 전진`;
        } else if (pBet > aBet) {
          delta = -(pBet - aBet);
          sub = `${delta}칸 후퇴`;
        } else {
          delta = 0;
          sub = '이동 없음';
        }
      }
    }

    state.pos += delta;
    renderRoundOutcomeUI(pHandKey, aHandKey, pBet, aBet, delta, label, sub, isTimeout);

    // 세트 승패 결정 시 즉시 낭떠러지 추락 연출 및 효과음
    if (state.pos >= 5) {
      aiUnit.classList.add('falling');
      window.soundEngine.playFall();
    } else if (state.pos <= -5) {
      playerUnit.classList.add('falling');
      window.soundEngine.playFall();
    }

    clearTimeout(resultTimeoutId);
    resultTimeoutId = setTimeout(checkSetOrNextRoundSingle, RESULT_MS);
  }

  // 화면 연출
  function renderRoundOutcomeUI(pHandKey, aHandKey, pBet, aBet, delta, label, sub, isTimeout) {
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

    resultText.textContent = label;
    resultText.className = `result-text ${delta > 0 ? 'win' : delta < 0 ? 'lose' : 'draw'}`;
    resultSub.textContent = sub;
    overlay.classList.remove('hidden');

    if (delta > 0) {
      pZone.classList.add('win');
      aZone.classList.add('lose');
    } else if (delta < 0) {
      aZone.classList.add('win');
      pZone.classList.add('lose');
    }

    if (pBet === 4 || aBet === 4) {
      window.soundEngine.playSpecialHit();
      triggerScreenShake();
    } else if (delta !== 0) {
      window.soundEngine.playHit(Math.abs(delta));
    } else {
      window.soundEngine.playEqualDraw();
    }

    updateBoard();
    setTimeout(() => speak(label.replace('!', '')), 200);
  }

  // ---------- 한판 승/패 결정 시 3초간 세트 스코어 결과(1승/1패/1승1패 등) 화면 연출 ----------
  function getSetResultText(myWins, oppWins) {
    if (myWins === 1 && oppWins === 0) return '1승!';
    if (myWins === 0 && oppWins === 1) return '1패!';
    if (myWins === 1 && oppWins === 1) return '1승 1패!';
    if (myWins === 2 && oppWins === 0) return '2승!';
    if (myWins === 0 && oppWins === 2) return '2패!';
    if (myWins === 2 && oppWins === 1) return '2승 1패!';
    if (myWins === 1 && oppWins === 2) return '1승 2패!';
    return `${myWins}승 ${oppWins}패!`;
  }

  function showSetOutcomeUI(myWins, oppWins, isMyWin, onComplete) {
    state.phase = 'SET_RESULT';
    playerUnit.classList.remove('falling');
    aiUnit.classList.remove('falling');

    const txt = getSetResultText(myWins, oppWins);
    resultText.textContent = txt;
    resultText.className = `result-text ${isMyWin ? 'win' : 'lose'}`;

    // 팝 애니메이션 리셋하여 3초간 생동감 있게 팝업
    resultText.style.animation = 'none';
    void resultText.offsetWidth;
    resultText.style.animation = '';

    resultSub.textContent = `현재 스코어: 나 ${myWins}승 : ${oppWins}승 상대`;
    overlay.classList.remove('hidden');

    pZone.classList.remove('win', 'lose');
    aZone.classList.remove('win', 'lose');
    if (isMyWin) {
      pZone.classList.add('win');
      aZone.classList.add('lose');
      window.soundEngine.playVictory();
    } else {
      aZone.classList.add('win');
      pZone.classList.add('lose');
      window.soundEngine.playDefeat();
    }

    setTimeout(() => speak(txt.replace('!', '')), 100);

    clearTimeout(resultTimeoutId);
    resultTimeoutId = setTimeout(() => {
      overlay.classList.add('hidden');
      onComplete();
    }, SET_RESULT_MS);
  }

  // 싱글 세트 판정
  function checkSetOrNextRoundSingle() {
    if (state.pos >= 5) {
      handleSetOverSingle('PLAYER');
    } else if (state.pos <= -5) {
      handleSetOverSingle('OPPONENT');
    } else {
      state.round++;
      roundEl.textContent = state.round;
      startRound();
    }
  }

  function handleSetOverSingle(winner) {
    state.phase = 'SET_OVER';
    const isPlayerWon = (winner === 'PLAYER');
    if (isPlayerWon) {
      state.setWinsPlayer++;
      state.setHistory.push('P');
    } else {
      state.setWinsOpponent++;
      state.setHistory.push('O');
    }
    updateBo3UI();

    // 5초간 "이겼다/졌다" 이후 3초간 "1승!/1패!/1승 1패! 등" 보여주고 다음 단계 진행
    showSetOutcomeUI(state.setWinsPlayer, state.setWinsOpponent, isPlayerWon, () => {
      if (state.setWinsPlayer >= 2 || state.setWinsOpponent >= 2) {
        handleMatchOver(state.setWinsPlayer >= 2);
      } else {
        initSet(false);
      }
    });
  }

  // 매치 최종 종료 모달
  function handleMatchOver(isPlayerWon) {
    state.phase = 'MATCH_OVER';
    overlay.classList.add('hidden');
    modalActionBtns.innerHTML = '';

    if (state.mode === 'SINGLE') {
      if (isPlayerWon) {
        userProfile.wins = (userProfile.wins || 0) + 1;
        window.soundEngine.playVictory();
        modalTrophy.textContent = '🏆';

        const nextStage = state.currentStage + 1;
        if (nextStage > userProfile.highestStage) {
          userProfile.highestStage = nextStage;
        }

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
        userProfile.losses = (userProfile.losses || 0) + 1;
        saveUserProfile();
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
        userProfile.wins = (userProfile.wins || 0) + 1;
        saveUserProfile();
        window.soundEngine.playVictory();
        modalTrophy.textContent = '🏆';
        modalTitle.textContent = '멀티 대전 최종 승리!';
        modalTitle.style.color = '#00e676';
        modalDesc.textContent = `${state.opponentNickname}님과의 3판 2승 승부에서 승리했습니다!`;
        speak('최종 승리');
      } else {
        userProfile.losses = (userProfile.losses || 0) + 1;
        saveUserProfile();
        window.soundEngine.playDefeat();
        modalTrophy.textContent = '💀';
        modalTitle.textContent = '멀티 대전 최종 패배';
        modalTitle.style.color = '#ff5252';
        modalDesc.textContent = `${state.opponentNickname}님에게 패배했습니다.`;
        speak('최종 패배');
      }

      // ★ [요구사항] 대기실로 돌아가기 & 메인화면으로 돌아가기
      const btnToLobby = document.createElement('button');
      btnToLobby.className = 'primary-btn';
      btnToLobby.textContent = '대기실로 돌아가기 🌐';
      btnToLobby.onclick = () => {
        gameoverModal.classList.add('hidden');
        leaveRoomClean();
        showScreen(screenLobby);
      };

      const btnToMain = document.createElement('button');
      btnToMain.className = 'secondary-btn';
      btnToMain.textContent = '메인화면으로 돌아가기 🏠';
      btnToMain.onclick = () => {
        gameoverModal.classList.add('hidden');
        leaveRoomClean();
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
  // ★ [요구사항 3, 4, 5] 멀티플레이 완벽 동기화 (Host-Authoritative)
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

    mqttClient.onConnectionLost = () => {
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
      onFailure: () => {
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
    // 1. 로비 방 목록
    if (topic === TOPIC_LOBBY) {
      if (data.type === 'ANNOUNCE_ROOM') {
        activeRooms[data.roomId] = { ...data, lastSeen: Date.now() };
        renderRoomList();
      } else if (data.type === 'REMOVE_ROOM') {
        // 방장이 방을 나갔을 때 로비 목록에서 즉시 삭제!
        delete activeRooms[data.roomId];
        renderRoomList();
      }
      return;
    }

    // 2. 방 내부 메시지
    if (topic === `jump2you/room/${state.roomId}`) {
      switch (data.type) {
        case 'GUEST_JOINED':
          if (state.isHost) {
            state.opponentNickname = data.guestNick;
            state.opponentBadge = data.guestBadge;
            waitGuestName.textContent = `${data.guestBadge} ${data.guestNick}`;
            waitGuestAvatar.textContent = '🤠';

            // ★ [요구사항 3] 방장 전용 [게임 시작 (30초)] 버튼 활성화 및 30초 자동 시작 타이머
            btnHostStartGame.classList.remove('hidden');
            waitStatusMsg.textContent = '상대방이 입장했습니다! 30초 안에 시작을 누르세요.';
            startHostAutoStartCountdown();
          }
          break;

        case 'GUEST_WAITING_SYNC':
          // 게스트 화면 상태 업데이트
          if (!state.isHost) {
            waitStatusMsg.textContent = `방장이 게임 시작을 누르기를 기다리고 있습니다... (${data.sec}초)`;
          }
          break;

        case 'GUEST_LEFT':
          if (state.isHost) {
            alert('참여자가 방을 나갔습니다.');
            stopHostAutoStartCountdown();
            state.opponentNickname = '';
            waitGuestName.textContent = '유저 대기 중...';
            waitGuestAvatar.textContent = '⏳';
            btnHostStartGame.classList.add('hidden');
            waitStatusMsg.textContent = '다른 플레이어의 입장을 기다리고 있습니다...';
          }
          break;

        // ★ [요구사항 4] 방장이 나가서 방이 폭파되었을 때 게스트 강제 퇴장
        case 'ROOM_CLOSED':
          if (!state.isHost) {
            alert('방장이 방을 나가 방이 사라졌습니다. 대기실로 이동합니다.');
            leaveRoomClean();
            showScreen(screenLobby);
          }
          break;

        case 'GAME_START':
          // 게스트 게임 시작 수신
          if (!state.isHost) {
            stopHostAutoStartCountdown();
            state.opponentNickname = data.hostNick;
            state.opponentBadge = data.hostBadge;
            screenWaiting.classList.add('hidden');
            state.mode = 'MULTI';
            state.setWinsPlayer = 0;
            state.setWinsOpponent = 0;
            state.setHistory = [];
            initSet(true);
          }
          break;

        case 'CHOICE_SUBMIT':
          // 게스트가 선택을 제출 -> 호스트가 수신
          if (state.isHost && data.sender === 'GUEST') {
            state.multiChoices.guest = { hand: data.hand, bet: data.bet, isTimeout: !!data.isTimeout };
            checkMultiTurnReadyOnHost();
          }
          break;

        // ★ [요구사항 5] 호스트의 공식 판정 동기화 (Host-Authoritative Sync)
        case 'ROUND_SYNC':
          handleRoundSyncMessage(data);
          break;
      }
    }
  }

  // --- ★ [요구사항 3] 방장 30초 카운트다운 타이머 ---
  function startHostAutoStartCountdown() {
    stopHostAutoStartCountdown();
    hostAutoStartSec = 30;
    btnHostStartGame.textContent = `🔥 게임 시작 (${hostAutoStartSec}초)`;

    hostAutoStartTimer = setInterval(() => {
      hostAutoStartSec--;
      btnHostStartGame.textContent = `🔥 게임 시작 (${hostAutoStartSec}초)`;

      // 게스트에게도 남은 초 전송
      sendMqttMessage({ type: 'GUEST_WAITING_SYNC', sec: hostAutoStartSec });

      if (hostAutoStartSec <= 0) {
        stopHostAutoStartCountdown();
        triggerHostStartGame();
      }
    }, 1000);
  }

  function stopHostAutoStartCountdown() {
    clearInterval(hostAutoStartTimer);
    hostAutoStartTimer = null;
  }

  // 방장이 게임 시작 버튼 누름 또는 30초 자동 시작
  function triggerHostStartGame() {
    stopHostAutoStartCountdown();
    btnHostStartGame.classList.add('hidden');

    sendMqttMessage({
      type: 'GAME_START',
      hostNick: userProfile.nickname,
      hostBadge: getBadgeMark(userProfile.highestStage, userProfile.masterTitle)
    });

    screenWaiting.classList.add('hidden');
    state.mode = 'MULTI';
    state.setWinsPlayer = 0;
    state.setWinsOpponent = 0;
    state.setHistory = [];
    initSet(true);
  }

  // --- ★ [요구사항 5] 호스트 공식 판정 & 결과 브로드캐스트 ---
  function checkMultiTurnReadyOnHost() {
    if (!state.isHost) return;
    if (state.multiChoices.host && state.multiChoices.guest) {
      const h = state.multiChoices.host;
      const g = state.multiChoices.guest;
      state.multiChoices.host = null;
      state.multiChoices.guest = null;

      // 1. 호스트 기준 파워 횟수 차감
      if (h.bet === 2 && state.powerCounts.p2 > 0) state.powerCounts.p2--;
      if (h.bet === 3 && state.powerCounts.p3 > 0) state.powerCounts.p3--;
      if (h.bet === 4 && state.powerCounts.p4 > 0) state.powerCounts.p4--;

      // 2. 판정 계산 (호스트 기준 이동량 deltaHost)
      let deltaHost = 0;
      let labelHost = '';
      let subHost = '';

      if (h.isTimeout && g.isTimeout) {
        deltaHost = 0;
        labelHost = '비겼다!';
        subHost = '둘 다 시간 초과';
      } else if (h.isTimeout) {
        deltaHost = -g.bet;
        labelHost = '시간 초과!';
        subHost = `약파워 패배 (${-deltaHost}칸 후퇴)`;
      } else if (g.isTimeout) {
        deltaHost = h.bet;
        labelHost = '이겼다!';
        subHost = `상대 시간 초과 (+${deltaHost}칸 전진)`;
      } else {
        const rps = judgeRPS(h.hand, g.hand);
        if (rps === 'win') {
          deltaHost = h.bet;
          labelHost = '이겼다!';
          subHost = `+${h.bet}칸 전진`;
        } else if (rps === 'lose') {
          deltaHost = -g.bet;
          labelHost = '졌다!';
          subHost = `${-g.bet}칸 후퇴`;
        } else {
          labelHost = '비겼다!';
          if (h.bet < g.bet) {
            deltaHost = g.bet - h.bet;
            subHost = `+${deltaHost}칸 전진`;
          } else if (h.bet > g.bet) {
            deltaHost = -(h.bet - g.bet);
            subHost = `${deltaHost}칸 후퇴`;
          } else {
            deltaHost = 0;
            subHost = '이동 없음';
          }
        }
      }

      state.pos += deltaHost;

      // 약파워 연속 추적 (호스트 관점)
      if (h.bet === 1) state.weakStreakPlayer++;
      else state.weakStreakPlayer = 0;

      if (g.bet === 1) state.weakStreakOpponent++;
      else state.weakStreakOpponent = 0;

      checkOpponentWeakStreak();
      updatePowerCountsUI();

      // 세트 종료 여부 판정
      let isSetOver = false;
      let setWinner = null;
      if (state.pos >= 5) {
        isSetOver = true;
        setWinner = 'HOST';
        state.setWinsPlayer++;
        state.setHistory.push('P');
      } else if (state.pos <= -5) {
        isSetOver = true;
        setWinner = 'GUEST';
        state.setWinsOpponent++;
        state.setHistory.push('O');
      }

      // 매치 종료 여부 (누군가 2승 달성)
      let isMatchOver = false;
      let matchWinner = null;
      if (state.setWinsPlayer >= 2) {
        isMatchOver = true;
        matchWinner = 'HOST';
      } else if (state.setWinsOpponent >= 2) {
        isMatchOver = true;
        matchWinner = 'GUEST';
      }

      // 공식 동기화 메시지 브로드캐스트
      const syncMsg = {
        type: 'ROUND_SYNC',
        hostHand: h.hand,
        guestHand: g.hand,
        hostBet: h.bet,
        guestBet: g.bet,
        deltaHost: deltaHost,
        newPosHost: state.pos,
        labelHost: labelHost,
        subHost: subHost,
        isSetOver: isSetOver,
        setWinner: setWinner,
        hostSetWins: state.setWinsPlayer,
        guestSetWins: state.setWinsOpponent,
        isMatchOver: isMatchOver,
        matchWinner: matchWinner
      };

      sendMqttMessage(syncMsg);
      // 호스트 자신도 동일한 핸들러로 렌더링
      handleRoundSyncMessage(syncMsg);
    }
  }

  // 양쪽 클라이언트가 동일하게 수신하는 턴 동기화 핸들러
  function handleRoundSyncMessage(data) {
    clearTimeout(resultTimeoutId);

    if (state.isHost) {
      // 호스트 관점 연출
      renderRoundOutcomeUI(
        data.hostHand,
        data.guestHand,
        data.hostBet,
        data.guestBet,
        data.deltaHost,
        data.labelHost,
        data.subHost,
        false
      );

      // 세트 종료 시 낭떠러지 추락 연출 및 효과음
      if (data.isSetOver) {
        if (data.setWinner === 'HOST') {
          aiUnit.classList.add('falling');
          window.soundEngine.playFall();
        } else {
          playerUnit.classList.add('falling');
          window.soundEngine.playFall();
        }
      }

      resultTimeoutId = setTimeout(() => {
        if (data.isSetOver) {
          const isHostWon = (data.setWinner === 'HOST');
          showSetOutcomeUI(data.hostSetWins, data.guestSetWins, isHostWon, () => {
            if (data.isMatchOver) {
              handleMatchOver(data.matchWinner === 'HOST');
            } else {
              initSet(false);
            }
          });
        } else {
          state.round++;
          roundEl.textContent = state.round;
          startRound();
        }
      }, RESULT_MS);

    } else {
      // 게스트 관점 연출 (게스트가 왼쪽 '나'이므로 delta 반전)
      const myDelta = -data.deltaHost;
      state.pos = -data.newPosHost;

      // 횟수 차감
      if (data.guestBet === 2 && state.powerCounts.p2 > 0) state.powerCounts.p2--;
      if (data.guestBet === 3 && state.powerCounts.p3 > 0) state.powerCounts.p3--;
      if (data.guestBet === 4 && state.powerCounts.p4 > 0) state.powerCounts.p4--;

      // 게스트 필살기 충전 추적
      if (data.guestBet === 1) state.weakStreakPlayer++;
      else state.weakStreakPlayer = 0;

      if (data.hostBet === 1) state.weakStreakOpponent++;
      else state.weakStreakOpponent = 0;

      checkOpponentWeakStreak();
      updatePowerCountsUI();

      let myLabel = '';
      let mySub = '';
      if (myDelta > 0) {
        myLabel = '이겼다!';
        mySub = `+${myDelta}칸 전진`;
      } else if (myDelta < 0) {
        myLabel = '졌다!';
        mySub = `${myDelta}칸 후퇴`;
      } else {
        myLabel = '비겼다!';
        mySub = '이동 없음';
      }

      state.setWinsPlayer = data.guestSetWins;
      state.setWinsOpponent = data.hostSetWins;
      updateBo3UI();

      renderRoundOutcomeUI(
        data.guestHand,
        data.hostHand,
        data.guestBet,
        data.hostBet,
        myDelta,
        myLabel,
        mySub,
        false
      );

      // 세트 종료 시 낭떠러지 추락 연출 및 효과음 (게스트 관점: 상대방이 지면 aiUnit 추락)
      if (data.isSetOver) {
        if (data.setWinner === 'GUEST') {
          aiUnit.classList.add('falling');
          window.soundEngine.playFall();
        } else {
          playerUnit.classList.add('falling');
          window.soundEngine.playFall();
        }
      }

      resultTimeoutId = setTimeout(() => {
        if (data.isSetOver) {
          const isGuestWon = (data.setWinner === 'GUEST');
          showSetOutcomeUI(data.guestSetWins, data.hostSetWins, isGuestWon, () => {
            if (data.isMatchOver) {
              handleMatchOver(data.matchWinner === 'GUEST');
            } else {
              initSet(false);
            }
          });
        } else {
          state.round++;
          roundEl.textContent = state.round;
          startRound();
        }
      }, RESULT_MS);
    }
  }

  // --- 로비 방 목록 ---
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
    btnHostStartGame.classList.add('hidden');

    screenWaiting.classList.remove('hidden');

    if (mqttClient && mqttClient.isConnected()) {
      mqttClient.subscribe(`jump2you/room/${state.roomId}`);

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
    waitStatusMsg.textContent = '방에 접속했습니다. 방장의 시작을 기다리는 중...';
    btnHostStartGame.classList.add('hidden');

    screenWaiting.classList.remove('hidden');

    if (mqttClient && mqttClient.isConnected()) {
      mqttClient.subscribe(`jump2you/room/${roomId}`);
      setTimeout(() => {
        sendMqttMessage({
          type: 'GUEST_JOINED',
          guestNick: userProfile.nickname,
          guestBadge: guestBadge
        });
      }, 400);
    }
  }

  // ★ [요구사항 4] 방 나가기 및 방 폭파 처리
  function leaveRoomClean() {
    stopHostAutoStartCountdown();
    clearInterval(roomAnnounceTimer);

    if (state.roomId && mqttClient && mqttClient.isConnected()) {
      if (state.isHost) {
        // 방장이 나가면 방 폭파 신호 전송
        sendMqttMessage({ type: 'ROOM_CLOSED' });
        // 로비 방 목록에서도 즉시 삭제 전송
        sendMqttMessage({ type: 'REMOVE_ROOM', roomId: state.roomId }, TOPIC_LOBBY);
      } else {
        // 게스트가 나가면 방장에게 알림
        sendMqttMessage({ type: 'GUEST_LEFT' });
      }
      mqttClient.unsubscribe(`jump2you/room/${state.roomId}`);
    }

    state.roomId = null;
    state.isHost = false;
    state.opponentNickname = '';
    btnHostStartGame.classList.add('hidden');
    screenWaiting.classList.add('hidden');
  }

  // ========================================================
  // 이벤트 바인딩
  // ========================================================

  btnModeSingle.addEventListener('click', () => {
    if (!validateNickname()) return;
    window.soundEngine.init();
    // ★ [요구사항 3] 새 싱글 게임 시작 시 획득한 마크는 유지하되 항상 1단계부터 시작
    startSingleGame(1);
  });

  btnModeMulti.addEventListener('click', () => {
    if (!validateNickname()) return;
    window.soundEngine.init();
    lobbyMyProfile.textContent = `나: ${getBadgeMark(userProfile.highestStage, userProfile.masterTitle)} ${userProfile.nickname}`;
    initMqtt();
    showScreen(screenLobby);
  });

  btnMainRules.addEventListener('click', () => rulesModal.classList.remove('hidden'));
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

  // 방장 수동 시작 버튼
  btnHostStartGame.addEventListener('click', () => {
    triggerHostStartGame();
  });

  // 방 나가기 버튼 (방장 나가면 방 폭파 및 게스트 자동 퇴장)
  btnLeaveRoom.addEventListener('click', () => {
    leaveRoomClean();
    showScreen(screenLobby);
  });

  btnInGameExit.addEventListener('click', () => {
    if (confirm('게임을 중단하고 나가시겠습니까? (중단 시 1패가 추가됩니다)')) {
      clearInterval(shuffleId);
      clearInterval(countdownId);
      clearTimeout(resultTimeoutId);

      // ★ [요구사항 3] 싱글/멀티 게임 도중 나갈 시 1패 추가
      userProfile.losses = (userProfile.losses || 0) + 1;
      saveUserProfile();

      if (state.mode === 'MULTI') leaveRoomClean();
      showScreen(screenMain);
    }
  });

  btnSoundToggle.addEventListener('click', (e) => {
    e.currentTarget.textContent = window.soundEngine.toggle() ? '🔊' : '🔇';
  });

  // 파워 버튼 클릭
  powerBtns.forEach(b => {
    b.addEventListener('click', () => {
      if (state.phase !== 'ACTIVE') return;
      window.soundEngine.playBetSelect();
      setPlayerPower(+b.dataset.bet);
    });
  });

  // 가위/바위/보 버튼 클릭
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
