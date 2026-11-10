// 主程式：組合物理、規則、AI、輸入與畫面
import { PHYSICS, TEAM_COLORS, makeField } from './config.js';
import { World } from './world.js';
import { Match } from './rules.js';
import { aiUpdate, SKILLS } from './ai.js';
import { Input } from './input.js';
import { Renderer, CAMERA_LABELS } from './render.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const ROLE_LABELS = { striker: '攻擊手', keeper: '守門', chaser: '攔截', escort: '護航', blocker: '封堵' };
const SETTINGS_KEY = 'drone-soccer-settings-v1';

const DEFAULT_SETTINGS = {
  mode: 'match',
  field: 'DS40',
  goal: '1',
  flight: 'althold',
  radio: '2',
  team: '5',
  role: 'striker',
  skill: 'normal',
  time: '180',
  sets: '3',
  opp: 'none',
  touch: 'auto',
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 無法儲存時忽略 */
  }
}

const OPTION_IDS = {
  field: 'optField',
  goal: 'optGoal',
  flight: 'optFlight',
  radio: 'optRadio',
  team: 'optTeam',
  role: 'optRole',
  skill: 'optSkill',
  time: 'optTime',
  sets: 'optSets',
  opp: 'optOpp',
  touch: 'optTouch',
};

const settings = loadSettings();
const input = new Input();
const renderer = new Renderer($('scene'));
const sound = new Sound();
let world = null;
let match = null;
let player = null;
let paused = true;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let hudTimer = 0;

