// ========================================================
// 다국어 지원 모듈 (한국어 / English)
// - 최초 접속 시 기기 언어 자동 감지 (한국어 -> ko, 그 외 -> en)
// - 메인 화면 상단 우측 한글 / ENG 버튼으로 즉시 전환
// ========================================================
(function () {
  const LANG_KEY = 'jump2you_lang_v1';

  const DICT = {
    ko: {
      pageTitle: '낭떠러지 가위바위보 - Full Edition',
      mainTitle: '낭떠러지 가위바위보',
      mainSubtitle: '영토 점령 가위바위보 심리 대전',
      nicknameLabel: '도전자 닉네임',
      nicknamePlaceholder: '닉네임을 입력하세요 (최대 8자)',
      rankLabel: '현재 등급:',
      singleBtnTitle: '싱글 챌린지 (1~10단계)',
      singleBtnDesc: '3판 2승제 보스전 • 별/다이아 마크 도전',
      multiBtnTitle: '멀티플레이 대전 (온라인)',
      multiBtnDesc: '실시간 1:1 온라인 방 생성 및 대전',
      rulesBtnTitle: '게임 규칙 보기',
      rulesBtnDesc: '파워별 전진/후퇴 및 필살기 핵심 가이드',
      footerTag: '낭떠러지 가위바위보 • v2.6 Edition',

      // 로비 & 대기방
      lobbyTitle: '🌐 멀티플레이 대기실',
      netOnline: '온라인 연결됨',
      netLost: '연결 끊김 (재접속 중)',
      netFail: '연결 실패 (재시도)',
      btnCreateRoom: '➕ 방 만들기',
      btnRefresh: '🔄 새로고침',
      emptyRoomMsg: '개설된 방이 없습니다.<br>직접 방을 만들어 다른 유저를 기다려 보세요!',
      roleHost: '방장',
      roleGuest: '참가자',
      guestWaiting: '유저 대기 중...',
      waitOtherPlayer: '다른 플레이어의 입장을 기다리고 있습니다...',
      waitGuestJoinedHost: '상대방이 입장했습니다! 30초 안에 시작을 누르세요.',
      waitJoinedGuest: '방에 접속했습니다. 방장의 시작을 기다리는 중...',
      waitHostCountdown: '방장이 게임 시작을 누르기를 기다리고 있습니다... ({sec}초)',
      btnStartHost: '🔥 게임 시작 ({sec}초)',
      btnLeaveRoom: '방 나가기',
      btnJoinRoom: '입장 ➔',
      roomHostPrefix: '방장:',
      lobbyMyPrefix: '나:',
      defaultRoomTitle: '{nick}의 한판 승부!',
      fallbackRoomTitle: '즐거운 가위바위보 방',

      // 인게임 UI
      bo3Badge: '3판 2승제',
      step1Pill: '⚡ 1단계 파워결정',
      step2Pill: '✌️ 2단계 가위바위보 결정',
      p1Label: '약파워',
      p2Label: '중파워',
      p3Label: '강파워',
      p4Label: '필살기',
      p4Chip: '⚡필살기',
      handScissors: '가위',
      handRock: '바위',
      handPaper: '보',
      meLabel: '나',
      oppLabel: '상대',
      winUnit: '승',
      recordFmt: '{w}승 {l}패',
      singleStageHeader: '싱글 {stage}단계: {name}',
      multiStageHeader: '멀티 대전 vs {opp}',

      // 등급
      tierMaster: '가위바위보 달인 💎',
      tier8: '절벽의 정복자 ⭐⭐⭐',
      tier5: '강철의 파이터 ⭐⭐',
      tier3: '바위산 수련생 ⭐',
      tier1: '새내기 도전자',

      // 라운드/세트 결과
      resWin: '이겼다!',
      resLose: '졌다!',
      resDraw: '비겼다!',
      resTimeout: '시간 초과!',
      subAdvance: '+{n}칸 전진',
      subRetreat: '{n}칸 후퇴',
      subNoMove: '이동 없음',
      subTimeout: '약파워 패배 ({n}칸 후퇴)',
      setScoreSub: '현재 스코어: 나 {my}승 : {opp}승 상대',
      set1W: '1승!',
      set1L: '1패!',
      set1W1L: '1승 1패!',
      set2W: '2승!',
      set2L: '2패!',
      set2W1L: '2승 1패!',
      set1W2L: '1승 2패!',
      setFallback: '{my}승 {opp}패!',

      // 모달
      createRoomTitle: '➕ 멀티플레이 방 만들기',
      roomTitlePlaceholder: '방 제목을 입력하세요',
      btnCreateConfirm: '방 생성',
      btnCancel: '취소',

      // 매치 종료 모달
      masterTitle: '가위바위보 달인에 등극하였습니다!',
      masterDesc: '10단계 가위바위보 황제를 꺾고 💎 다이아몬드 마크를 획득하셨습니다!',
      masterSpeak: '가위바위보 달인에 등극하였습니다!',
      stageWinTitle: '{stage}단계 승리!{bonus}',
      stageWinDesc: '3판 2승으로 승리했습니다! 다음 단계로 도전하세요.',
      bonus3: ' (⭐ 별 마크 획득!)',
      bonus5: ' (⭐⭐ 별 2개 마크 획득!)',
      bonus8: ' (⭐⭐⭐ 별 3개 마크 획득!)',
      stageLoseTitle: '{stage}단계 패배...',
      stageLoseDesc: '아쉽게도 3판 2승 승부에서 패배했습니다.',
      multiWinTitle: '멀티 대전 최종 승리!',
      multiWinDesc: '{opp}님과의 3판 2승 승부에서 승리했습니다!',
      multiLoseTitle: '멀티 대전 최종 패배',
      multiLoseDesc: '{opp}님에게 패배했습니다.',
      speakWin: '승리',
      speakLose: '패배',
      speakFinalWin: '최종 승리',
      speakFinalLose: '최종 패배',
      speakForfeitWin: '상대방 기권으로 승리하였습니다',
      btnRestart1: '1단계부터 다시 시작 🔥',
      btnRestart1Retry: '1단계부터 다시 시작 🔄',
      btnNextStage: '다음 단계로 진행 ({stage}단계) ➔',
      btnToMain: '메인화면으로 돌아가기 🏠',
      btnToLobby: '대기실로 돌아가기 🌐',
      btnRematch: '🔄 재대결 하기 ({sec}초)',
      btnRematchAccept: '🔥 재대결 수락하기 ({sec}초) - 상대 대기중!',
      btnRematchWait: '⏳ 상대방 선택 대기 중... ({sec}초)',
      rematchRequestedDesc: '재대결을 신청했습니다! 상대방이 재대결을 선택하면 즉시 시작됩니다.',
      rematchIncomingDesc: '🔔 {nick}님이 재대결을 신청했습니다! [재대결 수락하기]를 누르면 즉시 시작됩니다.',

      // 규칙 모달
      rulesModalTitle: '📜 낭떠러지 가위바위보 규칙',
      rulesGoalTitle: '🎯 게임 목표 (3판 2승제)',
      rulesGoalDesc: '가위바위보 심리전으로 상대를 밀어내어 <b>절벽(5칸) 아래로 떨어뜨리면 세트 승리!</b> 먼저 2세트를 따내는 플레이어가 최종 승리합니다.',
      rulesPowerTitle: '⚡ 1단계: 파워 선택 및 전진 / 후퇴 규칙',
      tblPower: '파워 종류',
      tblPush: '전진력',
      tblLimit: '1판 제한',
      tblRule: '승/패/무 이동 규칙',
      tblP1: '🟢 약파워',
      tblP2: '🟠 중파워',
      tblP3: '🔴 강파워',
      tblP4: '⚡ 필살기',
      tblStep1: '+1칸',
      tblStep2: '+2칸',
      tblStep3: '+3칸',
      tblStep4: '+4칸',
      tblUnlim: '무제한',
      tblLim7: '7회',
      tblLim5: '5회',
      tblLim3: '3회',
      tblRule1: '승리 시 <b>+1칸 전진</b> / 패배 시 <b>상대 파워만큼 후퇴</b>',
      tblRule2: '승리 시 <b>+2칸 전진</b> / 패배 시 <b>상대 파워만큼 후퇴</b>',
      tblRule3: '승리 시 <b>+3칸 전진</b> / 패배 시 <b>상대 파워만큼 후퇴</b>',
      tblRule4: '상대 3연속 약파워 시 활성화! 승리 시 <b>+4칸 대량 전진</b>',
      rulesDrawTitle: '⚖️ 비겼을 때 (무승부 심리 카운터)',
      rulesDrawDesc: '• 가위바위보를 비기면 <b>더 낮은 파워를 낸 쪽이 파워 차이만큼 상대를 밀어냅니다!</b>',
      rulesDrawTip: '💡 예: 상대가 [강파워(3)] vs 내가 [약파워(1)]로 비기면 ➔ <b>내가 2칸 전진!</b> (파워가 같으면 이동 없음)',
      rulesPenaltyTitle: '⏱️ 타임아웃 & 페널티 규칙',
      rulesPenalty1: '• <b>15초 내 미선택</b>: 약파워(1칸)로 강제 패배 처리됩니다.',
      rulesPenalty2: '• <b>게임 중도 이탈</b>: 경기 도중 나가면 <b>1패가 추가</b>됩니다.',
      rulesPenalty3: '• <b>싱글 모드</b>: 새 게임은 항상 1단계부터 시작하며, 3/5/8/10단계 클리어 시 <b>⭐ 별 및 💎 다이아 마크</b>가 영구 유지됩니다.',
      btnCloseRules: '확인 및 닫기',

      // 알림 & 확인창
      alertEnterNick: '닉네임을 입력해 주세요!',
      alertAbruptExit: '이전 게임의 비정상 종료(창 닫기/강제 종료 등)가 감지되어 1패가 추가되었습니다.',
      alertNoMid: '이번 판의 중파워(7회)를 모두 사용했습니다!',
      alertNoHard: '이번 판의 강파워(5회)를 모두 사용했습니다!',
      alertNoUlt: '상대방이 약파워를 3회 연속 사용할 때 필살기(3회)가 열립니다!',
      titleUltReady: '⚡필살기 사용 가능! (남은 횟수: {cnt}회)',
      titleUltLocked: '상대 3연속 약파워 시 3회 활성화',
      confirmExitGame: '게임을 중단하고 나가시겠습니까? (중단 시 1패가 추가됩니다)',
      confirmBackGame: '게임을 중단하고 뒤로 가시겠습니까? (중단 시 1패가 추가됩니다)',
      alertGuestLeftWait: '참여자가 방을 나갔습니다.',
      alertRoomClosedWait: '방장이 방을 나가 방이 사라졌습니다. 대기실로 이동합니다.',
      reasonGuestLeftGame: '참여자가 게임 도중 나갔습니다.',
      reasonHostLeftGame: '방장이 게임 도중 방을 나가 방이 사라졌습니다.',
      reasonPeerForfeit: '{nick}님이 게임을 중단하고 나갔습니다.',
      reasonPeerDisconnect: '상대방과의 연결이 끊어졌거나 창을 닫았습니다 (비정상 종료).',
      alertForfeitWin: '{reason}\n\n[몰수승] 1승이 추가되었으며 대기실로 이동합니다!'
    },

    en: {
      pageTitle: 'Cliff RPS - Full Edition',
      mainTitle: 'Cliff RPS Battle',
      mainSubtitle: 'Territory Mind-Game RPS',
      nicknameLabel: 'Nickname',
      nicknamePlaceholder: 'Enter nickname (max 8)',
      rankLabel: 'Rank:',
      singleBtnTitle: 'Single Mode (Lv.1~10)',
      singleBtnDesc: 'Best-of-3 Bosses • Earn Badges',
      multiBtnTitle: 'Online Multiplayer',
      multiBtnDesc: 'Real-time 1v1 Room Battle',
      rulesBtnTitle: 'How to Play',
      rulesBtnDesc: 'Power & Special Move Guide',
      footerTag: 'Cliff RPS • v2.6 Edition',

      // Lobby & Waiting Room
      lobbyTitle: '🌐 Online Lobby',
      netOnline: 'Online',
      netLost: 'Reconnecting...',
      netFail: 'Retrying...',
      btnCreateRoom: '➕ Create Room',
      btnRefresh: '🔄 Refresh',
      emptyRoomMsg: 'No rooms available.<br>Create a room and wait for a challenger!',
      roleHost: 'HOST',
      roleGuest: 'GUEST',
      guestWaiting: 'Waiting...',
      waitOtherPlayer: 'Waiting for an opponent...',
      waitGuestJoinedHost: 'Opponent joined! Start within 30s.',
      waitJoinedGuest: 'Joined! Waiting for host to start...',
      waitHostCountdown: 'Waiting for host to start... ({sec}s)',
      btnStartHost: '🔥 Start ({sec}s)',
      btnLeaveRoom: 'Leave Room',
      btnJoinRoom: 'Join ➔',
      roomHostPrefix: 'Host:',
      lobbyMyPrefix: 'Me:',
      defaultRoomTitle: "{nick}'s Room",
      fallbackRoomTitle: 'RPS Battle Room',

      // In-Game UI
      bo3Badge: 'Best of 3',
      step1Pill: '⚡ Step 1: Power',
      step2Pill: '✌️ Step 2: RPS Hand',
      p1Label: 'Weak',
      p2Label: 'Mid',
      p3Label: 'Hard',
      p4Label: 'ULT',
      p4Chip: '⚡ULT',
      handScissors: 'Scissors',
      handRock: 'Rock',
      handPaper: 'Paper',
      meLabel: 'Me',
      oppLabel: 'Foe',
      winUnit: 'W',
      recordFmt: '{w}W {l}L',
      singleStageHeader: 'Lv.{stage}: {name}',
      multiStageHeader: 'Online vs {opp}',

      // Tiers
      tierMaster: 'RPS Master 💎',
      tier8: 'Cliff Conqueror ⭐⭐⭐',
      tier5: 'Iron Fighter ⭐⭐',
      tier3: 'Stone Fighter ⭐',
      tier1: 'Rookie',

      // Round / Set Results
      resWin: 'WIN!',
      resLose: 'LOSE!',
      resDraw: 'DRAW!',
      resTimeout: 'TIME UP!',
      subAdvance: '+{n} Push',
      subRetreat: '{n} Back',
      subNoMove: 'No Move',
      subTimeout: 'Timeout (-{n} Back)',
      setScoreSub: 'Score: Me {my}W : {opp}W Foe',
      set1W: '1 WIN!',
      set1L: '1 LOSS!',
      set1W1L: '1W 1L!',
      set2W: '2 WINS!',
      set2L: '2 LOSSES!',
      set2W1L: '2W 1L!',
      set1W2L: '1W 2L!',
      setFallback: '{my}W {opp}L!',

      // Modals
      createRoomTitle: '➕ Create Room',
      roomTitlePlaceholder: 'Enter room title',
      btnCreateConfirm: 'Create',
      btnCancel: 'Cancel',

      // Match Over Modal
      masterTitle: 'You are the RPS Master!',
      masterDesc: 'You defeated Lv.10 Emperor and earned the 💎 Diamond Badge!',
      masterSpeak: 'You are the RPS Master!',
      stageWinTitle: 'Lv.{stage} Clear!{bonus}',
      stageWinDesc: 'You won Best-of-3! Advance to the next boss.',
      bonus3: ' (⭐ 1-Star Earned!)',
      bonus5: ' (⭐⭐ 2-Stars Earned!)',
      bonus8: ' (⭐⭐⭐ 3-Stars Earned!)',
      stageLoseTitle: 'Lv.{stage} Defeat...',
      stageLoseDesc: 'You lost the Best-of-3 match.',
      multiWinTitle: 'Online Victory!',
      multiWinDesc: 'You defeated {opp} in Best-of-3!',
      multiLoseTitle: 'Online Defeat',
      multiLoseDesc: 'You lost to {opp}.',
      speakWin: 'Victory',
      speakLose: 'Defeat',
      speakFinalWin: 'Final Victory',
      speakFinalLose: 'Final Defeat',
      speakForfeitWin: 'Opponent forfeited. You win!',
      btnRestart1: 'Restart Lv.1 🔥',
      btnRestart1Retry: 'Restart Lv.1 🔄',
      btnNextStage: 'Next Stage (Lv.{stage}) ➔',
      btnToMain: 'Main Menu 🏠',
      btnToLobby: 'Back to Lobby 🌐',
      btnRematch: '🔄 Rematch ({sec}s)',
      btnRematchAccept: '🔥 Accept Rematch ({sec}s)!',
      btnRematchWait: '⏳ Waiting for Foe... ({sec}s)',
      rematchRequestedDesc: 'Rematch requested! Starts as soon as opponent accepts.',
      rematchIncomingDesc: '🔔 {nick} wants a rematch! Tap [Accept Rematch] to start.',

      // Rules Modal (Concise for clean fit)
      rulesModalTitle: '📜 Cliff RPS Rules',
      rulesGoalTitle: '🎯 Goal (Best of 3)',
      rulesGoalDesc: 'Push your foe <b>5 tiles off the cliff to win a set!</b> First to win 2 sets wins the match.',
      rulesPowerTitle: '⚡ Step 1: Power & Movement',
      tblPower: 'Power',
      tblPush: 'Push',
      tblLimit: 'Limit',
      tblRule: 'Win / Lose Movement',
      tblP1: '🟢 Weak',
      tblP2: '🟠 Mid',
      tblP3: '🔴 Hard',
      tblP4: '⚡ ULT',
      tblStep1: '+1',
      tblStep2: '+2',
      tblStep3: '+3',
      tblStep4: '+4',
      tblUnlim: '∞',
      tblLim7: '7',
      tblLim5: '5',
      tblLim3: '3',
      tblRule1: 'Win <b>+1 tile</b> / Lose <b>retreat by foe power</b>',
      tblRule2: 'Win <b>+2 tiles</b> / Lose <b>retreat by foe power</b>',
      tblRule3: 'Win <b>+3 tiles</b> / Lose <b>retreat by foe power</b>',
      tblRule4: 'Unlocks after foe uses 3x Weak! Win <b>+4 tiles</b>',
      rulesDrawTitle: '⚖️ Draw Counter Rule',
      rulesDrawDesc: '• On a tie, the <b>lower power wins and pushes by the power difference!</b>',
      rulesDrawTip: '💡 Ex: Foe [Hard(3)] vs You [Weak(1)] tie ➔ <b>You push +2!</b> (Same power = no move)',
      rulesPenaltyTitle: '⏱️ Timeout & Penalties',
      rulesPenalty1: '• <b>15s Timeout</b>: Auto-lose with Weak power.',
      rulesPenalty2: '• <b>Quit Mid-Game</b>: Counts as <b>1 Loss</b> (foe wins in online).',
      rulesPenalty3: '• <b>Single Mode</b>: Always starts at Lv.1. <b>⭐ & 💎 badges</b> are kept forever!',
      btnCloseRules: 'Got It',

      // Alerts & Confirms
      alertEnterNick: 'Please enter a nickname!',
      alertAbruptExit: 'Abrupt exit detected from last match. +1 Loss added.',
      alertNoMid: 'No Mid power left for this set (7/7 used)!',
      alertNoHard: 'No Hard power left for this set (5/5 used)!',
      alertNoUlt: 'ULT (3 uses) unlocks when your foe uses Weak 3 times in a row!',
      titleUltReady: '⚡ULT Ready! ({cnt} left)',
      titleUltLocked: 'Unlocks after foe uses Weak 3x in a row',
      confirmExitGame: 'Quit this match? (Counts as 1 Loss)',
      confirmBackGame: 'Leave this match? (Counts as 1 Loss)',
      alertGuestLeftWait: 'Opponent left the room.',
      alertRoomClosedWait: 'Host closed the room. Returning to lobby.',
      reasonGuestLeftGame: 'Opponent left during the match.',
      reasonHostLeftGame: 'Host left during the match.',
      reasonPeerForfeit: '{nick} forfeited the match.',
      reasonPeerDisconnect: 'Opponent disconnected or closed the browser.',
      alertForfeitWin: '{reason}\n\n[Forfeit Win] +1 Win added! Returning to lobby.'
    }
  };

  function detectInitialLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (e) {}
    const navLang = (
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      navigator.userLanguage ||
      ''
    ).toLowerCase();
    return navLang.startsWith('ko') ? 'ko' : 'en';
  }

  let currentLang = detectInitialLang();

  function t(key, vars = {}) {
    const pack = DICT[currentLang] || DICT.ko;
    let str = pack[key] !== undefined ? pack[key] : (DICT.ko[key] || key);
    Object.keys(vars).forEach(k => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
    });
    return str;
  }

  function applyStaticI18n() {
    document.documentElement.lang = currentLang;
    document.title = t('pageTitle');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    const btnKo = document.getElementById('btn-lang-ko');
    const btnEn = document.getElementById('btn-lang-en');
    if (btnKo) btnKo.classList.toggle('active', currentLang === 'ko');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');
  }

  function setLang(lang, persist = true) {
    if (lang !== 'ko' && lang !== 'en') return;
    currentLang = lang;
    if (persist) {
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    }
    applyStaticI18n();
  }

  window.I18N = {
    get lang() { return currentLang; },
    t,
    setLang,
    applyStaticI18n,
    getPowerName(bet) {
      if (bet === 1) return t('p1Label');
      if (bet === 2) return t('p2Label');
      if (bet === 3) return t('p3Label');
      return t('p4Chip');
    }
  };
})();
