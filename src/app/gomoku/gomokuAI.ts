type Player = "black" | "white";
type CellState = Player | null;
type Difficulty = "easy" | "medium" | "hard";

const BOARD_SIZE = 15;

// Pattern scores
const SCORES = {
  FIVE: 1000000,
  LIVE_FOUR: 100000,
  RUSH_FOUR: 10000,
  LIVE_THREE: 5000,
  SLEEP_THREE: 500,
  LIVE_TWO: 200,
  SLEEP_TWO: 50,
};

type PatternResult = {
  count: number;
  openEnds: number;
};

function countDirection(
  board: CellState[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  player: Player
): PatternResult {
  let count = 1;
  let openEnds = 0;

  // Forward
  let r = row + dr;
  let c = col + dc;
  while (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r][c] === player
  ) {
    count++;
    r += dr;
    c += dc;
  }
  if (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r][c] === null
  ) {
    openEnds++;
  }

  // Backward
  r = row - dr;
  c = col - dc;
  while (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r][c] === player
  ) {
    count++;
    r -= dr;
    c -= dc;
  }
  if (
    r >= 0 &&
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r][c] === null
  ) {
    openEnds++;
  }

  return { count, openEnds };
}

function evaluatePosition(
  board: CellState[][],
  row: number,
  col: number,
  player: Player
): number {
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  // Temporarily place the piece
  board[row][col] = player;

  let score = 0;

  for (const [dr, dc] of directions) {
    const { count, openEnds } = countDirection(board, row, col, dr, dc, player);

    if (count >= 5) {
      score += SCORES.FIVE;
    } else if (count === 4) {
      if (openEnds === 2) score += SCORES.LIVE_FOUR;
      else if (openEnds === 1) score += SCORES.RUSH_FOUR;
    } else if (count === 3) {
      if (openEnds === 2) score += SCORES.LIVE_THREE;
      else if (openEnds === 1) score += SCORES.SLEEP_THREE;
    } else if (count === 2) {
      if (openEnds === 2) score += SCORES.LIVE_TWO;
      else if (openEnds === 1) score += SCORES.SLEEP_TWO;
    }
  }

  // Remove the piece
  board[row][col] = null;

  return score;
}

function getCandidateMoves(board: CellState[][]): [number, number][] {
  const candidates = new Set<string>();
  const radius = 2;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) {
        for (
          let dr = Math.max(0, r - radius);
          dr <= Math.min(BOARD_SIZE - 1, r + radius);
          dr++
        ) {
          for (
            let dc = Math.max(0, c - radius);
            dc <= Math.min(BOARD_SIZE - 1, c + radius);
            dc++
          ) {
            if (board[dr][dc] === null) {
              candidates.add(`${dr},${dc}`);
            }
          }
        }
      }
    }
  }

  // If board is empty, play center
  if (candidates.size === 0) {
    return [[7, 7]];
  }

  return Array.from(candidates).map((s) => {
    const [r, c] = s.split(",").map(Number);
    return [r, c];
  });
}

// Check if there's a combined threat (e.g., double live-three)
function hasComboThreat(
  board: CellState[][],
  row: number,
  col: number,
  player: Player
): boolean {
  const directions: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  board[row][col] = player;

  let liveThrees = 0;
  let rushFours = 0;

  for (const [dr, dc] of directions) {
    const { count, openEnds } = countDirection(board, row, col, dr, dc, player);
    if (count === 3 && openEnds === 2) liveThrees++;
    if (count === 4 && openEnds >= 1) rushFours++;
  }

  board[row][col] = null;

  // Double live-three or live-three + rush-four
  return liveThrees >= 2 || (liveThrees >= 1 && rushFours >= 1) || rushFours >= 2;
}

export function getAIMove(
  board: CellState[][],
  aiPlayer: Player,
  difficulty: Difficulty
): { row: number; col: number } {
  const humanPlayer: Player = aiPlayer === "black" ? "white" : "black";
  const candidates = getCandidateMoves(board);

  if (candidates.length === 0) {
    return { row: 7, col: 7 };
  }

  // Easy: just score attack with noise
  if (difficulty === "easy") {
    let best: { row: number; col: number; score: number } = {
      row: candidates[0][0],
      col: candidates[0][1],
      score: -1,
    };

    for (const [r, c] of candidates) {
      const attackScore = evaluatePosition(board, r, c, aiPlayer);
      const noise = Math.random() * 2000;
      const total = attackScore + noise;

      if (total > best.score) {
        best = { row: r, col: c, score: total };
      }
    }

    return { row: best.row, col: best.col };
  }

  // Medium & Hard: attack + defense scoring
  const scored: { row: number; col: number; score: number }[] = [];

  for (const [r, c] of candidates) {
    const attackScore = evaluatePosition(board, r, c, aiPlayer);
    const defenseScore = evaluatePosition(board, r, c, humanPlayer);

    let total: number;

    if (difficulty === "hard") {
      // Hard: full scoring with combo threat bonus
      total = attackScore * 1.1 + defenseScore;

      // Bonus for combo threats
      if (hasComboThreat(board, r, c, aiPlayer)) {
        total += 50000;
      }

      // Must defend against opponent's winning threats
      if (defenseScore >= SCORES.FIVE) {
        total += SCORES.FIVE * 0.9;
      }
      if (defenseScore >= SCORES.LIVE_FOUR) {
        total += SCORES.LIVE_FOUR * 0.9;
      }
    } else {
      // Medium: standard attack + defense
      total = attackScore + defenseScore * 0.9;
    }

    scored.push({ row: r, col: c, score: total });
  }

  scored.sort((a, b) => b.score - a.score);

  // Medium: small noise among top candidates
  if (difficulty === "medium" && scored.length > 3) {
    const topN = scored.slice(0, 3);
    const pick = topN[Math.floor(Math.random() * (Math.random() < 0.7 ? 1 : topN.length))];
    return { row: pick.row, col: pick.col };
  }

  return { row: scored[0].row, col: scored[0].col };
}
