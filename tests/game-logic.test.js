// game-logic.js の回帰テスト。`node --test tests/` で実行する（追加パッケージ不要）。
const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../game-logic.js');

function newGrid(cols, rows) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function sortedCellStrings(cells) {
  return cells.map(c => `${c.x},${c.y}`).sort();
}

test('shapeCells: 全ミノが原点(0,0)を左上に寄せた形になっている', () => {
  for (const type of logic.TYPES) {
    const cells = logic.shapeCells(type);
    const minX = Math.min(...cells.map(c => c.x));
    const minY = Math.min(...cells.map(c => c.y));
    assert.equal(minX, 0, `${type}: minX が 0 でない`);
    assert.equal(minY, 0, `${type}: minY が 0 でない`);
  }
});

test('rotate: Oミノは4回回転しても同じ形のまま（左にずれない）', () => {
  let cells = logic.shapeCells('O');
  const original = sortedCellStrings(cells);
  for (let i = 0; i < 4; i++) {
    cells = logic.normalize(logic.rotateCells(cells));
    assert.deepEqual(sortedCellStrings(cells), original, `${i + 1}回転後にずれた`);
  }
});

test('rotate: Iミノは2回転で元の向きに戻る（横→縦→横）', () => {
  let cells = logic.shapeCells('I');
  const horizontal = sortedCellStrings(cells);
  cells = logic.normalize(logic.rotateCells(cells));
  const vertical = sortedCellStrings(cells);
  assert.notDeepEqual(vertical, horizontal, '1回転しても形が変わっていない');
  cells = logic.normalize(logic.rotateCells(cells));
  assert.deepEqual(sortedCellStrings(cells), horizontal, '2回転後に元の向きに戻らない');
});

test('collides: 盤面の外・既存ブロックとの重なりを検出する', () => {
  const cols = 10, rows = 20;
  const grid = newGrid(cols, rows);
  grid[19][5] = 'I';
  const piece = { x: 4, y: 18, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };

  assert.equal(logic.collides(grid, cols, rows, piece, 0, 0), false);
  assert.equal(logic.collides(grid, cols, rows, piece, -5, 0), true, '左端を超えても検出できていない');
  assert.equal(logic.collides(grid, cols, rows, piece, 5, 0), true, '右端を超えても検出できていない');
  assert.equal(logic.collides(grid, cols, rows, piece, 0, 1), true, '既存ブロックとの重なりを検出できていない');
});

test('tryRotate: 壁際でもキックして回転できる／できないときは null', () => {
  const cols = 10, rows = 20;
  const grid = newGrid(cols, rows);
  // Iミノを右端ぎりぎりに置く
  const piece = { x: cols - 1, y: 5, cells: logic.shapeCells('I') };
  const result = logic.tryRotate(grid, cols, rows, piece);
  assert.notEqual(result, null, '壁際でキックによる回転ができない');

  // 完全に埋まった盤面では回転できない
  const fullGrid = Array.from({ length: rows }, () => Array(cols).fill('I'));
  const stuck = { x: 4, y: 5, cells: logic.shapeCells('T') };
  assert.equal(logic.tryRotate(fullGrid, cols, rows, stuck), null);
});

test('clearLines: 埋まった行だけを消し、消えた行数を返す', () => {
  const cols = 4, rows = 3;
  const grid = [
    Array(cols).fill('I'),      // 埋まっている
    [null, 'T', 'T', null],     // 埋まっていない
    Array(cols).fill('O'),      // 埋まっている
  ];
  const cleared = logic.clearLines(grid, cols, rows);
  assert.equal(cleared, 2);
  assert.equal(grid.length, rows, '行数が変わってしまっている');
  assert.deepEqual(grid[2], [null, 'T', 'T', null], '残った行の中身が変わってしまっている');
  assert.deepEqual(grid[0], Array(cols).fill(null));
  assert.deepEqual(grid[1], Array(cols).fill(null));
});

test('scoreForClear: 消したライン数とレベルに応じた点数になる', () => {
  assert.equal(logic.scoreForClear(1, 1), 100);
  assert.equal(logic.scoreForClear(4, 1), 800);
  assert.equal(logic.scoreForClear(2, 3), 900);
  assert.equal(logic.scoreForClear(0, 5), 0);
});

test('levelForLines / dropIntervalForLevel: レベルが上がるほど速く落ちる', () => {
  assert.equal(logic.levelForLines(0), 1);
  assert.equal(logic.levelForLines(9), 1);
  assert.equal(logic.levelForLines(10), 2);
  assert.equal(logic.dropIntervalForLevel(1), 800);
  assert.ok(logic.dropIntervalForLevel(2) < logic.dropIntervalForLevel(1));
  assert.equal(logic.dropIntervalForLevel(100), 120, '下限の120msを下回ってはいけない');
});
