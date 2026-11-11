// ==========================================
// 낭떠러지 줄다리기 가위바위보 - 5:5 영토 대전 엔진
// 20초 결정 / 10초 결과 노출 / 실시간 빨강·파랑 영토 색상화
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // --- 게임 상태 ---
  const gameState = {
    // currentPos: -5 ~ +5 (기본 0: 5대 5 균형)
    // playerCount = 5 + currentPos (내가 차지한 칸 수: 0 ~ 10)
    currentPos: 0,
    round: 1,
    playerWins: 0,
    aiWins: 0,
    playerBet: 1,         // 1: 약파워, 2: 중파워, 3: 강파워
    aiBet: 1,
    selectedHand: null,
    aiHand: null,
    phase: 'IDLE',        // 'IDLE' | 'ROUND_ACTIVE' | 'SHOWING_RESULT' | 'GAMEOVER'
    history: [],
    countersCount: 0,
    maxPushInMatch: 0,
    roundMoves: 0
  };

  const HAND_KEYS = ['scissors', 'rock', 'paper'];
  const HANDS = {
    scissors: { name: '가위', emoji: '✌️', beats: 'paper' },
    rock: { name: '바위', emoji: '✊', beats: 'scissors' },
    paper: { name: '보', emoji: '🖐️', beats: 'rock' }
  };

  const POWER_NAMES = {
    1: '약파워 (1칸)',
    2: '중파워 (2칸)',
    3: '강파워 (3칸)'
  };

  // 타이머 & 인터벌 참조 (20초 결정 / 10초 결과 노출)
  let shuffleIntervalId = null;
  let countdownTimerId = null;
  let cooldownTimerId = null;
  let roundTimeLeftMs = 20000;   // 20초 결정 시간
  let cooldownTimeLeftMs = 10000; // 10초 결과 노출 시간

  let pShuffleIdx = 0;
  let aShuffleIdx = 1;

  // --- DOM 요소 캐싱 ---
  // 상단 다리
  const tilesContainer = document.getElementById('tiles-container');
  const ropeCenterMarker = document.getElementById('rope-center-marker');
  const playerUnit = document.getElementById('player-unit');
  const aiUnit = document.getElementById('ai-unit');
  const dangerLeft = document.getElementById('danger-left');
  const dangerRight = document.getElementById('danger-right');
  const gameContainer = document.getElementById('game-container');

  // 헤더
  const roundNumEl = document.getElementById('round-num');
  const winRecordEl = document.getElementById('win-record');
  const territoryScoreEl = document.getElementById('territory-score');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnRulesOpen = document.getElementById('btn-rules-open');
  const btnResetGame = document.getElementById('btn-reset-game');

  // 쇼다운 아레나
  const timerBarFill = document.getElementById('timer-bar-fill');
  const timerMessage = document.getElementById('timer-message');
  const timerSeconds = document.getElementById('timer-seconds');
  const playerFighterZone = document.getElementById('player-fighter-zone');
  const aiFighterZone = document.getElementById('ai-fighter-zone');
  const playerHandCard = document.getElementById('player-hand-card');
  const aiHandCard = document.getElementById('ai-hand-card');
  const playerHandSymbol = document.getElementById('player-hand-symbol');
  const aiHandSymbol = document.getElementById('ai-hand-symbol');
  const playerHandBadge = document.getElementById('player-hand-badge');
  const aiHandBadge = document.getElementById('ai-hand-badge');
  const judgementMain = document.getElementById('judgement-main');
  const judgementSub = document.getElementById('judgement-sub');
  const counterSpecialTag = document.getElementById('counter-special-tag');
  const counterTagText = document.getElementById('counter-tag-text');
  const cooldownPill = document.getElementById('cooldown-pill');
  const cooldownSeconds = document.getElementById('cooldown-seconds');

  // 좌측 하단 미니 파워 카드
  const playerPowerTag = document.getElementById('player-power-tag');
  const pMiniBars = document.querySelectorAll('#p-mini-meter .mini-bar');
  const aiPowerTag = document.getElementById('ai-power-tag');
  const aiMiniBars = document.querySelectorAll('#ai-mini-meter .mini-bar');

  // 하단 조작 패널
  const startBtnBar = document.getElementById('start-btn-bar');
  const btnStartGame = document.getElementById('btn-start-game');
  const decisionPanel = document.getElementById('decision-panel');
  const powerButtons = document.querySelectorAll('.power-btn');
  const rectHandButtons = document.querySelectorAll('.rect-hand-btn');

  // 모달
  const gameoverModal = document.getElementById('gameover-modal');
  const modalTrophy = document.getElementById('modal-trophy');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const sumRounds = document.getElementById('sum-rounds');
  const sumCounters = document.getElementById('sum-counters');
  const sumMaxMove = document.getElementById('sum-max-move');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const rulesModal = document.getElementById('rules-modal');
  const btnCloseRules = document.getElementById('btn-close-rules');

  // --- 1. 상단 10칸 다리 렌더링 ---
  function initTenTiles() {
    tilesContainer.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile-block';
      tile.dataset.tileIndex = i;

      // 1번 칸과 10번 칸은 극한의 마지막 칸!
      if (i === 1) tile.classList.add('last-tile-player');
      if (i === 10) tile.classList.add('last-tile-ai');

      tile.innerHTML = `
        <span class="tile-num">${i}</span>
        <span class="tile-side-hint">-</span>
      `;
      tilesContainer.appendChild(tile);
    }
  }

  // --- 2. 깃발 위치 & 실시간 영토 색상화 (빨간색 vs 파란색) ---
  function updateBoardPositions(animated = true) {
    const pos = gameState.currentPos; // -5 ~ +5
    const myCount = Math.max(0, Math.min(10, 5 + pos)); // 내가 차지한 칸 수 (0~10)
    const aiCount = 10 - myCount; // 상대편이 차지한 칸 수

    // 상단 전광판 텍스트 업데이트
    if (territoryScoreEl) {
      territoryScoreEl.textContent = `🔴 나 ${myCount} : ${aiCount} 상대 🔵`;
    }

    // 10개 칸 색상 동적 적용:
    // 1번부터 myCount번 칸까지는 [내가 차지한 땅: 빨간색]
    // myCount + 1번부터 10번 칸까지는 [상대편이 차지한 땅: 파란색]
    const allTiles = document.querySelectorAll('.tile-block');
    allTiles.forEach((tile) => {
      const idx = parseInt(tile.dataset.tileIndex, 10);
      const hintSpan = tile.querySelector('.tile-side-hint');

      tile.classList.remove('captured-player', 'captured-ai');

      if (idx <= myCount) {
        // 내가 차지한 땅: 빨간색
        tile.classList.add('captured-player');
        if (hintSpan) {
          hintSpan.textContent = idx === 1 ? '💀최후선' : '내영토🔴';
        }
      } else {
        // 상대편이 차지한 땅: 파란색
        tile.classList.add('captured-ai');
        if (hintSpan) {
          hintSpan.textContent = idx === 10 ? '💀적절벽' : '적영토🔵';
        }
      }
    });

    // 깃발 위치: myCount 칸의 끝 경계면에 정확히 위치
    // 0칸일 때 5%, 5칸일 때 50%, 10칸일 때 95%
    const boundaryPercent = Math.max(4, Math.min(96, (myCount / 10) * 100));
    ropeCenterMarker.style.left = `${boundaryPercent}%`;

    // 캐릭터 위치
    const pPercent = Math.max(2, boundaryPercent - 8);
    const aPercent = Math.min(98, boundaryPercent + 8);
    playerUnit.style.left = `${pPercent}%`;
    aiUnit.style.left = `${aPercent}%`;

    // 위험 경고 (내 땅이 1칸 이하이거나 상대 땅이 1칸 이하일 때)
    if (myCount <= 1) dangerLeft.classList.add('active');
    else dangerLeft.classList.remove('active');

    if (aiCount <= 1) dangerRight.classList.add('active');
    else dangerRight.classList.remove('active');
  }

  // --- 3. 좌측 하단 미니 파워 표시 ---
  function renderPlayerPowerUI(power) {
    gameState.playerBet = power;
    playerPowerTag.textContent = POWER_NAMES[power];

    pMiniBars.forEach((bar, idx) => {
      if (idx < power) bar.classList.add('active');
      else bar.classList.remove('active');
    });

    powerButtons.forEach(btn => {
      if (parseInt(btn.dataset.bet, 10) === power) btn.classList.add('selected');
      else btn.classList.remove('selected');
    });
  }

  function renderAiPowerUI(power, isRevealed = false) {
    if (!isRevealed) {
      aiPowerTag.textContent = '? (결정 시 공개)';
      aiMiniBars.forEach(b => b.classList.remove('active'));
    } else {
      aiPowerTag.textContent = POWER_NAMES[power];
      aiMiniBars.forEach((bar, idx) => {
        if (idx < power) bar.classList.add('active');
        else bar.classList.remove('active');
      });
    }
  }

  // --- 4. AI 심리전 로직 ---
  function getAiDecision() {
    const cur = gameState.currentPos;
    const history = gameState.history;
    let aiBet = 2;

    const recentPlayerBets = history.slice(-3).map(h => h.playerBet);
    const frequentHigh = recentPlayerBets.filter(b => b === 3).length >= 2;

    if (cur >= 3) {
      // AI 절벽 위기: 3칸 강파워로 발악 or 1칸 약파워 카운터
      aiBet = Math.random() < 0.6 ? 3 : 1;
    } else if (cur <= -3) {
      // AI 승기 상황: 3칸 강파워 마무리 or 2칸 중파워
      aiBet = Math.random() < 0.55 ? 3 : 2;
    } else if (frequentHigh) {
      // 상대의 강파워를 흘리기 위한 약파워 카운터
      aiBet = Math.random() < 0.65 ? 1 : 2;
    } else {
      const r = Math.random();
      if (r < 0.3) aiBet = 1;
      else if (r < 0.75) aiBet = 2;
      else aiBet = 3;
    }

    let aiHand = HAND_KEYS[Math.floor(Math.random() * HAND_KEYS.length)];
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last.winner === 'player' && Math.random() < 0.5) {
        aiHand = Object.keys(HANDS).find(k => HANDS[k].beats === last.playerHand);
      }
    }

    return { aiBet, aiHand };
  }

  function judgeRPS(pHand, aHand) {
    if (pHand === aHand) return 'draw';
    if (HANDS[pHand].beats === aHand) return 'win';
    return 'lose';
  }

  // ==========================================
  // [라운드 시작]: 20초 카운트다운 & 셔플링
  // ==========================================
  function startRoundCountdown() {
    gameState.phase = 'ROUND_ACTIVE';
    gameState.roundMoves++;

    startBtnBar.classList.add('hidden');
    decisionPanel.classList.remove('disabled');
    rectHandButtons.forEach(btn => btn.disabled = false);
    powerButtons.forEach(btn => btn.disabled = false);

    playerFighterZone.classList.remove('winner-highlight');
    aiFighterZone.classList.remove('winner-highlight');
    counterSpecialTag.classList.add('hidden');
    cooldownPill.classList.add('hidden');

    playerHandBadge.textContent = '선택 대기중 (손 클릭!)';
    aiHandBadge.textContent = '가위바위보 중...';

    judgementMain.textContent = '가위~ 바위~ 보!';
    judgementMain.style.color = '#ffd600';
    judgementSub.textContent = '20초 안에 파워와 가위바위보를 결정하세요!';

    renderAiPowerUI(0, false);

    playerHandCard.classList.add('shuffling');
    aiHandCard.classList.add('shuffling');

    window.soundEngine.playRPSVoiceMelody();

    // 셔플 애니메이션
    clearInterval(shuffleIntervalId);
    let tickCounter = 0;
    shuffleIntervalId = setInterval(() => {
      pShuffleIdx = (pShuffleIdx + 1) % HAND_KEYS.length;
      aShuffleIdx = (aShuffleIdx + 1) % HAND_KEYS.length;

      playerHandSymbol.textContent = HANDS[HAND_KEYS[pShuffleIdx]].emoji;
      aiHandSymbol.textContent = HANDS[HAND_KEYS[aShuffleIdx]].emoji;

      tickCounter++;
      if (tickCounter % 2 === 0) {
        window.soundEngine.playShuffleTick();
      }
    }, 70);

    // ★ [요구사항 1]: 20초 카운트다운 타이머
    roundTimeLeftMs = 20000;
    timerBarFill.className = 'timer-bar-fill';
    timerBarFill.style.width = '100%';
    timerMessage.textContent = '20초 안에 파워와 가위바위보를 결정하세요!';

    clearInterval(countdownTimerId);
    const tickInterval = 100;

    countdownTimerId = setInterval(() => {
      roundTimeLeftMs -= tickInterval;

      const secondsFloat = Math.max(0, roundTimeLeftMs / 1000).toFixed(1);
      timerSeconds.textContent = `${secondsFloat}s`;

      const pct = Math.max(0, (roundTimeLeftMs / 20000) * 100);
      timerBarFill.style.width = `${pct}%`;

      // 5초 이하일 때 긴박 경고 상태
      if (roundTimeLeftMs <= 5000) {
        timerBarFill.classList.add('urgent');
        if (Math.round(roundTimeLeftMs) % 500 === 0) {
          window.soundEngine.playTimerTick(true);
        }
      }

      // 20초 시간 초과 시 자동 결정
      if (roundTimeLeftMs <= 0) {
        clearInterval(countdownTimerId);
        const autoHand = HAND_KEYS[pShuffleIdx];
        resolveDecision(autoHand, true);
      }
    }, tickInterval);
  }

  // ==========================================
  // [결정 및 판가름]: 가위바위보 버튼 클릭 시 즉시 실행
  // ==========================================
  function resolveDecision(playerHand, isTimeOut = false) {
    if (gameState.phase !== 'ROUND_ACTIVE') return;
    gameState.phase = 'SHOWING_RESULT';

    clearInterval(shuffleIntervalId);
    clearInterval(countdownTimerId);

    window.soundEngine.playLockIn();
    setTimeout(() => {
      window.soundEngine.playRevealImpact();
    }, 120);

    decisionPanel.classList.add('disabled');
    rectHandButtons.forEach(btn => btn.disabled = true);
    powerButtons.forEach(btn => btn.disabled = true);

    playerHandCard.classList.remove('shuffling');
    aiHandCard.classList.remove('shuffling');

    const { aiBet, aiHand } = getAiDecision();
    gameState.aiBet = aiBet;
    gameState.aiHand = aiHand;
    gameState.selectedHand = playerHand;

    playerHandSymbol.textContent = HANDS[playerHand].emoji;
    playerHandBadge.textContent = `${HANDS[playerHand].name} 결정!`;

    aiHandSymbol.textContent = HANDS[aiHand].emoji;
    aiHandBadge.textContent = `${HANDS[aiHand].name} 결정!`;

    renderPlayerPowerUI(gameState.playerBet);
    renderAiPowerUI(aiBet, true);

    const rpsResult = judgeRPS(playerHand, aiHand);
    let deltaPos = 0;
    let mainResultText = '';
    let subResultText = '';
    let isCounter = false;

    const pBet = gameState.playerBet;

    if (rpsResult === 'win') {
      deltaPos = pBet;
      mainResultText = '🎉 플레이어 가위바위보 승리!';
      subResultText = `${POWER_NAMES[pBet]} 전진! 상대 영토를 빨간색으로 점령합니다!`;
      playerFighterZone.classList.add('winner-highlight');
      window.soundEngine.playHit(pBet);
    } else if (rpsResult === 'lose') {
      deltaPos = -aiBet;
      mainResultText = '💀 상대편 (AI) 승리!';
      subResultText = `상대의 ${POWER_NAMES[aiBet]} 피격! 상대가 영토를 파란색으로 점령합니다!`;
      aiFighterZone.classList.add('winner-highlight');
      window.soundEngine.playHit(aiBet);
    } else {
      // 무승부 후딜레이 룰
      if (pBet === aiBet) {
        deltaPos = 0;
        mainResultText = '⚡ 완벽한 동수 무승부!';
        subResultText = `둘 다 같은 파워(${pBet}칸)로 맞서 영토 변동 없음! (0칸)`;
        window.soundEngine.playEqualDraw();
      } else if (pBet < aiBet) {
        const diff = aiBet - pBet;
        deltaPos = diff;
        isCounter = true;
        gameState.countersCount++;

        mainResultText = '🔥 [무승부 카운터 성공!]';
        subResultText = `상대의 ${POWER_NAMES[aiBet]} 헛스윙 빈틈을 파고들어 [${diff}칸] 점령!`;
        counterSpecialTag.classList.remove('hidden');
        counterTagText.textContent = `무승부 카운터! +${diff}칸 영토 점령`;
        playerFighterZone.classList.add('winner-highlight');

        window.soundEngine.playCounter();
        triggerScreenShake();
      } else {
        const diff = pBet - aiBet;
        deltaPos = -diff;
        isCounter = true;

        mainResultText = '⚠️ [플레이어 헛스윙 후딜레이!]';
        subResultText = `나의 ${POWER_NAMES[pBet]} 헛스윙으로 중심을 잃고 [${diff}칸] 영토를 내어줌!`;
        counterSpecialTag.classList.remove('hidden');
        counterTagText.textContent = `후딜레이 피격! -${diff}칸 후퇴`;
        aiFighterZone.classList.add('winner-highlight');

        window.soundEngine.playCounter();
        triggerScreenShake();
      }
    }

    judgementMain.textContent = mainResultText;
    judgementSub.textContent = subResultText;

    gameState.history.push({
      playerHand,
      aiHand,
      playerBet: pBet,
      aiBet,
      winner: rpsResult,
      deltaPos
    });
    if (Math.abs(deltaPos) > gameState.maxPushInMatch) {
      gameState.maxPushInMatch = Math.abs(deltaPos);
    }

    gameState.currentPos += deltaPos;
    updateBoardPositions(true);

    // ★ [요구사항 2]: 결과 화면을 10초 보여주고 다시 자동 진행
    startResultCooldown();
  }

  // ★ 10초 결과 쿨다운 & 자동 진행
  function startResultCooldown() {
    cooldownPill.classList.remove('hidden');
    cooldownTimeLeftMs = 10000; // 10초
    cooldownSeconds.textContent = '10.0';

    timerBarFill.className = 'timer-bar-fill cooldown';
    timerBarFill.style.width = '100%';
    timerMessage.textContent = '10초 동안 대결 결과를 확인하세요!';

    clearInterval(cooldownTimerId);
    const tickInterval = 100;

    cooldownTimerId = setInterval(() => {
      cooldownTimeLeftMs -= tickInterval;
      const sec = Math.max(0, cooldownTimeLeftMs / 1000).toFixed(1);
      cooldownSeconds.textContent = `${sec}`;
      timerSeconds.textContent = `${sec}s`;

      const pct = Math.max(0, (cooldownTimeLeftMs / 10000) * 100);
      timerBarFill.style.width = `${pct}%`;

      if (cooldownTimeLeftMs <= 0) {
        clearInterval(cooldownTimerId);
        checkGameOverOrNext();
      }
    }, tickInterval);
  }

  // 게임 종료 검사 (5칸 이상 밀려나면 절벽 추락)
  function checkGameOverOrNext() {
    const pos = gameState.currentPos;

    if (pos >= 5) {
      // 상대편 절벽 추락 -> 플레이어 승리!
      gameState.phase = 'GAMEOVER';
      aiUnit.classList.add('falling');
      window.soundEngine.playFall();

      setTimeout(() => {
        window.soundEngine.playVictory();
        gameState.playerWins++;
        showGameOverModal(true);
      }, 900);

    } else if (pos <= -5) {
      // 플레이어 절벽 추락 -> AI 승리!
      gameState.phase = 'GAMEOVER';
      playerUnit.classList.add('falling');
      window.soundEngine.playFall();

      setTimeout(() => {
        window.soundEngine.playDefeat();
        gameState.aiWins++;
        showGameOverModal(false);
      }, 900);

    } else {
      // 게임 진행 중 -> 자동으로 다음 20초 대결 라운드 시작!
      gameState.round++;
      roundNumEl.textContent = gameState.round;
      winRecordEl.textContent = `${gameState.playerWins}승 ${gameState.aiWins}패`;

      startRoundCountdown();
    }
  }

  function triggerScreenShake() {
    gameContainer.classList.add('screen-shake');
    setTimeout(() => {
      gameContainer.classList.remove('screen-shake');
    }, 380);
  }

  function showGameOverModal(isVictory) {
    if (isVictory) {
      modalTrophy.textContent = '🏆';
      modalTitle.textContent = '🎉 영토 완전 장악 승리 (VICTORY)!';
      modalTitle.style.color = '#00e676';
      modalDesc.textContent = '10칸의 모든 영토를 붉은색으로 물들이고 상대를 낭떠러지로 떨어뜨렸습니다!';
    } else {
      modalTrophy.textContent = '💀';
      modalTitle.textContent = '💀 영토 함락 패배 (DEFEAT)';
      modalTitle.style.color = '#ff1744';
      modalDesc.textContent = '상대에게 영토를 빼앗겨 낭떠러지로 추락했습니다... 다음 판에 복수하세요!';
    }

    sumRounds.textContent = `${gameState.roundMoves} 라운드`;
    sumCounters.textContent = `${gameState.countersCount} 회 성공`;
    sumMaxMove.textContent = `${gameState.maxPushInMatch} 칸`;

    winRecordEl.textContent = `${gameState.playerWins}승 ${gameState.aiWins}패`;
    gameoverModal.classList.remove('hidden');
  }

  function resetMatchAll() {
    clearInterval(shuffleIntervalId);
    clearInterval(countdownTimerId);
    clearInterval(cooldownTimerId);

    gameState.currentPos = 0;
    gameState.round = 1;
    gameState.roundMoves = 0;
    gameState.countersCount = 0;
    gameState.maxPushInMatch = 0;
    gameState.history = [];
    gameState.phase = 'IDLE';

    roundNumEl.textContent = 1;
    playerUnit.className = 'mini-char mini-player';
    aiUnit.className = 'mini-char mini-ai';

    gameoverModal.classList.add('hidden');
    startBtnBar.classList.remove('hidden');
    decisionPanel.classList.add('disabled');
    rectHandButtons.forEach(btn => btn.disabled = true);
    powerButtons.forEach(btn => btn.disabled = true);

    renderPlayerPowerUI(1);
    renderAiPowerUI(0, false);

    timerBarFill.className = 'timer-bar-fill';
    timerBarFill.style.width = '100%';
    timerMessage.textContent = '게임을 시작해 주세요!';
    timerSeconds.textContent = '20s';

    judgementMain.textContent = '대기 중';
    judgementSub.textContent = '[게임 시작] 버튼을 누르면 20초 대결이 시작됩니다!';
    counterSpecialTag.classList.add('hidden');
    cooldownPill.classList.add('hidden');

    playerFighterZone.classList.remove('winner-highlight');
    aiFighterZone.classList.remove('winner-highlight');
    playerHandCard.classList.remove('shuffling');
    aiHandCard.classList.remove('shuffling');

    playerHandSymbol.textContent = '✊';
    playerHandBadge.textContent = '선택 대기중';
    aiHandSymbol.textContent = '✌️';
    aiHandBadge.textContent = '대기중';

    updateBoardPositions(false);
  }

  // --- 이벤트 리스너 ---
  btnStartGame.addEventListener('click', () => {
    window.soundEngine.init();
    window.soundEngine.playClick();
    startRoundCountdown();
  });

  powerButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameState.phase !== 'ROUND_ACTIVE') return;
      window.soundEngine.playBetSelect();
      const powerVal = parseInt(btn.dataset.bet, 10);
      renderPlayerPowerUI(powerVal);
    });
  });

  rectHandButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameState.phase !== 'ROUND_ACTIVE') return;
      const hand = btn.dataset.hand;
      resolveDecision(hand, false);
    });
  });

  btnPlayAgain.addEventListener('click', () => {
    window.soundEngine.playClick();
    resetMatchAll();
  });

  btnResetGame.addEventListener('click', () => {
    if (confirm('새 게임으로 다시 시작하시겠습니까?')) {
      window.soundEngine.playClick();
      resetMatchAll();
    }
  });

  btnSoundToggle.addEventListener('click', () => {
    const enabled = window.soundEngine.toggle();
    btnSoundToggle.textContent = enabled ? '🔊' : '🔇';
  });

  btnRulesOpen.addEventListener('click', () => {
    window.soundEngine.playClick();
    rulesModal.classList.remove('hidden');
  });
  btnCloseRules.addEventListener('click', () => {
    window.soundEngine.playClick();
    rulesModal.classList.add('hidden');
  });

  // 초기화 실행
  initTenTiles();
  renderPlayerPowerUI(1);
  renderAiPowerUI(0, false);
  updateBoardPositions(false);
});
