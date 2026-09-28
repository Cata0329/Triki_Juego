/**
 * ============================================
 * TRIKI - Juego de Tres en Raya
 * Lógica principal del juego
 * ============================================
 */

// ============================================
// Constantes del juego
// ============================================
const SYMBOLS = {
    PLAYER: 'X',
    COMPUTER: 'O'
};

const DIFFICULTY_LEVELS = {
    1: { name: 'Fácil', description: 'Para principiantes' },
    2: { name: 'Normal', description: 'Juego equilibrado' },
    3: { name: 'Difícil', description: 'Estrategia avanzada' },
    4: { name: 'Experto', description: 'IA invencible' }
};

const WINNING_COMBINATIONS = [
    [0, 1, 2], // Horizontal superior
    [3, 4, 5], // Horizontal medio
    [6, 7, 8], // Horizontal inferior
    [0, 3, 6], // Vertical izquierda
    [1, 4, 7], // Vertical centro
    [2, 5, 8], // Vertical derecha
    [0, 4, 8], // Diagonal principal
    [2, 4, 6]  // Diagonal secundaria
];

const STORAGE_KEY = 'triki_game_data';

// ============================================
// Estado del juego
// ============================================
let gameState = {
    board: Array(9).fill(null),
    currentPlayer: SYMBOLS.PLAYER,
    gameActive: true,
    difficultyLevel: 1,
    scores: { player: 0, computer: 0 },
    stats: { wins: 0, losses: 0, draws: 0, streak: 0 },
    isProcessing: false
};

// Temporizadores pendientes (se cancelan al salir de la partida)
let computerTimer = null;
let resultTimer = null;

function cancelarTemporizadores() {
    clearTimeout(computerTimer);
    clearTimeout(resultTimer);
    computerTimer = null;
    resultTimer = null;
    gameState.isProcessing = false;
    elements.turnLoader.classList.remove('active');
}

// ============================================
// Elementos del DOM
// ============================================
const elements = {
    // Pantallas
    screenStart: document.getElementById('screen-start'),
    screenGame: document.getElementById('screen-game'),
    screenResult: document.getElementById('screen-result'),
    
    // Inicio
    btnPlay: document.getElementById('btn-play'),
    btnResetProgress: document.getElementById('btn-reset-progress'),
    currentLevelDisplay: document.getElementById('current-level-display'),
    statWins: document.getElementById('stat-wins'),
    statLosses: document.getElementById('stat-losses'),
    statDraws: document.getElementById('stat-draws'),
    statStreak: document.getElementById('stat-streak'),
    difficultyBtns: document.querySelectorAll('.difficulty-btn'),
    
    // Juego
    btnBack: document.getElementById('btn-back'),
    gameLevelBadge: document.getElementById('game-level-badge'),
    turnText: document.getElementById('turn-text'),
    turnLoader: document.getElementById('turn-loader'),
    gameBoard: document.getElementById('game-board'),
    cells: document.querySelectorAll('.cell'),
    scorePlayer: document.getElementById('score-player'),
    scoreComputer: document.getElementById('score-computer'),
    
    // Resultado
    resultEmoji: document.getElementById('result-emoji'),
    resultTitle: document.getElementById('result-title'),
    resultMessage: document.getElementById('result-message'),
    resultLevel: document.getElementById('result-level'),
    resultOutcome: document.getElementById('result-outcome'),
    btnPlayAgain: document.getElementById('btn-play-again'),
    btnChangeDifficulty: document.getElementById('btn-change-difficulty'),
    summaryWins: document.getElementById('summary-wins'),
    summaryLosses: document.getElementById('summary-losses'),
    summaryDraws: document.getElementById('summary-draws'),
    
    // Confeti
    confettiContainer: document.getElementById('confetti-container')
};

