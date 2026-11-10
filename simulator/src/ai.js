// AI 飛手：與玩家一樣只輸出搖桿量（俯仰 / 橫滾 / 偏航 / 油門），由同一套物理飛行
import { PHYSICS } from './config.js';
import { vec, add, sub, scale, dot, len, dist, norm, clampLen, clamp, wrapAngle } from './vec.js';

export const SKILLS = {
  easy: { label: '簡單', level: 0.6 },
  normal: { label: '普通', level: 0.8 },
  hard: { label: '困難', level: 1.0 },
};

// 速度空間的「到達」行為：越接近目標越慢
function arrive(p, target, vmax, gain = 1.4) {
  return clampLen(scale(sub(target, p), gain), vmax);
}

function clampTarget(t, field, r) {
  const m = r + 0.5;
  return vec(
    clamp(t.x, -field.length / 2 + m, field.length / 2 - m),
    clamp(t.y, r + 0.5, field.height - r - 0.5),
    clamp(t.z, -field.width / 2 + m, field.width / 2 - m),
  );
}

// 把期望速度轉換成搖桿量（AI 一律使用定高輔助）
export function velocityToSticks(drone, vdes, skill = 1, faceDir = null) {
  const P = PHYSICS;
  const kv = 2.6 * (0.7 + 0.3 * skill);
  const ax = (vdes.x - drone.vel.x) * kv;
  const az = (vdes.z - drone.vel.z) * kv;
  let ah = { x: ax, y: 0, z: az };
  const amax = P.g * Math.tan(P.maxTilt) * (0.55 + 0.45 * skill);
  ah = clampLen(ah, amax);
  const f = drone.forward();
  const r = drone.right();
  const pitch = Math.atan(dot(ah, f) / P.g) / P.maxTilt;
  const roll = Math.atan(dot(ah, r) / P.g) / P.maxTilt;
  const throttle = clamp(vdes.y / P.maxClimb, -1, 1);

  let yaw = 0;
  const dir = faceDir ?? (Math.hypot(vdes.x, vdes.z) > 0.6 ? vdes : null);
  if (dir) {
    const want = Math.atan2(-dir.z, dir.x);
    yaw = clamp(-wrapAngle(want - drone.yaw) * 2.2, -1, 1);
  }
  return { throttle, yaw, pitch: clamp(pitch, -1, 1), roll: clamp(roll, -1, 1) };
}

function separation(drone, others, radius, strength) {
  let v = vec();
  for (const o of others) {
    if (o === drone || o.status !== 'ok') continue;
    const d = sub(drone.pos, o.pos);
    const l = len(d);
    if (l > 1e-6 && l < radius) v = add(v, scale(d, ((radius - l) / l) * strength));
  }
  return v;
}

// 攻擊手：對準球門軸線 → 穩住 → 直線穿越；得分後返回己方半場
function strikerVelocity(drone, world, skill) {
  const field = world.field;
  const mem = drone.ai;
  const goal = world.goals.find((g) => g.team !== drone.team);
  const vmax = 2.5 + 3.5 * skill;
  const opponents = world.drones.filter((o) => o.team !== drone.team);

  if (!drone.canScore) {
    mem.passing = false;
    const sign = drone.team === 0 ? -1 : 1;
    const t = vec(sign * 2.5, goal.center.y, clamp(drone.pos.z, -2, 2));
    let v = arrive(drone.pos, t, vmax);
    v = add(v, separation(drone, opponents, 1.6, 1.4));
    return { v };
  }

  const n = goal.normal;
  const c = goal.center;
  const dv = sub(drone.pos, c);
  const axial = dot(dv, n);
  const lat = sub(dv, scale(n, axial));
  const latLen = len(lat);
  const tol = Math.max(goal.inner - drone.radius - 0.02, 0.03);
  const velLat = sub(drone.vel, scale(n, dot(drone.vel, n)));

  // 穿越中：維持對正並推進
  if (mem.passing) {
    if (axial < -0.8 || latLen > tol * 2.2) mem.passing = false;
    else {
      const v = add(scale(n, -(1.4 + 1.6 * skill)), scale(lat, -3));
      return { v, face: scale(n, -1) };
    }
  }

  // 在球門後方或側邊：先橫移離開軸線，再繞回正面
  if (axial < 0.4) {
    const side = Math.abs(dv.z) > 0.05 ? Math.sign(dv.z) : drone.id % 2 ? 1 : -1;
    const t = Math.abs(dv.z) < 1.2 ? vec(drone.pos.x, c.y, c.z + side * 1.6) : add(c, vec(n.x * 2.2, 0, side * 1.6));
    return { v: arrive(drone.pos, clampTarget(t, field, drone.radius), vmax) };
  }

  const aligned = latLen < tol * 0.8 && len(velLat) < 0.35 + 0.25 * skill;
  if (aligned && axial < 3.2) {
    mem.passing = true;
    return { v: add(scale(n, -(1.4 + 1.6 * skill)), scale(lat, -3)), face: scale(n, -1) };
  }

  // 接近：先到軸線上距球門約 2 m 處
  const hold = clamp(axial, 1.8, 2.4);
  const target = add(c, scale(n, hold));
  let v = arrive(drone.pos, target, vmax, axial > 3.5 ? 1.4 : 2.0);
  if (axial > 3) v = add(v, separation(drone, opponents, 1.7, 1.6));
  return { v, face: axial < 4 ? scale(n, -1) : null };
}

