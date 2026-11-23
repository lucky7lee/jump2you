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
    multiChoices: { host: null, guest: null },

    // 활성 인게임 진행 상태 플래그
    isGameActive: false
  };

  // 비정상 종료(창 닫기/강제 종료 등) 방지용 세션 키
  const ACTIVE_GAME_KEY = 'jump2you_active_game_session';

  // --- 인게임 세션 및 하트비트/이탈 감지 관리 ---
  let multiHeartbeatSendTimer = null;
  let multiHeartbeatCheckTimer = null;
  let lastOpponentHeartbeat = Date.now();

  function markGameActive(mode) {
    state.isGameActive = true;
    try {
      localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({
        mode: mode,
        startedAt: Date.now()
      }));
    } catch (e) {}

    if (mode === 'MULTI') {
      startMultiHeartbeat();
    }

    try {
      history.pushState({ inGame: true }, '');
    } catch (e) {}
  }

  function markGameFinished() {
    state.isGameActive = false;
    try {
      localStorage.removeItem(ACTIVE_GAME_KEY);
    } catch (e) {}
    stopMultiHeartbeat();
  }

  function startMultiHeartbeat() {
    stopMultiHeartbeat();
    lastOpponentHeartbeat = Date.now();

    // 2초마다 하트비트 전송
    multiHeartbeatSendTimer = setInterval(() => {
      if (state.isGameActive && state.mode === 'MULTI' && state.roomId) {
        sendMqttMessage({
          type: 'PEER_HEARTBEAT',
          sender: state.isHost ? 'HOST' : 'GUEST'
        });
      }
    }, 2000);

    // 1초마다 상대방 하트비트 확인 (7초 이상 미응답 시 창닫기/강제종료 몰수승 처리)
    multiHeartbeatCheckTimer = setInterval(() => {
      if (state.isGameActive && state.mode === 'MULTI') {
        if (Date.now() - lastOpponentHeartbeat > 7000) {
          stopMultiHeartbeat();
          handleOpponentForfeited('상대방과의 연결이 끊어졌거나 창을 닫았습니다 (비정상 종료).');
        }
      }
    }, 1000);
  }

  function stopMultiHeartbeat() {
    if (multiHeartbeatSendTimer) {
      clearInterval(multiHeartbeatSendTimer);
      multiHeartbeatSendTimer = null;
    }
    if (multiHeartbeatCheckTimer) {
      clearInterval(multiHeartbeatCheckTimer);
      multiHeartbeatCheckTimer = null;
    }
  }

  // 상대방 이탈/기권 시 나의 몰수승 처리 및 대기실 자동 이동
  function handleOpponentForfeited(reasonText) {
    if (!state.isGameActive) return;
    markGameFinished();

    clearInterval(shuffleId);
    clearInterval(countdownId);
    clearTimeout(resultTimeoutId);

    // 남은 사람에게 1승 추가
    userProfile.wins = (userProfile.wins || 0) + 1;
    saveUserProfile();

    window.soundEngine.playVictory();
    speak('상대방 기권으로 승리하였습니다');

    alert(`${reasonText || '상대방이 게임을 나갔습니다.'}\n\n[몰수승] 1승이 추가되었으며 대기실로 이동합니다!`);

    leaveRoomClean();
    showScreen(screenLobby);
  }

  // 내가 게임 도중 나가기/기권할 때 (무조건 1패)
  function handleSurrenderOrExit() {
    if (!state.isGameActive) return;

    clearInterval(shuffleId);
    clearInterval(countdownId);
    clearTimeout(resultTimeoutId);

    // 나간 사람 무조건 1패 추가
    userProfile.losses = (userProfile.losses || 0) + 1;
    saveUserProfile();

    if (state.mode === 'MULTI') {
      sendMqttMessage({
        type: 'PLAYER_FORFEIT',
        sender: state.isHost ? 'HOST' : 'GUEST',
        nick: userProfile.nickname
      });
      markGameFinished();
      leaveRoomClean();
      showScreen(screenLobby);
    } else {
      markGameFinished();
      showScreen(screenMain);
    }
  }

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
  const cliffBackdrop = $('cliff-backdrop');
  const playerUnit = $('player-unit');
  const aiUnit = $('ai-unit');
  const bustPlayer = $('bust-player');
  const bustPlayerSvg = $('bust-player-svg');
  const impactPlayer = $('impact-player');
  const bustAi = $('bust-ai');
  const bustAiSvg = $('bust-ai-svg');
  const impactAi = $('impact-ai');
  const flyingFist = $('flying-fist');
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

    // 비정상 종료 (강제 종료/창 닫기 등) 감지 시 1패 추가
    try {
      const activeSession = localStorage.getItem(ACTIVE_GAME_KEY);
      if (activeSession) {
        localStorage.removeItem(ACTIVE_GAME_KEY);
        userProfile.losses = (userProfile.losses || 0) + 1;
        saveUserProfile();
        setTimeout(() => {
          alert('이전 게임의 비정상 종료(창 닫기/강제 종료 등)가 감지되어 1패가 추가되었습니다.');
        }, 500);
      }
    } catch (e) {}
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

  // ---------- 상반신(얼굴 강조) 캐릭터 SVG 생성기 (땅 개수 0~10칸별 상처/깨끗함 단계 변형) ----------
  function buildFighterBustSVG(side, tiles) {
    const isPlayer = side === 'PLAYER';
    const mainColor = isPlayer ? '#e53935' : '#1e88e5';
    const subColor = isPlayer ? '#ff8a80' : '#82b1ff';
    const hairColor = isPlayer ? '#2b1b17' : '#1a237e';

    // 피부 톤: 땅을 많이 점령할수록(6~10칸) 뽀얗고 화사해지며, 5칸 이하로 뺏길수록 붉고 푸르스름하게 멍듦
    let skinFill = '#ffccaa';
    let skinStroke = '#d88c60';
    if (tiles >= 8) {
      skinFill = '#ffe5cf';
      skinStroke = '#e59866';
    } else if (tiles >= 6) {
      skinFill = '#ffd7ba';
      skinStroke = '#dc8e5e';
    } else if (tiles === 4) {
      skinFill = '#f5bca0';
    } else if (tiles === 3) {
      skinFill = '#ebaa94';
    } else if (tiles === 2) {
      skinFill = '#df968c';
    } else if (tiles <= 1) {
      skinFill = '#cf8488';
    }

    // 배경 오라 (6칸 이상 점령할수록 깨끗한 광채 증가, 4칸 이하는 어두운 위기감)
    let bgAura = '';
    if (tiles >= 6) {
      const auraOpacity = Math.min(0.85, 0.2 + (tiles - 5) * 0.13);
      bgAura = `
        <circle cx="50" cy="48" r="${36 + (tiles - 5) * 2}" fill="rgba(255, 215, 0, ${auraOpacity * 0.45})" />
        ${tiles >= 9 ? `<circle cx="50" cy="48" r="44" fill="none" stroke="#ffd600" stroke-width="2.5" stroke-dasharray="6 4" opacity="0.85"/>` : ''}
      `;
    } else if (tiles <= 4) {
      const dangerOp = Math.min(0.65, (5 - tiles) * 0.14);
      bgAura = `<circle cx="50" cy="48" r="43" fill="rgba(183, 28, 28, ${dangerOp})" />`;
    }

    // 상처/멍/반창고/혹 레이어 (5칸 이하에서 땅을 뺏길 때마다 단계별로 상처가 늘어남!)
    let woundsLayer = '';
    if (tiles <= 5) {
      // 5칸: 기본 대치 중 미세한 먼지/찰과상 1줄 (6칸 이상 점령 시 완전히 사라져 깨끗해짐)
      woundsLayer += `
        <path d="M28 52 L34 50 M29 55 L35 53" stroke="#8d493a" stroke-width="1.4" stroke-linecap="round" opacity="0.75"/>
      `;
    }
    if (tiles <= 4) {
      // 4칸: 볼에 보라색 멍 시작 + 반창고 1개 + 식은땀
      woundsLayer += `
        <ellipse cx="32" cy="54" rx="7" ry="4.5" fill="rgba(123, 31, 162, 0.35)" />
        <g transform="rotate(-18 31 54)">
          <rect x="24" y="51" width="14" height="6" rx="2" fill="#f5deb3" stroke="#a1887f" stroke-width="1"/>
          <line x1="29" y1="51" x2="29" y2="57" stroke="#d7ccc8" stroke-width="1"/>
          <line x1="33" y1="51" x2="33" y2="57" stroke="#d7ccc8" stroke-width="1"/>
        </g>
        <path d="M21 34 Q18 40 21 43 Q24 40 21 34 Z" fill="#4fc3f7" stroke="#0288d1" stroke-width="0.8"/>
      `;
    }
    if (tiles <= 3) {
      // 3칸: 이마 십자(+) 반창고 추가 + 턱/볼 찰과상 증가 + 붉은 부기
      woundsLayer += `
        <ellipse cx="64" cy="55" rx="6.5" ry="4.5" fill="rgba(211, 47, 47, 0.42)" />
        <g transform="translate(33, 25) rotate(12)">
          <rect x="-7" y="-2.5" width="14" height="5" rx="1.5" fill="#fff8e1" stroke="#8d6e63" stroke-width="1"/>
          <rect x="-2.5" y="-7" width="5" height="14" rx="1.5" fill="#fff8e1" stroke="#8d6e63" stroke-width="1"/>
        </g>
        <path d="M58 63 L65 61 M60 66 L66 64" stroke="#6d1b1b" stroke-width="1.6" stroke-linecap="round"/>
      `;
    }
    if (tiles <= 2) {
      // 2칸: 시퍼런 눈탱이 밤탱이(블랙아이) + 머리 위 큰 혹 1개 + 눈물 줄기
      woundsLayer += `
        <ellipse cx="61" cy="41" rx="8.5" ry="6.5" fill="rgba(74, 20, 140, 0.52)" />
        <circle cx="38" cy="12" r="7.5" fill="#ef5350" stroke="#b71c1c" stroke-width="1.5"/>
        <path d="M35 8 Q38 5 42 8" stroke="#ffcdd2" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M40 46 Q37 56 39 65" stroke="#29b6f6" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M63 46 Q66 56 64 65" stroke="#29b6f6" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `;
    }
    if (tiles <= 1) {
      // 1칸(벼랑 끝 만신창이): 양쪽 눈 시퍼런 멍 + 쌍혹 + 코피 주르륵 + 온 얼굴 상처투성이
      woundsLayer += `
        <ellipse cx="42" cy="41" rx="8" ry="6" fill="rgba(49, 27, 146, 0.55)" />
        <circle cx="51" cy="10" r="6.5" fill="#e53935" stroke="#8e0000" stroke-width="1.5"/>
        <path d="M55 49 L55 62 Q55 65 53 65" stroke="#d50000" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M44 57 L50 54 M45 60 L51 57" stroke="#4e342e" stroke-width="1.6" stroke-linecap="round"/>
      `;
    }
    if (tiles === 0) {
      // 0칸(완전 패배 K.O.): 머리 위 빙글빙글 별
      woundsLayer += `
        <text x="22" y="16" font-size="12">⭐</text>
        <text x="58" y="15" font-size="12">💫</text>
      `;
    }

    // 깨끗함 & 광채 레이어 (6칸 이상 땅을 점령할수록 얼굴이 점점 깨끗해지고 반짝이는 효과)
    let cleanShineLayer = '';
    if (tiles >= 6) {
      // 6칸 이상: 뺨의 뽀얀 윤기 하이라이트
      cleanShineLayer += `
        <ellipse cx="34" cy="49" rx="5.5" ry="3" fill="rgba(255, 255, 255, 0.55)" transform="rotate(-15 34 49)"/>
        <ellipse cx="64" cy="49" rx="4.5" ry="2.5" fill="rgba(255, 138, 128, 0.35)"/>
      `;
    }
    if (tiles >= 7) {
      // 7칸: 반짝이 스파클 1개 + 이마 광택
      cleanShineLayer += `
        <ellipse cx="48" cy="29" rx="9" ry="3" fill="rgba(255, 255, 255, 0.45)"/>
        <path d="M78 22 L80 27 L85 29 L80 31 L78 36 L76 31 L71 29 L76 27 Z" fill="#ffd600"/>
      `;
    }
    if (tiles >= 8) {
      // 8칸: 반짝이 스파클 2개
      cleanShineLayer += `
        <path d="M18 24 L20 28 L24 30 L20 32 L18 36 L16 32 L12 30 L16 28 Z" fill="#fff59d"/>
      `;
    }
    if (tiles >= 9) {
      // 9칸: 반짝이 스파클 3개 + 황금빛 아우라
      cleanShineLayer += `
        <path d="M82 50 L83.5 54 L87.5 55.5 L83.5 57 L82 61 L80.5 57 L76.5 55.5 L80.5 54 Z" fill="#ffd600"/>
      `;
    }
    if (tiles >= 10) {
      // 10칸(완전 정복): 무결점 챔피언 왕관/후광 스파클
      cleanShineLayer += `
        <polygon points="36,14 42,4 48,11 54,4 60,14" fill="#ffd600" stroke="#ff6f00" stroke-width="1.2"/>
      `;
    }

    // 눈 & 눈썹 (오른쪽 상대를 정면으로 응시하도록 배치)
    let eyesLayer = '';
    if (tiles === 0) {
      // K.O. 눈 (X _ X)
      eyesLayer = `
        <path d="M38 38 L46 46 M46 38 L38 46" stroke="#212121" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M57 38 L65 46 M65 38 L57 46" stroke="#212121" stroke-width="2.8" stroke-linecap="round"/>
      `;
    } else if (tiles <= 2) {
      // 고통스럽게 질끈 감거나 눈물 고인 눈
      eyesLayer = `
        <path d="M36 39 L46 42 L36 45" stroke="#212121" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M66 39 L56 42 L66 45" stroke="#212121" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M34 34 L46 37" stroke="#3e2723" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M67 34 L56 37" stroke="#3e2723" stroke-width="2.5" stroke-linecap="round"/>
      `;
    } else if (tiles <= 4) {
      // 찡그린 긴장 눈
      eyesLayer = `
        <ellipse cx="42" cy="41" rx="4" ry="4.2" fill="#fff" stroke="#212121" stroke-width="1.5"/>
        <circle cx="43.5" cy="41" r="2.2" fill="#111"/>
        <ellipse cx="61" cy="41" rx="4" ry="4.2" fill="#fff" stroke="#212121" stroke-width="1.5"/>
        <circle cx="62.5" cy="41" r="2.2" fill="#111"/>
        <path d="M35 35 L47 38" stroke="#2b1b17" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M67 35 L55 38" stroke="#2b1b17" stroke-width="2.6" stroke-linecap="round"/>
      `;
    } else if (tiles >= 8) {
      // 의기양양 초롱초롱 빛나는 눈
      eyesLayer = `
        <ellipse cx="42" cy="40" rx="4.5" ry="5.2" fill="#fff" stroke="#111" stroke-width="1.5"/>
        <circle cx="44" cy="40" r="2.8" fill="#111"/>
        <circle cx="45" cy="38.5" r="1.2" fill="#fff"/>
        <ellipse cx="61" cy="40" rx="4.5" ry="5.2" fill="#fff" stroke="#111" stroke-width="1.5"/>
        <circle cx="63" cy="40" r="2.8" fill="#111"/>
        <circle cx="64" cy="38.5" r="1.2" fill="#fff"/>
        <path d="M35 33 Q42 30 47 34" stroke="#2b1b17" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <path d="M55 34 Q61 30 67 33" stroke="#2b1b17" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      `;
    } else {
      // 5~7칸: 결의에 찬 매서운 파이터 눈매
      eyesLayer = `
        <ellipse cx="42" cy="41" rx="4.2" ry="4.6" fill="#fff" stroke="#111" stroke-width="1.5"/>
        <circle cx="44" cy="41" r="2.5" fill="#111"/>
        <circle cx="44.8" cy="39.8" r="1" fill="#fff"/>
        <ellipse cx="61" cy="41" rx="4.2" ry="4.6" fill="#fff" stroke="#111" stroke-width="1.5"/>
        <circle cx="63" cy="41" r="2.5" fill="#111"/>
        <circle cx="63.8" cy="39.8" r="1" fill="#fff"/>
        <path d="M35 34 L47 37" stroke="#2b1b17" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M67 34 L55 37" stroke="#2b1b17" stroke-width="2.8" stroke-linecap="round"/>
      `;
    }

    // 입 모양 (점령할수록 환한 미소, 뺏길수록 일그러지고 절규)
    let mouthLayer = '';
    if (tiles >= 8) {
      // 활짝 웃는 승리 미소 (하얀 치아 반짝)
      mouthLayer = `
        <path d="M40 53 Q52 65 62 53 Z" fill="#b71c1c" stroke="#111" stroke-width="1.6"/>
        <path d="M42 54 Q52 59 60 54 Z" fill="#ffffff"/>
      `;
    } else if (tiles >= 6) {
      // 자신감 넘치는 깨끗한 미소
      mouthLayer = `
        <path d="M42 55 Q52 62 61 54" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      `;
    } else if (tiles === 5) {
      // 꽉 다문 결의의 입
      mouthLayer = `
        <rect x="43" y="54" width="16" height="5" rx="2" fill="#fff" stroke="#111" stroke-width="1.5"/>
        <line x1="43" y1="56.5" x2="59" y2="56.5" stroke="#111" stroke-width="1.2"/>
      `;
    } else if (tiles === 4) {
      // 흔들리는 입
      mouthLayer = `
        <path d="M42 58 Q47 54 52 58 Q57 62 61 57" stroke="#111" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      `;
    } else if (tiles >= 2) {
      // 고통스럽게 벌린 입
      mouthLayer = `
        <ellipse cx="52" cy="58" rx="8" ry="5.5" fill="#7f0000" stroke="#111" stroke-width="1.6"/>
        <path d="M46 54 L58 54" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      `;
    } else {
      // 0~1칸: 대성통곡 절규 입 + 퉁퉁 부은 입술
      mouthLayer = `
        <path d="M41 61 Q52 50 62 61 Z" fill="#880e4f" stroke="#111" stroke-width="1.8"/>
        <ellipse cx="52" cy="61" rx="5" ry="3" fill="#ff80ab"/>
      `;
    }

    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        ${bgAura}
        <!-- 상반신 도복/어깨 -->
        <path d="M12 98 C14 77 30 72 50 72 C70 72 84 78 88 98 Z" fill="${mainColor}" stroke="#111" stroke-width="2.2"/>
        <path d="M36 72 L50 88 L64 72" fill="none" stroke="${subColor}" stroke-width="3.5" stroke-linecap="round"/>
        <!-- 머리띠 리본 (뒤쪽 날림) -->
        <path d="M20 26 L6 20 L10 29 L5 35 L21 32 Z" fill="${mainColor}" stroke="#111" stroke-width="1.4"/>
        <!-- 귀 -->
        <ellipse cx="21" cy="45" rx="5" ry="7" fill="${skinFill}" stroke="${skinStroke}" stroke-width="1.8"/>
        <!-- 얼굴 본체 (얼굴 강조 대구경 헤드) -->
        <ellipse cx="49" cy="44" rx="28" ry="27" fill="${skinFill}" stroke="#111" stroke-width="2.2"/>
        <!-- 머리카락 & 전투 머리띠 -->
        <path d="M21 32 C22 14 40 9 56 11 C70 12 79 20 77 32 C68 25 35 25 21 32 Z" fill="${hairColor}" stroke="#111" stroke-width="1.8"/>
        <path d="M21 27 Q50 22 77 28 L76 34 Q50 28 21 33 Z" fill="${mainColor}" stroke="#111" stroke-width="1.5"/>
        <!-- 코 (오른쪽을 향함) -->
        <path d="M53 43 L58 47 L52 49" fill="none" stroke="#8d493a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- 눈 & 입 -->
        ${eyesLayer}
        ${mouthLayer}
        <!-- 상처/멍 또는 깨끗함/광채 레이어 -->
        ${woundsLayer}
        ${cleanShineLayer}
        <!-- 전면 파이터 가드 주먹 (상반신 입체감) -->
        <circle cx="80" cy="79" r="10" fill="${skinFill}" stroke="#111" stroke-width="2.2"/>
        <path d="M74 75 L85 75 M74 79 L85 79 M74 83 L85 83" stroke="#8d493a" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  // 날아가는 주먹 프로젝타일 SVG (파워 단계별 불꽃/번개 이펙트)
  function buildFlyingFistSVG(power, isPlayerAttacking) {
    const auraColor = power >= 4 ? '#00e5ff' : (isPlayerAttacking ? '#ff1744' : '#2979ff');
    const flameColor = power >= 4 ? '#e040fb' : (isPlayerAttacking ? '#ffd600' : '#00e5ff');
    return `
      <svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
        <!-- 뒤쪽 스피드 라인 & 충격파 꼬리 -->
        <path d="M4 45 L45 25 L38 45 L45 65 Z" fill="${flameColor}" opacity="0.85"/>
        <path d="M18 20 L65 12 C95 12 114 26 114 45 C114 64 95 78 65 78 L18 70 L34 45 Z" fill="${auraColor}" opacity="0.9"/>
        <line x1="2" y1="26" x2="36" y2="26" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="0" y1="45" x2="30" y2="45" stroke="#ffd600" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="2" y1="64" x2="36" y2="64" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
        <!-- 거대 주먹 본체 -->
        <rect x="46" y="22" width="56" height="46" rx="14" fill="#ffccaa" stroke="#111" stroke-width="3.5"/>
        <!-- 손가락 마디 입체 표현 -->
        <rect x="86" y="23" width="16" height="11" rx="5" fill="#ffb085" stroke="#111" stroke-width="2.5"/>
        <rect x="88" y="34" width="16" height="11" rx="5" fill="#ffb085" stroke="#111" stroke-width="2.5"/>
        <rect x="88" y="45" width="16" height="11" rx="5" fill="#ffb085" stroke="#111" stroke-width="2.5"/>
        <rect x="85" y="56" width="15" height="11" rx="5" fill="#ffb085" stroke="#111" stroke-width="2.5"/>
        <!-- 엄지손가락 -->
        <path d="M58 66 C58 55 78 55 82 66 C82 73 58 73 58 66 Z" fill="#f5a97f" stroke="#111" stroke-width="2.8"/>
        <!-- 주먹 전면 하이라이트 광택 -->
        <path d="M56 29 L78 29" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
      </svg>
    `;
  }

  // 타격 순간 맞는 얼굴 위에 터지는 코믹 폭발 이펙트 SVG
  function buildImpactBurstSVG(power) {
    const outerColor = power >= 4 ? '#e040fb' : '#ff1744';
    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,2 61,26 88,11 75,37 98,50 74,63 88,89 61,74 50,98 39,74 12,89 26,63 2,50 25,37 12,11 39,26"
                 fill="${outerColor}" stroke="#ffffff" stroke-width="2.5"/>
        <polygon points="50,16 58,34 78,24 67,42 84,50 67,58 78,76 58,66 50,84 42,66 22,76 33,58 16,50 33,42 22,24 42,34"
                 fill="#ffd600"/>
        <circle cx="50" cy="50" r="14" fill="#ffffff"/>
      </svg>
    `;
  }

  // 양쪽 상반신 포트레이트 상태 업데이트
  function updateBustPortraits(mine) {
    const oppTerritory = 10 - mine;
    if (bustPlayerSvg) {
      bustPlayerSvg.innerHTML = buildFighterBustSVG('PLAYER', mine);
    }
    if (bustAiSvg) {
      bustAiSvg.innerHTML = buildFighterBustSVG('AI', oppTerritory);
    }
    if (bustPlayer) {
      bustPlayer.classList.toggle('clean-glow', mine >= 6);
      bustPlayer.classList.toggle('danger-bruised', mine <= 4);
    }
    if (bustAi) {
      bustAi.classList.toggle('clean-glow', oppTerritory >= 6);
      bustAi.classList.toggle('danger-bruised', oppTerritory <= 4);
    }
  }

  // 이긴 상반신 캐릭터에서 진 상반신 캐릭터로 주먹이 날아가 때리는 애니메이션
  let punchAnimTimeoutId = null;
  function triggerPunchAnimation(delta, power = 1) {
    if (!delta || !flyingFist) return;
    clearTimeout(punchAnimTimeoutId);

    const isPlayerWin = delta > 0;
    const attackerBust = isPlayerWin ? bustPlayer : bustAi;
    const victimBust = isPlayerWin ? bustAi : bustPlayer;
    const victimImpact = isPlayerWin ? impactAi : impactPlayer;

    // 기존 애니메이션 클래스 초기화
    [bustPlayer, bustAi].forEach(el => {
      if (el) el.classList.remove('bust-attacking', 'bust-hit');
    });
    [impactPlayer, impactAi].forEach(el => {
      if (el) el.classList.add('hidden');
    });
    flyingFist.classList.remove('hidden', 'fly-to-right', 'fly-to-left');

    // 1. 공격자 상반신 돌진 모션 & 주먹 발사
    void flyingFist.offsetWidth;
    if (attackerBust) attackerBust.classList.add('bust-attacking');

    flyingFist.innerHTML = buildFlyingFistSVG(power, isPlayerWin);
    flyingFist.classList.add(isPlayerWin ? 'fly-to-right' : 'fly-to-left');

    // 2. 주먹이 상대 얼굴에 도달하는 순간(240ms) 타격 폭발 & 상처 업데이트!
    punchAnimTimeoutId = setTimeout(() => {
      flyingFist.classList.add('hidden');
      window.soundEngine.playPunchImpact(power);

      if (victimBust) {
        victimBust.classList.remove('bust-hit');
        void victimBust.offsetWidth;
        victimBust.classList.add('bust-hit');
      }
      if (victimImpact) {
        victimImpact.innerHTML = buildImpactBurstSVG(power);
        victimImpact.classList.remove('hidden');
        setTimeout(() => victimImpact.classList.add('hidden'), 460);
      }

      // 맞는 순간 땅 개수에 맞춰 패자는 상처가 늘어나고 승자는 깨끗해짐!
      const mine = Math.max(0, Math.min(10, 5 + state.pos));
      updateBustPortraits(mine);
    }, 240);
  }

  function updateBoard(deferBustToPunch = false) {
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

    // ★ [요구사항] 상단 캐릭터 표정: 5칸 이상 웃는 표정(🤠), 4칸 이하 우는 표정(😭)
    playerUnit.textContent = mine >= 5 ? '🤠' : '😭';

    // 상대 캐릭터 표정 (싱글: 보스 이모지, 멀티: 상대 영토 5칸 이상 🤠, 4칸 이하 😭)
    if (state.mode === 'SINGLE') {
      const stg = SINGLE_STAGES[state.currentStage - 1];
      aiUnit.textContent = stg ? stg.emoji : '🤖';
    } else {
      const oppTerritory = 10 - mine;
      aiUnit.textContent = oppTerritory >= 5 ? '🤠' : '😭';
    }

    if (!deferBustToPunch) {
      updateBustPortraits(mine);
    }

    // 1~10칸 뒷면 절벽 배경: 전진/후퇴 시 미세 패럴랙스 이동 및 양쪽 낭떠러지 위기 긴장감 연동
    if (cliffBackdrop) {
      const clampedPos = Math.max(-5, Math.min(5, state.pos));
      const bgShiftX = 50 + clampedPos * 2.2;
      cliffBackdrop.style.backgroundPosition = `center, center, ${bgShiftX}% 62%`;
      cliffBackdrop.classList.toggle('tension-left', mine <= 2);
      cliffBackdrop.classList.toggle('tension-right', mine >= 8);
      cliffBackdrop.classList.toggle('tension-critical', mine <= 1 || mine >= 9);
    }
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
    markGameActive('SINGLE');
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

    if (delta !== 0) {
      updateBoard(true);
      const hitPower = delta > 0 ? Math.max(pBet, Math.abs(delta)) : Math.max(aBet, Math.abs(delta));
      triggerPunchAnimation(delta, hitPower);
    } else {
      updateBoard(false);
    }
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
    markGameFinished();
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

      // ★ [요구사항] 멀티 게임 종료 후 선택 메뉴: 1. 재대결(30초 제한) / 2. 대기실로 돌아가기 / 3. 메인화면으로 돌아가기
      stopRematchCountdown();
      rematchSec = 30;
      rematchMyReady = false;
      rematchPeerReady = false;

      const btnRematch = document.createElement('button');
      btnRematch.className = 'primary-btn';
      rematchBtnEl = btnRematch;
      updateRematchButtonUI();

      btnRematch.onclick = () => {
        if (rematchMyReady) return;
        rematchMyReady = true;
        updateRematchButtonUI();

        sendMqttMessage({
          type: 'REMATCH_REQUEST',
          sender: state.isHost ? 'HOST' : 'GUEST',
          nick: userProfile.nickname
        });

        if (rematchPeerReady) {
          sendMqttMessage({ type: 'REMATCH_START' });
          startMultiRematchGame();
        } else {
          modalDesc.textContent = '재대결을 신청했습니다! 상대방이 재대결을 선택하면 즉시 시작됩니다.';
        }
      };

      const btnToLobby = document.createElement('button');
      btnToLobby.className = 'secondary-btn';
      btnToLobby.textContent = '대기실로 돌아가기 🌐';
      btnToLobby.onclick = () => {
        stopRematchCountdown();
        state.phase = 'IDLE';
        gameoverModal.classList.add('hidden');
        sendMqttMessage({
          type: 'POST_MATCH_EXIT',
          sender: state.isHost ? 'HOST' : 'GUEST'
        });
        leaveRoomClean();
        showScreen(screenLobby);
      };

      const btnToMain = document.createElement('button');
      btnToMain.className = 'secondary-btn';
      btnToMain.textContent = '메인화면으로 돌아가기 🏠';
      btnToMain.onclick = () => {
        stopRematchCountdown();
        state.phase = 'IDLE';
        gameoverModal.classList.add('hidden');
        sendMqttMessage({
          type: 'POST_MATCH_EXIT',
          sender: state.isHost ? 'HOST' : 'GUEST'
        });
        leaveRoomClean();
        showScreen(screenMain);
      };

      modalActionBtns.appendChild(btnRematch);
      modalActionBtns.appendChild(btnToLobby);
      modalActionBtns.appendChild(btnToMain);

      // 30초 안에 재대결이 성사되지 않으면 둘 다 자동으로 대기실로 이동
      rematchTimer = setInterval(() => {
        rematchSec--;
        updateRematchButtonUI();
        if (rematchSec <= 0) {
          stopRematchCountdown();
          if (state.phase === 'MATCH_OVER') {
            state.phase = 'IDLE';
            gameoverModal.classList.add('hidden');
            sendMqttMessage({
              type: 'POST_MATCH_EXIT',
              sender: state.isHost ? 'HOST' : 'GUEST'
            });
            leaveRoomClean();
            showScreen(screenLobby);
          }
        }
      }, 1000);
    }

    gameoverModal.classList.remove('hidden');
  }

  // --- 멀티플레이 재대결(30초 카운트다운 & 즉시 재시작 & 상대 퇴장 시 자동 대기실 복귀) ---
  let rematchTimer = null;
  let rematchSec = 30;
  let rematchMyReady = false;
  let rematchPeerReady = false;
  let rematchBtnEl = null;

  function stopRematchCountdown() {
    if (rematchTimer) {
      clearInterval(rematchTimer);
      rematchTimer = null;
    }
    rematchMyReady = false;
    rematchPeerReady = false;
    rematchBtnEl = null;
  }

  function updateRematchButtonUI() {
    if (!rematchBtnEl) return;
    if (rematchMyReady) {
      rematchBtnEl.textContent = `⏳ 상대방 선택 대기 중... (${rematchSec}초)`;
      rematchBtnEl.disabled = true;
      rematchBtnEl.style.opacity = '0.8';
    } else if (rematchPeerReady) {
      rematchBtnEl.textContent = `🔥 재대결 수락하기 (${rematchSec}초) - 상대 대기중!`;
      rematchBtnEl.disabled = false;
      rematchBtnEl.style.opacity = '1';
    } else {
      rematchBtnEl.textContent = `🔄 재대결 하기 (${rematchSec}초)`;
      rematchBtnEl.disabled = false;
      rematchBtnEl.style.opacity = '1';
    }
  }

  function startMultiRematchGame() {
    if (state.isGameActive) return;
    stopRematchCountdown();
    gameoverModal.classList.add('hidden');

    state.mode = 'MULTI';
    state.setWinsPlayer = 0;
    state.setWinsOpponent = 0;
    state.setHistory = [];
    state.multiChoices = { host: null, guest: null };

    markGameActive('MULTI');
    initSet(true);
  }

  function handlePeerLeftPostMatch() {
    if (state.phase !== 'MATCH_OVER') return;
    stopRematchCountdown();
    state.phase = 'IDLE';
    gameoverModal.classList.add('hidden');
    leaveRoomClean();
    showScreen(screenLobby);
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
            if (state.isGameActive) {
              handleOpponentForfeited('참여자가 게임 도중 나갔습니다.');
            } else if (state.phase === 'MATCH_OVER') {
              handlePeerLeftPostMatch();
            } else {
              alert('참여자가 방을 나갔습니다.');
              stopHostAutoStartCountdown();
              state.opponentNickname = '';
              waitGuestName.textContent = '유저 대기 중...';
              waitGuestAvatar.textContent = '⏳';
              btnHostStartGame.classList.add('hidden');
              waitStatusMsg.textContent = '다른 플레이어의 입장을 기다리고 있습니다...';
            }
          }
          break;

        // ★ [요구사항 4] 방장이 나가서 방이 폭파되었을 때 게스트 강제 퇴장
        case 'ROOM_CLOSED':
          if (!state.isHost) {
            if (state.isGameActive) {
              handleOpponentForfeited('방장이 게임 도중 방을 나가 방이 사라졌습니다.');
            } else if (state.phase === 'MATCH_OVER') {
              handlePeerLeftPostMatch();
            } else {
              alert('방장이 방을 나가 방이 사라졌습니다. 대기실로 이동합니다.');
              leaveRoomClean();
              showScreen(screenLobby);
            }
          }
          break;

        case 'POST_MATCH_EXIT':
          // 게임 종료 후 한 명이라도 대기실/메인화면 이동 선택 시 나머지 한 명도 자동으로 대기실로 이동
          if ((state.isHost && data.sender === 'GUEST') || (!state.isHost && data.sender === 'HOST')) {
            handlePeerLeftPostMatch();
          }
          break;

        case 'REMATCH_REQUEST':
          if ((state.isHost && data.sender === 'GUEST') || (!state.isHost && data.sender === 'HOST')) {
            if (state.phase === 'MATCH_OVER') {
              rematchPeerReady = true;
              if (rematchMyReady) {
                sendMqttMessage({ type: 'REMATCH_START' });
                startMultiRematchGame();
              } else {
                updateRematchButtonUI();
                modalDesc.textContent = `🔔 ${data.nick || '상대방'}님이 재대결을 신청했습니다! [재대결 수락하기]를 누르면 즉시 시작됩니다.`;
              }
            }
          }
          break;

        case 'REMATCH_START':
          if (state.phase === 'MATCH_OVER') {
            startMultiRematchGame();
          }
          break;

        case 'PLAYER_FORFEIT':
          // 상대방이 기권/이탈/창 닫기 등
          if ((state.isHost && data.sender === 'GUEST') || (!state.isHost && data.sender === 'HOST')) {
            handleOpponentForfeited(`${data.nick || '상대방'}님이 게임을 중단하고 나갔습니다.`);
          }
          break;

        case 'PEER_HEARTBEAT':
          if ((state.isHost && data.sender === 'GUEST') || (!state.isHost && data.sender === 'HOST')) {
            lastOpponentHeartbeat = Date.now();
          }
          break;

        case 'GAME_START':
          // 게스트 게임 시작 수신
          if (!state.isHost) {
            stopHostAutoStartCountdown();
            stopRematchCountdown();
            gameoverModal.classList.add('hidden');
            state.opponentNickname = data.hostNick;
            state.opponentBadge = data.hostBadge;
            screenWaiting.classList.add('hidden');
            state.mode = 'MULTI';
            state.setWinsPlayer = 0;
            state.setWinsOpponent = 0;
            state.setHistory = [];
            markGameActive('MULTI');
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
    markGameActive('MULTI');
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
    stopRematchCountdown();
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
      handleSurrenderOrExit();
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

  // 브라우저 닫기/새로고침/뒤로가기/비정상 종료 방어 리스너
  window.addEventListener('beforeunload', () => {
    if (state.isGameActive) {
      userProfile.losses = (userProfile.losses || 0) + 1;
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
        localStorage.removeItem(ACTIVE_GAME_KEY);
      } catch (e) {}
      if (state.mode === 'MULTI' && mqttClient && mqttClient.isConnected()) {
        try {
          sendMqttMessage({
            type: 'PLAYER_FORFEIT',
            sender: state.isHost ? 'HOST' : 'GUEST',
            nick: userProfile.nickname
          });
        } catch (e) {}
      }
    } else if (state.phase === 'MATCH_OVER' && state.mode === 'MULTI' && state.roomId && mqttClient && mqttClient.isConnected()) {
      try {
        sendMqttMessage({
          type: 'POST_MATCH_EXIT',
          sender: state.isHost ? 'HOST' : 'GUEST'
        });
        leaveRoomClean();
      } catch (e) {}
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.isGameActive) {
      userProfile.losses = (userProfile.losses || 0) + 1;
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
        localStorage.removeItem(ACTIVE_GAME_KEY);
      } catch (e) {}
    }
  });

  window.addEventListener('popstate', () => {
    if (state.isGameActive) {
      if (confirm('게임을 중단하고 뒤로 가시겠습니까? (중단 시 1패가 추가됩니다)')) {
        handleSurrenderOrExit();
      } else {
        history.pushState({ inGame: true }, '');
      }
    }
  });

  // 초기화 실행
  initTiles();
  initMainScreen();
  showScreen(screenMain);
});
