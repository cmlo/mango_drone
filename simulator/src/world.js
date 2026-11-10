// 場地、球門與碰撞處理
import { PHYSICS } from './config.js';
import { Drone } from './drone.js';
import { vec, add, sub, scale, dot, len, clamp } from './vec.js';

export function createGoals(field) {
  const x = field.length / 2 - field.goalOffset;
  const ring = {
    R: (field.goalInner + field.goalOuter) / 4, // 環管中心線半徑
    tube: (field.goalOuter - field.goalInner) / 4, // 環管半徑
    inner: field.goalInner / 2,
  };
  return [
    { team: 0, center: vec(-x, field.goalHeight, 0), normal: vec(1, 0, 0), ...ring },
    { team: 1, center: vec(x, field.goalHeight, 0), normal: vec(-1, 0, 0), ...ring },
  ];
}

// 開場位置：各隊在己方球門前一字排開，攻擊手居中
export function startPositions(field, team, count) {
  const sign = team === 0 ? -1 : 1;
  const x = sign * (field.length / 2 - field.goalOffset - 1.6);
  const spread = Math.min(field.width - 2, 1.6 * (count - 1));
  const out = [];
  for (let i = 0; i < count; i++) {
    // 0 = 攻擊手在中間，其餘左右交錯
    const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
    const z = count > 1 ? (k * spread) / (count - 1 || 1) : 0;
    out.push({ pos: vec(x, field.ballRadius, z), yaw: team === 0 ? 0 : Math.PI });
  }
  return out;
}

export const ROLE_ORDER = ['striker', 'keeper', 'chaser', 'escort', 'blocker'];

export class World {
  // teamRoles 可自訂各隊角色，例如 [['striker'], ['keeper']]（練習模式）
  constructor(field, { teamSizes = [5, 5], teamRoles = null, flightMode = 'althold', rng = Math.random } = {}) {
    this.field = field;
    this.rng = rng;
    this.goals = createGoals(field);
    this.drones = [];
    this.time = 0;
    this.motorsEnabled = true;
    this.landing = false; // 局間自動降落
    const roles =
      teamRoles ?? teamSizes.map((n) => ROLE_ORDER.slice(0, n).concat(Array(Math.max(0, n - 5)).fill('blocker')));
    roles.forEach((list, team) => {
      startPositions(field, team, list.length).forEach((s, i) => {
        this.drones.push(new Drone({ team, role: list[i], field, position: s.pos, yaw: s.yaw, flightMode }));
      });
    });
  }

  teamDrones(team) {
    return this.drones.filter((d) => d.team === team);
  }
  striker(team) {
    return this.drones.find((d) => d.team === team && d.isStriker);
  }

  resetPositions() {
    [0, 1].forEach((team) => {
      const ds = this.teamDrones(team);
      startPositions(this.field, team, ds.length).forEach((s, i) => {
        ds[i].reset(s.pos, s.yaw);
        ds[i].canScore = true;
        ds[i].ai = {};
      });
    });
  }

