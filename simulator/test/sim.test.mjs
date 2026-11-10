import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeField, PHYSICS } from '../src/config.js';
import { World } from '../src/world.js';
import { Match, crossedGoal } from '../src/rules.js';
import { aiUpdate } from '../src/ai.js';
import { vec } from '../src/vec.js';

const field = makeField('DS40');
const dt = PHYSICS.dt;

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

test('定高模式：起飛後可穩定懸停', () => {
  const w = new World(field, { teamSizes: [1, 0] });
  const d = w.drones[0];
  d.input = { throttle: 1, yaw: 0, pitch: 0, roll: 0 };
  for (let i = 0; i < 120; i++) w.step(dt);
  assert.ok(d.pos.y > 1, `應已爬升，y=${d.pos.y}`);
  d.input.throttle = 0;
  for (let i = 0; i < 240; i++) w.step(dt);
  const y = d.pos.y;
  for (let i = 0; i < 240; i++) w.step(dt);
  assert.ok(Math.abs(d.pos.y - y) < 0.05, '懸停高度應穩定');
  assert.ok(Math.abs(d.vel.y) < 0.05);
});

test('向前推桿會朝機頭方向加速', () => {
  const w = new World(field, { teamSizes: [1, 0] });
  const d = w.drones[0];
  d.reset(vec(0, 2, 0), 0);
  d.input = { throttle: 0, yaw: 0, pitch: 1, roll: 0 };
  for (let i = 0; i < 120; i++) w.step(dt);
  assert.ok(d.vel.x > 3, `vx=${d.vel.x}`);
  assert.ok(Math.abs(d.vel.z) < 0.2);
});

test('兩機正面相撞：動量守恆並反彈', () => {
  const w = new World(field, { teamSizes: [1, 1], rng: seeded(3) });
  const [a, b] = w.drones;
  a.reset(vec(-0.5, 2, 0), 0);
  b.reset(vec(0.5, 2, 0), Math.PI);
  a.vel = vec(3, 0, 0);
  b.vel = vec(-3, 0, 0);
  const before = a.vel.x * a.mass + b.vel.x * b.mass;
  for (let i = 0; i < 40; i++) (w.collideDrones(a, b, []), (a.pos.x += a.vel.x * dt), (b.pos.x += b.vel.x * dt));
  const after = a.vel.x * a.mass + b.vel.x * b.mass;
  assert.ok(Math.abs(before - after) < 1e-9);
  assert.ok(a.vel.x < 0 && b.vel.x > 0, '應互相彈開');
});

test('球門環會擋住偏離中心的機體', () => {
  const w = new World(field, { teamSizes: [1, 0] });
  const d = w.drones[0];
  const g = w.goals[1];
  d.reset(vec(g.center.x - 0.25, g.center.y + 0.35, 0), 0);
  d.vel = vec(2, 0, 0);
  for (let i = 0; i < 30; i++) {
    d.pos.x += d.vel.x * dt;
    w.collideGoal(d, g);
  }
  assert.ok(d.vel.x < 2, '撞到環應減速/反彈');
});

test('只有從正面穿過球門環才算得分', () => {
  const w = new World(field, { teamSizes: [1, 0] });
  const d = w.drones[0];
  const g = w.goals[1]; // 藍隊球門，正面朝 -X
  d.prevPos = vec(g.center.x - 0.1, g.center.y, 0);
  d.pos = vec(g.center.x + 0.1, g.center.y, 0);
  assert.equal(crossedGoal(d, g), true);
  [d.prevPos, d.pos] = [d.pos, d.prevPos];
  assert.equal(crossedGoal(d, g), false, '反向穿越不算');
  d.prevPos = vec(g.center.x - 0.1, g.center.y + 0.5, 0);
  d.pos = vec(g.center.x + 0.1, g.center.y + 0.5, 0);
  assert.equal(crossedGoal(d, g), false, '環外不算');
});

test('得分後須回己方半場才可再得分', () => {
  const w = new World(field, { teamSizes: [1, 0] });
  const m = new Match({ mode: 'practice' });
  const d = w.drones[0];
  const g = w.goals[1];
  d.prevPos = vec(g.center.x - 0.1, g.center.y, 0);
  d.pos = vec(g.center.x + 0.1, g.center.y, 0);
  assert.equal(m.update(dt, w).filter((e) => e.type === 'goal').length, 1);
  assert.equal(d.canScore, false);
  d.prevPos = vec(g.center.x - 0.1, g.center.y, 0);
  d.pos = vec(g.center.x + 0.1, g.center.y, 0);
  assert.equal(m.update(dt, w).filter((e) => e.type === 'goal').length, 0);
  d.pos = vec(-1, 2, 0);
  m.update(dt, w);
  assert.equal(d.canScore, true);
  assert.equal(m.goals[0], 1);
});

test('AI 攻擊手在無人防守時能自行穿門得分', () => {
  for (const key of ['DS40', 'DS20']) {
    const f = makeField(key);
    const w = new World(f, { teamSizes: [1, 0], rng: seeded(7) });
    const m = new Match({ mode: 'practice' });
    const d = w.drones[0];
    let goals = 0;
    for (let i = 0; i < 120 * 40 && goals < 2; i++) {
      aiUpdate(d, w, 1, dt, seeded(i));
      w.step(dt);
      goals += m.update(dt, w).filter((e) => e.type === 'goal').length;
    }
    assert.equal(goals, 2, `${key}：40 秒內應得 2 分（含回半場重新取得資格）`);
  }
});

test('完整 AI 對戰可跑完一局且不出錯', () => {
  const w = new World(field, { teamSizes: [5, 5], rng: seeded(11) });
  const m = new Match({ setDuration: 30, sets: 1 });
  const rng = seeded(5);
  let ended = false;
  for (let i = 0; i < 120 * 45 && !ended; i++) {
    for (const d of w.drones) aiUpdate(d, w, 0.8, dt, rng);
    w.step(dt);
    for (const e of m.update(dt, w)) if (e.type === 'matchEnd') ended = true;
    for (const d of w.drones) {
      assert.ok(Number.isFinite(d.pos.x + d.pos.y + d.pos.z), '位置須為有限值');
      assert.ok(Math.abs(d.pos.x) <= field.length / 2 + 1e-6 && d.pos.y >= d.radius - 1e-6);
    }
  }
  assert.ok(ended, '比賽應結束');
});