// ============================================
// Sistema de sonido (Web Audio API)
// ============================================
const SoundManager = {
    context: null,
    enabled: true,
    
    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    },
    
    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled || !this.context) return;
        
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);
        
        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + duration);
    },
    
    playPlace() {
        this.playTone(440, 0.1);
    },
    
    playWin() {
        this.playTone(523, 0.15);
        setTimeout(() => this.playTone(659, 0.15), 100);
        setTimeout(() => this.playTone(784, 0.3), 200);
    },
    
    playLose() {
        this.playTone(300, 0.2);
        setTimeout(() => this.playTone(200, 0.3), 150);
    },
    
    playDraw() {
        this.playTone(400, 0.2);
    }
};

// ============================================
// Gestión de almacenamiento local
// ============================================
const StorageManager = {
    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('No se pudo guardar en localStorage');
        }
    },
    
    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },
    
    clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('No se pudo limpiar localStorage');
        }
    }
};

// ============================================
// Funciones de utilidad
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function getAvailableMoves(board) {
    return board.map((cell, index) => cell === null ? index : null).filter(val => val !== null);
}

function checkWinner(board) {
    for (const combination of WINNING_COMBINATIONS) {
        const [a, b, c] = combination;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], combination };
        }
    }
    return null;
}

function checkDraw(board) {
    return board.every(cell => cell !== null);
}