// ---------- 選單 ----------
function syncMenu() {
  document
    .querySelectorAll('.mode')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode)));
  for (const [k, id] of Object.entries(OPTION_IDS)) $(id).value = settings[k];
  const practice = settings.mode === 'practice';
  document.querySelectorAll('.match-only').forEach((el) => (el.hidden = practice));
  document.querySelectorAll('.practice-only').forEach((el) => (el.hidden = !practice));
}
document.querySelectorAll('.mode').forEach((b) =>
  b.addEventListener('click', () => {
    settings.mode = b.dataset.mode;
    syncMenu();
  }),
);
for (const [k, id] of Object.entries(OPTION_IDS)) {
  $(id).addEventListener('change', (e) => {
    settings[k] = e.target.value;
    if (k === 'touch') applyTouchVisibility();
  });
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
function applyTouchVisibility() {
  const show = settings.touch === 'on' || (settings.touch === 'auto' && isTouchDevice());
  $('stickL').hidden = !show;
  $('stickR').hidden = !show;
  document.body.classList.toggle('touch', show);
}
function updateStickLabels() {
  const m2 = settings.radio === '2';
  $('stickLLabel').textContent = m2 ? '油門 / 偏航' : '俯仰 / 偏航';
  $('stickRLabel').textContent = m2 ? '俯仰 / 橫滾' : '油門 / 橫滾';
}

function openMenu() {
  paused = true;
  $('btnResume').hidden = !started || match?.phase === 'finished';
  $('btnStart').textContent = started ? '重新開始' : '開始';
  syncMenu();
  $('menu').hidden = false;
}
function closeMenu() {
  $('menu').hidden = true;
  paused = false;
  lastTime = performance.now();
}

$('btnStart').addEventListener('click', () => {
  saveSettings(settings);
  sound.start();
  startGame();
  closeMenu();
});
$('btnResume').addEventListener('click', closeMenu);
$('btnPause').addEventListener('click', () => (paused ? started && closeMenu() : openMenu()));
$('btnCam').addEventListener('click', cycleCamera);
$('btnSwitch').addEventListener('click', switchDrone);
$('btnSound').addEventListener('click', toggleSound);
$('btnAgain').addEventListener('click', () => {
  $('result').hidden = true;
  startGame();
  closeMenu();
});
$('btnMenu').addEventListener('click', () => {
  $('result').hidden = true;
  openMenu();
});

// ---------- 遊戲 ----------
function startGame() {
  const field = makeField(settings.field, Number(settings.goal));
  const practice = settings.mode === 'practice';
  const n = Number(settings.team);
  world = practice
    ? new World(field, { teamRoles: [['striker'], settings.opp === 'keeper' ? ['keeper'] : []] })
    : new World(field, { teamSizes: [n, n] });
  match = practice
    ? new Match({ mode: 'practice' })
    : new Match({ setDuration: Number(settings.time), sets: Number(settings.sets) });
  const wanted = practice ? 'striker' : settings.role;
  const own = world.teamDrones(0);
  setPlayer(own.find((d) => d.role === wanted) ?? own[0]);
  input.setModes(Number(settings.radio), settings.flight);
  updateStickLabels();
  renderer.build(world);
  renderer.cameraMode = 'chase';
  $('camLabel').textContent = CAMERA_LABELS.chase;
  renderer.snap = true;
  started = true;
  accumulator = 0;
  buildSetDots();
  if (practice) showBanner('自由練習', '飛過藍色球門環即得分', 'gold', 2.5);
}

// 選單背景：AI 對 AI 的示範比賽
function startDemo() {
  world = new World(makeField('DS40'), { teamSizes: [5, 5] });
  match = new Match({ setDuration: 180, sets: 3 });
  player = world.striker(0);
  renderer.build(world);
  buildSetDots();
}

function setPlayer(d) {
  if (player) {
    player.controlledByPlayer = false;
    player.flightMode = 'althold';
    player.ai = {};
  }
  player = d;
  player.controlledByPlayer = true;
  player.flightMode = settings.flight;
  input.kbThrottle = player.onGround ? -1 : 0;
}

function switchDrone() {
  if (!world || settings.mode === 'practice') return;
  const own = world.teamDrones(0);
  const i = own.indexOf(player);
  setPlayer(own[(i + 1) % own.length]);
  renderer.snap = true;
  toast(`改為操控：${ROLE_LABELS[player.role]}`);
}

function cycleCamera() {
  const m = renderer.cycleCamera();
  $('camLabel').textContent = CAMERA_LABELS[m];
  toast(CAMERA_LABELS[m]);
}

function toggleSound() {
  sound.start();
  sound.setMuted(!sound.muted);
  $('soundLabel').textContent = sound.muted ? '音效 關' : '音效 開';
}

function resetPlayer() {
  if (settings.mode !== 'practice' || !world) return;
  world.resetPositions();
  input.kbThrottle = -1;
  toast('已重置位置');
}

// ---------- 訊息 ----------
let bannerTimer = 0;
function showBanner(big, small = '', cls = '', time = 2) {
  const b = $('banner');
  b.className = `banner ${cls}`;
  $('bannerBig').textContent = big;
  $('bannerSmall').textContent = small;
  b.style.opacity = 1;
  bannerTimer = time;
}
let toastTimer = 0;
function toast(text, time = 1.6) {
  const t = $('toast');
  t.textContent = text;
  t.style.opacity = 1;
  toastTimer = time;
}

function handleEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'goal': {
        const mine = e.team === 0;
        showBanner(
          mine ? '紅隊得分！' : '藍隊得分！',
          e.drone === player ? '漂亮！回到己方半場以再次得分' : '',
          mine ? 'red' : 'blue',
          2.2,
        );
        renderer.flashGoal(1 - e.team);
        sound.chime(mine ? [660, 880, 1320] : [520, 390, 300]);
        break;
      }
      case 'rearm':
        if (e.drone === player) toast('已回到己方半場：可再次得分');
        break;
      case 'knockdown':
        if (e.drone === player) toast(`墜機！${PHYSICS.recoverTime} 秒後可重新起飛`);
        break;
      case 'hit':
        if (e.a === player || e.b === player) sound.hit(e.speed);
        break;
      case 'wall':
        if (e.drone === player) sound.hit(e.speed * 0.5);
        break;
      case 'start':
        showBanner('開始！', `第 ${e.set + 1} 局`, 'gold', 1.2);
        sound.chime([880, 1320]);
        break;
      case 'setEnd': {
        const w = e.winner === null ? '本局平手' : `${e.winner === 0 ? '紅隊' : '藍隊'}贏得第 ${e.set + 1} 局`;
        showBanner(`${e.goals[0]} : ${e.goals[1]}`, w, e.winner === 0 ? 'red' : e.winner === 1 ? 'blue' : 'gold', 3.5);
        sound.buzzer();
        break;
      }
      case 'nextSet':
        input.kbThrottle = -1;
        break;
      case 'matchEnd':
        showResult();
        break;
    }
  }
}

