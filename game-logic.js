// そうしのテトリス: DOM に依存しない純粋なゲームロジック。
// index.html のメインスクリプトから使われるほか、tests/game-logic.test.js から
// Node で直接 require してユニットテストできるようにしてある（ブラウザ/Node 両対応）。
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (テスト用)
  } else {
    root.TetrisLogic = api; // ブラウザ
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const SHAPES = {
    I: [[0,1],[1,1],[2,1],[3,1]],
    O: [[1,0],[2,0],[1,1],[2,1]],
    T: [[1,0],[0,1],[1,1],[2,1]],
    S: [[1,0],[2,0],[0,1],[1,1]],
    Z: [[0,0],[1,0],[1,1],[2,1]],
    J: [[0,0],[0,1],[1,1],[2,1]],
    L: [[2,0],[0,1],[1,1],[2,1]]
  };
  const TYPES = Object.keys(SHAPES);
  const ROTATE_KICKS = [0, -1, 1, -2, 2];

  function normalize(cells) {
    const minX = Math.min(...cells.map(c => c.x));
    const minY = Math.min(...cells.map(c => c.y));
    return cells.map(c => ({ x: c.x - minX, y: c.y - minY }));
  }

  // 90度回転。中心位置のずれは呼び出し側で normalize() すれば吸収される。
  function rotateCells(cells) {
    return cells.map(({ x, y }) => ({ x: -y, y: x }));
  }

  // type から、原点(0,0)を左上に寄せたセル配列を作る。
  // 寄せておかないと回転のたびに位置がずれる（v1〜v3で実際に起きたバグ）。
  function shapeCells(type) {
    return normalize(SHAPES[type].map(([x, y]) => ({ x, y })));
  }

  function pieceWidth(cells) {
    return Math.max(...cells.map(c => c.x)) + 1;
  }

  // piece: {x, y, cells}。cols/rows は盤面サイズ、grid は ROWS x COLS の2次元配列（埋まっていれば truthy）。
  function collides(grid, cols, rows, piece, offX, offY, cells) {
    const testCells = cells || piece.cells;
    for (const c of testCells) {
      const gx = piece.x + c.x + offX;
      const gy = piece.y + c.y + offY;
      if (gx < 0 || gx >= cols || gy >= rows) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
    return false;
  }

  // 回転を試み、キック（左右にずらして再試行）も含めて成功したセルとオフセットを返す。
  // 回転できなければ null。
  function tryRotate(grid, cols, rows, piece) {
    const rotated = normalize(rotateCells(piece.cells));
    for (const k of ROTATE_KICKS) {
      if (!collides(grid, cols, rows, piece, k, 0, rotated)) {
        return { cells: rotated, dx: k };
      }
    }
    return null;
  }

  // 埋まっている行を消し、消えた行数を返す。grid は破壊的に更新する。
  function clearLines(grid, cols, rows) {
    let cleared = 0;
    for (let y = rows - 1; y >= 0; y--) {
      if (grid[y].every(cell => cell)) {
        grid.splice(y, 1);
        grid.unshift(Array(cols).fill(null));
        cleared++;
        y++;
      }
    }
    return cleared;
  }

  const LINE_CLEAR_POINTS = [0, 100, 300, 500, 800];
  function scoreForClear(clearedCount, level) {
    return (LINE_CLEAR_POINTS[clearedCount] || 0) * level;
  }

  function levelForLines(totalLines) {
    return Math.floor(totalLines / 10) + 1;
  }

  function dropIntervalForLevel(level) {
    return Math.max(120, 800 - (level - 1) * 70);
  }

  return {
    SHAPES,
    TYPES,
    normalize,
    rotateCells,
    shapeCells,
    pieceWidth,
    collides,
    tryRotate,
    clearLines,
    scoreForClear,
    levelForLines,
    dropIntervalForLevel
  };
});