  step(dt) {
    const events = [];
    this.time += dt;
    for (const d of this.drones) d.step(dt, this.motorsEnabled, this.landing);
    const n = this.drones.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) this.collideDrones(this.drones[i], this.drones[j], events);
    }
    for (const d of this.drones) for (const g of this.goals) this.collideGoal(d, g);
    // 網籠邊界最後處理，確保機體不會被推出場外
    for (const d of this.drones) this.collideArena(d, dt, events);
    return events;
  }

  maybeKnockdown(d, impactSpeed, massFactor, events) {
    const P = PHYSICS;
    if (d.status !== 'ok' || d.onGround) return;
    const chance = clamp(((impactSpeed - P.knockdownSpeed) / P.knockdownSpan) * massFactor, 0, P.knockdownMaxChance);
    if (chance > 0 && this.rng() < chance && d.knockDown(this.rng)) {
      events.push({ type: 'knockdown', drone: d });
    }
  }

  collideArena(d, dt, events) {
    const f = this.field;
    const r = d.radius;
    const P = PHYSICS;
    const e = P.wallRestitution;
    const bounds = [
      ['x', -f.length / 2 + r, f.length / 2 - r],
      ['z', -f.width / 2 + r, f.width / 2 - r],
    ];
    for (const [k, lo, hi] of bounds) {
      let hit = 0;
      if (d.pos[k] < lo) {
        d.pos[k] = lo;
        if (d.vel[k] < 0) hit = -d.vel[k];
      } else if (d.pos[k] > hi) {
        d.pos[k] = hi;
        if (d.vel[k] > 0) hit = d.vel[k];
      }
      if (hit > 0) {
        d.vel[k] = -d.vel[k] * e;
        // 撞網：輕微擾動姿態
        d.pitchRate += (this.rng() - 0.5) * hit * 1.5;
        d.rollRate += (this.rng() - 0.5) * hit * 1.5;
        if (hit > 1) events.push({ type: 'wall', drone: d, speed: hit });
        this.maybeKnockdown(d, hit, 0.6, events);
      }
    }
    // 天花板
    if (d.pos.y > f.height - r) {
      d.pos.y = f.height - r;
      if (d.vel.y > 0) d.vel.y = -d.vel.y * e;
    }
    // 地板
    if (d.pos.y <= r) {
      d.pos.y = r;
      if (d.vel.y < 0) {
        const impact = -d.vel.y;
        d.vel.y = impact > 1 ? impact * P.floorRestitution : 0;
        if (impact > 1.5) events.push({ type: 'floor', drone: d, speed: impact });
      }
      d.onGround = true;
      if (d.status === 'down' || d.thrust < d.mass * P.g * 0.5) {
        const k = Math.exp(-6 * dt);
        d.vel.x *= k;
        d.vel.z *= k;
      }
    } else {
      d.onGround = d.pos.y <= r + 0.002;
    }
  }

  // 與球門環（圓環 torus）及支柱碰撞
  collideGoal(d, g) {
    const r = d.radius;
    const dv = sub(d.pos, g.center);
    const axial = dot(dv, g.normal);
    const radial = sub(dv, scale(g.normal, axial));
    const rl = len(radial);
    const dir = rl > 1e-6 ? scale(radial, 1 / rl) : vec(0, 1, 0);
    const closest = add(g.center, scale(dir, g.R));
    this.pushOutOfPoint(d, closest, g.tube + r);

    // 支柱：從地面到環底部的細桿
    const topY = g.center.y - g.R - g.tube;
    const py = clamp(d.pos.y, 0, topY);
    this.pushOutOfPoint(d, vec(g.center.x, py, g.center.z), 0.04 + r);
  }

  pushOutOfPoint(d, point, minDist) {
    const delta = sub(d.pos, point);
    const dl = len(delta);
    if (dl >= minDist || dl < 1e-9) return false;
    const n = scale(delta, 1 / dl);
    d.pos = add(point, scale(n, minDist));
    const vn = dot(d.vel, n);
    if (vn < 0) {
      d.vel = sub(d.vel, scale(n, (1 + PHYSICS.wallRestitution) * vn));
      d.pitchRate += (this.rng() - 0.5) * -vn * 2;
      d.rollRate += (this.rng() - 0.5) * -vn * 2;
    }
    return true;
  }

  collideDrones(a, b, events) {
    const P = PHYSICS;
    const delta = sub(b.pos, a.pos);
    const dl = len(delta);
    const minD = a.radius + b.radius;
    if (dl >= minD || dl < 1e-9) return;
    const n = scale(delta, 1 / dl);
    const ima = 1 / a.mass;
    const imb = 1 / b.mass;
    const overlap = minD - dl;
    a.pos = sub(a.pos, scale(n, (overlap * ima) / (ima + imb)));
    b.pos = add(b.pos, scale(n, (overlap * imb) / (ima + imb)));

    const rv = sub(b.vel, a.vel);
    const vn = dot(rv, n);
    if (vn >= 0) return;
    const j = (-(1 + P.droneRestitution) * vn) / (ima + imb);
    a.vel = sub(a.vel, scale(n, j * ima));
    b.vel = add(b.vel, scale(n, j * imb));

    // 切向摩擦
    const vt = sub(rv, scale(n, vn));
    const vtl = len(vt);
    if (vtl > 1e-6) {
      const jt = Math.min(P.contactFriction * j, vtl / (ima + imb));
      const t = scale(vt, 1 / vtl);
      a.vel = add(a.vel, scale(t, jt * ima));
      b.vel = sub(b.vel, scale(t, jt * imb));
    }

    // 撞擊擾動姿態
    const impact = -vn;
    for (const [d, im] of [
      [a, ima],
      [b, imb],
    ]) {
      const k = j * im * 1.6;
      d.pitchRate += (this.rng() - 0.5) * k;
      d.rollRate += (this.rng() - 0.5) * k;
      d.yawSpin += (this.rng() - 0.5) * k * 1.5;
    }
    if (impact > 0.4) events.push({ type: 'hit', a, b, speed: impact });
    const total = a.mass + b.mass;
    this.maybeKnockdown(a, impact, (2 * b.mass) / total, events);
    this.maybeKnockdown(b, impact, (2 * a.mass) / total, events);
  }
}
