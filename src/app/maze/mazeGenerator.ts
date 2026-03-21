// 迷宫生成算法 - Eller's Algorithm
export type Cell = {
  row: number;
  col: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  visited: boolean;
};

export type Maze = Cell[][];

export type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_CONNECT_PROB: Record<Difficulty, number> = {
  easy: 0.65,
  normal: 0.5,
  hard: 0.35,
};

export function generateMaze(rows: number, cols: number, difficulty: Difficulty = "normal"): Maze {
  const connectProb = DIFFICULTY_CONNECT_PROB[difficulty];
  // 初始化迷宫
  const maze: Maze = [];
  for (let r = 0; r < rows; r++) {
    maze[r] = [];
    for (let c = 0; c < cols; c++) {
      maze[r][c] = {
        row: r,
        col: c,
        walls: { top: true, right: true, bottom: true, left: true },
        visited: false,
      };
    }
  }

  // Eller's Algorithm
  let currentRow: number[] = [];
  let nextSetId = 0;

  // 初始化第一行
  for (let c = 0; c < cols; c++) {
    currentRow[c] = nextSetId++;
  }

  for (let r = 0; r < rows; r++) {
    const isLastRow = r === rows - 1;

    // 步骤 1: 随机连接相邻的不同集合的单元格（移除右墙）
    for (let c = 0; c < cols - 1; c++) {
      const shouldConnect = Math.random() < connectProb;
      const differentSets = currentRow[c] !== currentRow[c + 1];

      if (shouldConnect && differentSets) {
        // 合并集合
        const oldSet = currentRow[c + 1];
        const newSet = currentRow[c];
        for (let i = 0; i < cols; i++) {
          if (currentRow[i] === oldSet) {
            currentRow[i] = newSet;
          }
        }
        // 移除右墙
        maze[r][c].walls.right = false;
        maze[r][c + 1].walls.left = false;
      }
    }

    if (!isLastRow) {
      // 步骤 2: 为每个集合随机创建至少一个向下的连接
      const setConnections: Map<number, number[]> = new Map();
      
      // 收集每个集合的单元格
      for (let c = 0; c < cols; c++) {
        const set = currentRow[c];
        if (!setConnections.has(set)) {
          setConnections.set(set, []);
        }
        setConnections.get(set)!.push(c);
      }

      // 为每个集合创建至少一个向下连接
      const nextRow: number[] = new Array(cols).fill(-1);
      
      setConnections.forEach((cells, set) => {
        // 随机决定哪些单元格向下连接
        const shouldConnect = cells.map(() => Math.random() < connectProb);
        
        // 确保至少有一个连接
        if (!shouldConnect.some(v => v)) {
          shouldConnect[Math.floor(Math.random() * shouldConnect.length)] = true;
        }

        cells.forEach((col, idx) => {
          if (shouldConnect[idx]) {
            // 移除下墙
            maze[r][col].walls.bottom = false;
            maze[r + 1][col].walls.top = false;
            nextRow[col] = set;
          }
        });
      });

      // 步骤 3: 为下一行中没有集合的单元格分配新集合
      for (let c = 0; c < cols; c++) {
        if (nextRow[c] === -1) {
          nextRow[c] = nextSetId++;
        }
      }

      currentRow = nextRow;
    } else {
      // 最后一行：连接所有不同集合的相邻单元格
      for (let c = 0; c < cols - 1; c++) {
        if (currentRow[c] !== currentRow[c + 1]) {
          // 合并集合
          const oldSet = currentRow[c + 1];
          const newSet = currentRow[c];
          for (let i = 0; i < cols; i++) {
            if (currentRow[i] === oldSet) {
              currentRow[i] = newSet;
            }
          }
          // 移除右墙
          maze[r][c].walls.right = false;
          maze[r][c + 1].walls.left = false;
        }
      }
    }
  }

  return maze;
}

export function canMove(
  maze: Maze,
  fromRow: number,
  fromCol: number,
  direction: "up" | "down" | "left" | "right"
): boolean {
  const cell = maze[fromRow][fromCol];
  
  switch (direction) {
    case "up":
      return !cell.walls.top;
    case "down":
      return !cell.walls.bottom;
    case "left":
      return !cell.walls.left;
    case "right":
      return !cell.walls.right;
    default:
      return false;
  }
}