function defenderVelocity(drone, world, skill) {
  const field = world.field;
  const own = world.goals.find((g) => g.team === drone.team);
  const enemyStriker = world.striker(1 - drone.team);
  const myStriker = world.striker(drone.team);
  const vmax = 2.5 + 3.5 * skill;
  const sign = drone.team === 0 ? -1 : 1;
  const threat = enemyStriker && enemyStriker.status === 'ok' && enemyStriker.canScore;
  const n = own.normal;
  let target;
  let gain = 1.4;
  let ram = false; // 衝撞模式：全速直衝目標

  switch (drone.role) {
    case 'keeper': {
      // 守在球門正前方，敵方攻擊手逼近時正面攔截
      target = add(own.center, scale(n, 1.3));
      if (threat) {
        const rel = sub(enemyStriker.pos, own.center);
        const ax = dot(rel, n);
        if (ax > 0 && ax < 2.6 && len(sub(rel, scale(n, ax))) < 1.2) {
          target = add(enemyStriker.pos, scale(enemyStriker.vel, 0.2));
          gain = 3;
        } else {
          target = add(target, vec(0, clamp(rel.y * 0.2, -0.3, 0.3), clamp(rel.z * 0.15, -0.4, 0.4)));
        }
      }
      break;
    }
    case 'chaser': {
      // 追撞敵方攻擊手
      if (threat) {
        target = add(enemyStriker.pos, scale(enemyStriker.vel, 0.35));
        ram = true;
      } else {
        target = vec(sign * 1.5, 2, enemyStriker ? clamp(enemyStriker.pos.z, -3, 3) : 0);
      }
      break;
    }
    case 'escort': {
      // 護航：撞開最靠近我方攻擊手的敵方防守機
      // 我方攻擊手接近敵門時，改撞敵方門前的守門機
      const blockers = world.drones.filter((o) => o.team !== drone.team && !o.isStriker && o.status === 'ok');
      const enemyGoal = world.goals.find((g) => g.team !== drone.team);
      if (myStriker && blockers.length) {
        const nearGoal = myStriker.canScore && dist(myStriker.pos, enemyGoal.center) < 5;
        const ref = nearGoal ? enemyGoal.center : myStriker.pos;
        let best = blockers[0];
        for (const b of blockers) if (dist(b.pos, ref) < dist(best.pos, ref)) best = b;
        target = add(best.pos, scale(best.vel, 0.3));
        ram = true;
      } else {
        target = myStriker ? add(myStriker.pos, vec(-sign * 1.5, 0, 1)) : vec(0, 2, 0);
      }
      break;
    }
    default: {
      // 封堵：站在敵方攻擊手與我方球門連線中段
      if (threat) {
        const a = add(own.center, scale(n, 1.2));
        target = add(a, scale(sub(enemyStriker.pos, a), 0.45));
      } else {
        target = add(own.center, vec(n.x * 3, 0.3, 1.5));
      }
    }
  }

  target = clampTarget(target, field, drone.radius);
  if (ram) {
    const to = sub(target, drone.pos);
    if (len(to) < 4) return { v: scale(norm(to), vmax * 0.95) };
  }
  return { v: arrive(drone.pos, target, vmax, gain) };
}

export function aiUpdate(drone, world, skillLevel, dt, rng = Math.random) {
  if (drone.status !== 'ok') {
    drone.input = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    return;
  }
  const res = drone.isStriker ? strikerVelocity(drone, world, skillLevel) : defenderVelocity(drone, world, skillLevel);
  let v = res.v;

  // 隊友間保持距離
  const mates = world.drones.filter((o) => o.team === drone.team);
  v = add(v, separation(drone, mates, 1.0, 1.2));

  // 操作雜訊（難度越低越大）
  const mem = drone.ai;
  mem.noise ??= vec();
  const sigma = (1 - skillLevel) * 5;
  for (const k of ['x', 'y', 'z']) {
    mem.noise[k] += (-mem.noise[k] * 1.5 + (rng() - 0.5) * sigma * 2) * dt;
  }
  if (!(drone.isStriker && mem.passing)) v = add(v, mem.noise);

  drone.input = velocityToSticks(drone, v, skillLevel, res.face ?? null);
}