function showResult() {
  const w = match.winner;
  $('resultTitle').textContent = w === null ? '平手！' : w === 0 ? '紅隊獲勝！' : '藍隊獲勝';
  $('resultTitle').style.color = w === null ? 'var(--gold)' : w === 0 ? 'var(--red)' : 'var(--blue)';
  $('resultBody').innerHTML =
    match.setResults
      .map((r, i) => `<tr><td>第 ${i + 1} 局</td><td>${r.goals[0]}</td><td>${r.goals[1]}</td></tr>`)
      .join('') +
    `<tr><td>總進球</td><td>${match.totalGoals[0]}</td><td>${match.totalGoals[1]}</td></tr>` +
    `<tr><td>勝局</td><td>${match.setsWon[0]}</td><td>${match.setsWon[1]}</td></tr>`;
  setTimeout(() => {
    if (match?.phase === 'finished') $('result').hidden = false;
  }, 1500);
}

// ---------- HUD ----------
function buildSetDots() {
  const need = match.mode === 'practice' ? 0 : match.setsToWin;
  for (const id of ['setsRed', 'setsBlue']) $(id).innerHTML = '<i></i>'.repeat(need);
}

function fmtTime(s) {
  const t = Math.ceil(Math.max(0, s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function updateHud() {
  $('goalsRed').textContent = match.goals[0];
  $('goalsBlue').textContent = match.goals[1];
  ['setsRed', 'setsBlue'].forEach((id, team) =>
    $(id)
      .querySelectorAll('i')
      .forEach((dot, i) => dot.classList.toggle('won', i < match.setsWon[team])),
  );
  const clock = $('clock');
  if (match.mode === 'practice') {
    clock.textContent = fmtTime(match.timer);
    $('setLabel').textContent = '練習';
    clock.classList.remove('low');
  } else if (match.phase === 'countdown') {
    clock.textContent = String(Math.ceil(match.timer));
    $('setLabel').textContent = `第 ${match.setIndex + 1} 局 準備`;
  } else if (match.phase === 'break') {
    clock.textContent = '0:00';
    $('setLabel').textContent = '局間休息';
  } else {
    clock.textContent = fmtTime(match.timer);
    $('setLabel').textContent = match.phase === 'finished' ? '比賽結束' : `第 ${match.setIndex + 1} / ${match.sets} 局`;
    clock.classList.toggle('low', match.timer <= 10 && match.phase === 'playing');
  }

  if (!player) return;
  $('tRole').textContent = ROLE_LABELS[player.role];
  $('tAlt').textContent = `${(player.pos.y - player.radius).toFixed(1)} m`;
  $('tSpd').textContent = `${Math.hypot(player.vel.x, player.vel.y, player.vel.z).toFixed(1)} m/s`;
  $('tThr').style.width = `${Math.round(player.throttleOut * 100)}%`;
  const st = $('tState');
  if (player.status !== 'ok') {
    st.textContent = '墜機';
    st.className = 'blocked';
  } else if (!player.isStriker) {
    st.textContent = player.onGround ? '待起飛' : '防守中';
    st.className = '';
  } else if (player.canScore) {
    st.textContent = '可得分';
    st.className = 'ready';
  } else {
    st.textContent = '需回己方半場';
    st.className = 'blocked';
  }
}

const mm = $('minimap');
const mmCtx = mm.getContext('2d');
function drawMinimap() {
  const f = world.field;
  const W = mm.width;
  const H = mm.height;
  const pad = 10;
  const s = Math.min((W - 2 * pad) / f.length, (H - 2 * pad) / f.width);
  const ox = W / 2;
  const oy = H / 2;
  const X = (x) => ox + x * s;
  const Y = (z) => oy + z * s;
  const g = mmCtx;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(230,242,239,0.5)';
  g.lineWidth = 2;
  g.strokeRect(X(-f.length / 2), Y(-f.width / 2), f.length * s, f.width * s);
  g.beginPath();
  g.moveTo(X(0), Y(-f.width / 2));
  g.lineTo(X(0), Y(f.width / 2));
  g.stroke();
  for (const goal of world.goals) {
    g.fillStyle = `#${TEAM_COLORS[goal.team].toString(16).padStart(6, '0')}`;
    g.fillRect(X(goal.center.x) - 2, Y(-goal.inner) - 6, 4, goal.inner * 2 * s + 12);
  }
  for (const d of world.drones) {
    const col = `#${TEAM_COLORS[d.team].toString(16).padStart(6, '0')}`;
    g.globalAlpha = d.status === 'ok' ? 1 : 0.4;
    g.fillStyle = col;
    g.beginPath();
    g.arc(X(d.pos.x), Y(d.pos.z), d.isStriker ? 6 : 4.5, 0, Math.PI * 2);
    g.fill();
    if (d.isStriker) {
      g.strokeStyle = d.canScore ? '#ffd23f' : 'rgba(255,210,63,0.35)';
      g.lineWidth = 2;
      g.stroke();
    }
    if (d === player) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(X(d.pos.x), Y(d.pos.z), 10, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}

// ---------- 主迴圈 ----------
function handleActions() {
  if (input.consume('Escape', 'KeyP', 'Pad9')) {
    if (!$('result').hidden) return;
    if (paused && started) closeMenu();
    else if (!paused) openMenu();
  }
  if (input.consume('KeyM')) toggleSound();
  if (paused) return;
  if (input.consume('KeyC', 'Pad3')) cycleCamera();
  if (input.consume('Tab', 'Pad2')) switchDrone();
  if (input.consume('KeyR', 'Pad1')) resetPlayer();
}

function frame(now) {
  requestAnimationFrame(frame);

  // 除錯用：在主控台可用 __sim.world / __sim.player 查看狀態
  window.__sim = {
    get world() {
      return world;
    },
    get match() {
      return match;
    },
    get player() {
      return player;
    },
  };
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const stick = input.sample(dt);
  handleActions();

  const demo = !started; // 選單背景：AI 對 AI 示範
  if (demo && match?.phase === 'finished') startDemo();
  if (world && (!paused || demo)) {
    if (!demo) player.input = { throttle: stick.throttle, yaw: stick.yaw, pitch: stick.pitch, roll: stick.roll };
    const skill = SKILLS[settings.skill]?.level ?? 0.8;
    accumulator += dt;
    const step = PHYSICS.dt;
    let n = 0;
    while (accumulator >= step && n < 20) {
      for (const d of world.drones) {
        if (d !== player || demo) aiUpdate(d, world, d.team === 0 ? Math.max(skill, 0.8) : skill, step);
      }
      const ev = world.step(step).concat(match.update(step, world));
      if (!demo) handleEvents(ev);
      accumulator -= step;
      n++;
    }
    sound.motor(demo ? 0 : player.throttleOut);
  } else {
    sound.motor(0);
  }

  if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) $('banner').style.opacity = 0;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').style.opacity = 0;

  if (world) {
    hudTimer -= dt;
    if (hudTimer <= 0) {
      updateHud();
      drawMinimap();
      hudTimer = 1 / 15;
    }
    renderer.render(paused ? 0 : dt, player);
  }
  input.endFrame();
}

// ---------- 初始化 ----------
input.attachTouch($('stickL'), $('stickR'));
applyTouchVisibility();
syncMenu();
startDemo();
renderer.cameraMode = 'stand';
$('camLabel').textContent = CAMERA_LABELS.stand;
openMenu();
requestAnimationFrame(frame);

// 除錯用：在主控台可用 __sim.world / __sim.player 查看狀態
window.__sim = {
  get world() {
    return world;
  },
  get match() {
    return match;
  },
  get player() {
    return player;
  },
};