// ============================================
// Algoritmo Minimax (Nivel Experto)
// ============================================
function minimax(board, depth, isMaximizing) {
    const result = checkWinner(board);
    
    // Casos base
    if (result) {
        if (result.winner === SYMBOLS.COMPUTER) {
            return { score: 10 - depth };
        } else {
            return { score: depth - 10 };
        }
    }
    
    const availableMoves = getAvailableMoves(board);
    if (availableMoves.length === 0) {
        return { score: 0 };
    }
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        let bestMove = null;
        
        for (const move of availableMoves) {
            board[move] = SYMBOLS.COMPUTER;
            const { score } = minimax(board, depth + 1, false);
            board[move] = null;
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return { score: bestScore, move: bestMove };
    } else {
        let bestScore = Infinity;
        let bestMove = null;
        
        for (const move of availableMoves) {
            board[move] = SYMBOLS.PLAYER;
            const { score } = minimax(board, depth + 1, true);
            board[move] = null;
            
            if (score < bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return { score: bestScore, move: bestMove };
    }
}

// ============================================
// Estrategias de la computadora por nivel
// ============================================

/**
 * Nivel 1 - Fácil: Movimientos principalmente aleatorios
 */
function getEasyMove(board) {
    const availableMoves = getAvailableMoves(board);
    
    // 30% de probabilidad de hacer un movimiento inteligente
    if (Math.random() < 0.3) {
        const smartMove = getNormalMove(board);
        if (smartMove !== null) return smartMove;
    }
    
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

/**
 * Nivel 2 - Normal: Detecta victorias y bloquea
 */
function getNormalMove(board) {
    const availableMoves = getAvailableMoves(board);
    
    // 1. Intentar ganar
    for (const move of availableMoves) {
        board[move] = SYMBOLS.COMPUTER;
        if (checkWinner(board)?.winner === SYMBOLS.COMPUTER) {
            board[move] = null;
            return move;
        }
        board[move] = null;
    }
    
    // 2. Bloquear al jugador
    for (const move of availableMoves) {
        board[move] = SYMBOLS.PLAYER;
        if (checkWinner(board)?.winner === SYMBOLS.PLAYER) {
            board[move] = null;
            return move;
        }
        board[move] = null;
    }
    
    // 3. Priorizar el centro
    if (board[4] === null) return 4;
    
    // 4. Priorizar esquinas
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }
    
    // 5. Cualquier movimiento disponible
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

/**
 * Nivel 3 - Difícil: Estrategia avanzada
 */
function getHardMove(board) {
    const availableMoves = getAvailableMoves(board);
    
    // 1. Intentar ganar
    for (const move of availableMoves) {
        board[move] = SYMBOLS.COMPUTER;
        if (checkWinner(board)?.winner === SYMBOLS.COMPUTER) {
            board[move] = null;
            return move;
        }
        board[move] = null;
    }
    
    // 2. Bloquear al jugador
    for (const move of availableMoves) {
        board[move] = SYMBOLS.PLAYER;
        if (checkWinner(board)?.winner === SYMBOLS.PLAYER) {
            board[move] = null;
            return move;
        }
        board[move] = null;
    }
    
    // 3. Crear fork (dos oportunidades de victoria)
    const forkMove = findForkMove(board, SYMBOLS.COMPUTER);
    if (forkMove !== null) return forkMove;
    
    // 4. Bloquear fork del jugador
    const blockForkMove = findForkMove(board, SYMBOLS.PLAYER);
    if (blockForkMove !== null) return blockForkMove;
    
    // 5. Priorizar el centro
    if (board[4] === null) return 4;
    
    // 6. Esquinas opuestas
    const oppositeCorners = [[0, 8], [2, 6]];
    for (const [a, b] of oppositeCorners) {
        if (board[a] === SYMBOLS.PLAYER && board[b] === null) return b;
        if (board[b] === SYMBOLS.PLAYER && board[a] === null) return a;
    }
    
    // 7. Esquinas vacías
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }
    
    // 8. Lados
    const sides = [1, 3, 5, 7].filter(i => board[i] === null);
    if (sides.length > 0) {
        return sides[Math.floor(Math.random() * sides.length)];
    }
    
    return availableMoves[0];
}

/**
 * Busca un movimiento que cree un fork (dos formas de ganar)
 */
function findForkMove(board, symbol) {
    const availableMoves = getAvailableMoves(board);
    
    for (const move of availableMoves) {
        board[move] = symbol;
        let winningPaths = 0;
        
        for (const combo of WINNING_COMBINATIONS) {
            if (!combo.includes(move)) continue;
            const values = combo.map(i => board[i]);
            if (values.filter(v => v === symbol).length === 2 && values.filter(v => v === null).length === 1) {
                winningPaths++;
            }
        }
        
        board[move] = null;
        if (winningPaths >= 2) return move;
    }
    
    return null;
}

/**
 * Nivel 4 - Experto: Algoritmo Minimax
 */
function getExpertMove(board) {
    const { move } = minimax([...board], 0, true);
    return move;
}

/**
 * Obtiene el movimiento de la computadora según el nivel
 */
function getComputerMove(board, level) {
    switch (level) {
        case 1: return getEasyMove([...board]);
        case 2: return getNormalMove([...board]);
        case 3: return getHardMove([...board]);
        case 4: return getExpertMove([...board]);
        default: return getEasyMove([...board]);
    }
}

// ============================================
// Funciones principales del juego
// ============================================

/**
 * Inicializa el juego
 */
function iniciarJuego() {
    cancelarTemporizadores();
    gameState.board = Array(9).fill(null);
    gameState.currentPlayer = SYMBOLS.PLAYER;
    gameState.gameActive = true;
    gameState.isProcessing = false;
    
    // Actualizar interfaz
    updateBoard();
    updateTurnIndicator();
    updateScore();
    showScreen('screen-game');
    
    // Actualizar badge de nivel
    const levelInfo = DIFFICULTY_LEVELS[gameState.difficultyLevel];
    elements.gameLevelBadge.textContent = `Nivel ${gameState.difficultyLevel} - ${levelInfo.name}`;
}

/**
 * Realiza un movimiento en el tablero
 */
function realizarMovimiento(index, symbol) {
    if (!gameState.gameActive || gameState.board[index] !== null) {
        return false;
    }
    
    gameState.board[index] = symbol;
    updateBoard();
    SoundManager.playPlace();
    
    // Verificar ganador
    const winnerResult = checkWinner(gameState.board);
    if (winnerResult) {
        endGame(winnerResult);
        return true;
    }
    
    // Verificar empate
    if (checkDraw(gameState.board)) {
        endGame({ winner: 'draw' });
        return true;
    }
    
    // Cambiar turno
    gameState.currentPlayer = symbol === SYMBOLS.PLAYER ? SYMBOLS.COMPUTER : SYMBOLS.PLAYER;
    updateTurnIndicator();
    
    return true;
}

/**
 * Maneja el clic del jugador en una celda
 */
function handlePlayerMove(index) {
    if (gameState.currentPlayer !== SYMBOLS.PLAYER || !gameState.gameActive || gameState.isProcessing) {
        return;
    }
    
    if (realizarMovimiento(index, SYMBOLS.PLAYER)) {
        // Si el juego continúa, la computadora juega después de un breve delay
        if (gameState.gameActive) {
            gameState.isProcessing = true;
            elements.turnLoader.classList.add('active');
            
            computerTimer = setTimeout(() => {
                // Se libera el bloqueo ANTES de mover, si no la jugada de la PC sería rechazada
                gameState.isProcessing = false;
                elements.turnLoader.classList.remove('active');
                movimientoComputadora();
            }, 500 + Math.random() * 500);
        }
    }
}

/**
 * Realiza el movimiento de la computadora
 */
function movimientoComputadora() {
    if (!gameState.gameActive || gameState.currentPlayer !== SYMBOLS.COMPUTER) {
        return;
    }
    
    const move = getComputerMove(gameState.board, gameState.difficultyLevel);
    realizarMovimiento(move, SYMBOLS.COMPUTER);
}

/**
 * Finaliza el juego y muestra el resultado
 */
function endGame(result) {
    gameState.gameActive = false;
    
    let outcome, emoji, title, message;
    
    if (result.winner === 'draw') {
        outcome = 'Empate';
        emoji = '🤝';
        title = '¡Empate!';
        message = 'Nadie ganó esta vez';
        gameState.stats.draws++;
        gameState.stats.streak = 0;
        SoundManager.playDraw();
    } else if (result.winner === SYMBOLS.PLAYER) {
        outcome = 'Victoria';
        emoji = '🎉';
        title = '¡Ganaste!';
        message = 'Excelente jugada';
        gameState.stats.wins++;
        gameState.stats.streak++;
        gameState.scores.player++;
        SoundManager.playWin();
        createConfetti();
    } else {
        outcome = 'Derrota';
        emoji = '🤖';
        title = 'Esta vez ganó la computadora';
        message = 'Inténtalo de nuevo';
        gameState.stats.losses++;
        gameState.stats.streak = 0;
        gameState.scores.computer++;
        SoundManager.playLose();
    }
    
    // Resaltar celdas ganadoras
    if (result.combination) {
        result.combination.forEach(index => {
            elements.cells[index].classList.add('winning');
        });
    }
    
    // Guardar progreso
    guardarProgreso();
    
    // Mostrar pantalla de resultado después de un delay
    resultTimer = setTimeout(() => {
        showResultScreen(outcome, emoji, title, message);
    }, 1500);
}

/**
 * Muestra la pantalla de resultado
 */
function showResultScreen(outcome, emoji, title, message) {
    const levelInfo = DIFFICULTY_LEVELS[gameState.difficultyLevel];
    
    elements.resultEmoji.textContent = emoji;
    elements.resultTitle.textContent = title;
    elements.resultMessage.textContent = message;
    elements.resultLevel.textContent = `Nivel ${gameState.difficultyLevel} - ${levelInfo.name}`;
    elements.resultOutcome.textContent = outcome;
    
    elements.summaryWins.textContent = gameState.stats.wins;
    elements.summaryLosses.textContent = gameState.stats.losses;
    elements.summaryDraws.textContent = gameState.stats.draws;
    
    showScreen('screen-result');
}

/**
 * Actualiza la visualización del tablero
 */
function updateBoard() {
    elements.cells.forEach((cell, index) => {
        cell.textContent = gameState.board[index] || '';
        cell.className = 'cell';
        
        if (gameState.board[index]) {
            cell.classList.add('occupied', gameState.board[index].toLowerCase());
        }
        
        if (!gameState.gameActive) {
            cell.classList.add('disabled');
        }
    });
}

/**
 * Actualiza el indicador de turno
 */
function updateTurnIndicator() {
    if (gameState.currentPlayer === SYMBOLS.PLAYER) {
        elements.turnText.textContent = 'Tu turno';
    } else {
        elements.turnText.textContent = 'Turno de la computadora...';
    }
}

/**
 * Actualiza el marcador
 */
function updateScore() {
    elements.scorePlayer.textContent = gameState.scores.player;
    elements.scoreComputer.textContent = gameState.scores.computer;
}

/**
 * Actualiza las estadísticas en la pantalla de inicio
 */
function actualizarEstadisticas() {
    elements.statWins.textContent = gameState.stats.wins;
    elements.statLosses.textContent = gameState.stats.losses;
    elements.statDraws.textContent = gameState.stats.draws;
    elements.statStreak.textContent = gameState.stats.streak;
}

/**
 * Guarda el progreso en localStorage
 */
function guardarProgreso() {
    const data = {
        difficultyLevel: gameState.difficultyLevel,
        scores: gameState.scores,
        stats: gameState.stats
    };
    StorageManager.save(data);
}

/**
 * Carga el progreso desde localStorage
 */
function cargarProgreso() {
    const data = StorageManager.load();
    if (data) {
        gameState.difficultyLevel = data.difficultyLevel || 1;
        gameState.scores = data.scores || { player: 0, computer: 0 };
        gameState.stats = data.stats || { wins: 0, losses: 0, draws: 0, streak: 0 };
    }
    
    // Actualizar UI
    elements.currentLevelDisplay.textContent = `${gameState.difficultyLevel} / 4`;
    actualizarEstadisticas();
    
    // Actualizar botones de dificultad
    elements.difficultyBtns.forEach(btn => {
        const level = parseInt(btn.dataset.level);
        btn.classList.toggle('active', level === gameState.difficultyLevel);
        btn.setAttribute('aria-checked', level === gameState.difficultyLevel);
    });
}

/**
 * Cambia el nivel de dificultad
 */
function cambiarNivel(level) {
    gameState.difficultyLevel = level;
    elements.currentLevelDisplay.textContent = `${level} / 4`;
    
    // Actualizar botones
    elements.difficultyBtns.forEach(btn => {
        const btnLevel = parseInt(btn.dataset.level);
        btn.classList.toggle('active', btnLevel === level);
        btn.setAttribute('aria-checked', btnLevel === level);
    });
    
    guardarProgreso();
}

/**
 * Reinicia el progreso del jugador
 */
function reiniciarProgreso() {
    gameState.difficultyLevel = 1;
    gameState.scores = { player: 0, computer: 0 };
    gameState.stats = { wins: 0, losses: 0, draws: 0, streak: 0 };
    
    StorageManager.clear();
    cargarProgreso();
}

// ============================================
// Efectos visuales
// ============================================

/**
 * Crea confeti cuando el jugador gana
 */
function createConfetti() {
    const colors = ['#E85AAD', '#7C4DFF', '#22D3EE', '#FFFFFF', '#F472B6'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            elements.confettiContainer.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 4000);
        }, i * 30);
    }
}

