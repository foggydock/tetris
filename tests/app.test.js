const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// 実際の画面スクリプトを偽DOM・偽ストレージ・手動時計で実行する。本番の記録には接続しない。
function app() {
  const elements = new Map();
  const context2d = new Proxy({}, { get: () => () => {} });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      style: {}, dataset: {}, hidden: false, textContent: '', clientHeight: 600,
      clientWidth: 500, offsetWidth: 110, width: 80, height: 80, listeners: {},
      getContext: () => context2d, setAttribute() {}, closest: () => null,
      addEventListener(type, fn) { this.listeners[type] = fn; }
    });
    return elements.get(id);
  }
  const modes = ['lines', 'time', 'blocks'].map(mode => {
    const el = element(mode); el.dataset.mode = mode; return el;
  });
  const document = { hidden: false, getElementById: element,
    querySelectorAll: () => modes, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  const window = { innerHeight: 800, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  const storage = new Map();
  const sandbox = { document, window, navigator: {}, TetrisLogic: require('../game-logic'),
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    getComputedStyle: () => ({ paddingLeft: '8', paddingRight: '8' }),
    requestAnimationFrame: () => 1, setTimeout: () => 1 };
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script.replace('})();', `globalThis.fixture = {
    loop, finishGame, clearLines, getHighscore, setHighscore,
    state: () => ({score, timeLeftMs, x: current?.x, y: current?.y, gameOver, paused}),
    setup: (value) => { grid = value.grid; lines = value.lines; clearedBlocks = value.blocks; }
  };})();`), sandbox);
  return { ...sandbox.fixture, element, document, window, storage,
    start: mode => element(mode).listeners.click(),
    click: id => element(id).listeners.click(),
    visibility(hidden) { document.hidden = hidden; document.listeners.visibilitychange(); } };
}

test('開始直後に初回フレームが来ても残り時間がNaNにならない', () => {
  const a = app(); a.start('time'); a.loop(500);
  assert.equal(a.state().timeLeftMs, 180000);
});
test('非表示中に描画が停止しても、復帰時に裏にいた時間を消費しない', () => {
  const a = app(); a.start('time'); a.loop(0); a.loop(1000);
  a.visibility(true); a.visibility(false); a.loop(200000);
  assert.equal(a.state().timeLeftMs, 179000);
  assert.equal(a.state().gameOver, false);
  a.loop(201000); assert.equal(a.state().timeLeftMs, 178000);
});
test('手動一時停止はタブ復帰後も継続し、全操作と時間経過を止める', () => {
  const a = app(); a.start('time'); a.loop(0); a.click('pauseBtn');
  const before = a.state();
  for (const id of ['btnLeft','btnRight','btnRotate','btnDrop']) a.click(id);
  a.loop(10000); a.visibility(true); a.visibility(false); a.loop(20000);
  assert.deepEqual(a.state(), before);
  a.click('pauseBtn'); a.loop(30000); a.loop(31000);
  assert.equal(a.state().timeLeftMs, 179000);
});
test('狭すぎる画面の案内中はゲームを止める', () => {
  const a = app(); a.start('time'); a.loop(0);
  a.window.innerHeight = 320; a.window.listeners.resize(); a.loop(10000);
  assert.equal(a.element('layoutNotice').hidden, false);
  assert.equal(a.state().timeLeftMs, 180000);
  a.window.innerHeight = 800; a.window.listeners.resize(); a.loop(20000);
  assert.equal(a.element('layoutNotice').hidden, true);
  assert.equal(a.state().timeLeftMs, 180000);
});
test('時間切れと再開が正しく動作する', () => {
  const a = app(); a.start('time'); a.loop(0); a.loop(180000);
  assert.equal(a.state().gameOver, true);
  assert.equal(a.element('goalValue').textContent, '0:00');
  a.click('restartBtn'); assert.equal(a.state().gameOver, false);
  assert.equal(a.state().timeLeftMs, 180000);
});
for (const mode of ['lines','blocks']) test(`${mode}の目標達成でクリアする`, () => {
  const a = app(); a.start(mode);
  const grid = Array.from({length:20}, () => Array(10).fill(null));
  grid[19].fill('I'); a.setup({grid,lines:9,blocks:190}); a.clearLines();
  assert.equal(a.state().gameOver, true);
  assert.match(a.element('overlayTitle').textContent, /クリア/);
});
test('スペース長押しのリピートで次のミノを連続落下させない', () => {
  const a = app(); a.start('lines');
  a.window.listeners.keydown({key:' ',repeat:true,preventDefault(){},target:a.element('board')});
  assert.equal(a.state().score, 0);
});
test('中断されたタッチ操作の移動を引き継がない', () => {
  const a = app(); a.start('lines'); const board = a.element('board');
  board.listeners.touchstart({touches:[{clientX:10,clientY:10}]});
  board.listeners.touchcancel();
  const before = a.state().x;
  board.listeners.touchmove({touches:[{clientX:200,clientY:10}]});
  assert.equal(a.state().x, before);
});