// ============================================
// Event Listeners
// ============================================

function initEventListeners() {
    // Botón jugar
    elements.btnPlay.addEventListener('click', () => {
        SoundManager.init();
        iniciarJuego();
    });
    
    // Botón reiniciar progreso
    elements.btnResetProgress.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres reiniciar todo tu progreso?')) {
            reiniciarProgreso();
        }
    });
    
    // Botones de dificultad
    elements.difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = parseInt(btn.dataset.level);
            cambiarNivel(level);
        });
    });
    
    // Celdas del tablero
    elements.cells.forEach(cell => {
        cell.addEventListener('click', () => {
            const index = parseInt(cell.dataset.index);
            handlePlayerMove(index);
        });
        
        // Soporte para teclado
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const index = parseInt(cell.dataset.index);
                handlePlayerMove(index);
            }
        });
    });
    
    // Botón volver
    elements.btnBack.addEventListener('click', () => {
        cancelarTemporizadores();
        showScreen('screen-start');
        actualizarEstadisticas();
    });
    
    // Botón jugar de nuevo
    elements.btnPlayAgain.addEventListener('click', () => {
        iniciarJuego();
    });
    
    // Botón cambiar dificultad
    elements.btnChangeDifficulty.addEventListener('click', () => {
        showScreen('screen-start');
        actualizarEstadisticas();
    });
}

// ============================================
// Inicialización
// ============================================
function init() {
    cargarProgreso();
    initEventListeners();
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);