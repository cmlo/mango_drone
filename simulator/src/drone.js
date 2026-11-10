// 單架球型無人機的飛行動力學與飛控（自穩 / 定高）
import { PHYSICS } from './config.js';
import { vec, clone, clamp } from './vec.js';

let nextId = 0;

export class Drone {
  constructor({ team, role, field, position, yaw = 0, flightMode = 'althold' }) {
    this.id = nextId++;
    this.team = team; // 0 紅 / 1 藍
    this.role = role; // 'striker' | 'keeper' | 'chaser' | 'escort' | 'blocker'
    this.radius = field.ballRadius;
    this.mass = field.mass;
    this.flightMode = flightMode; // 'althold' 定高輔助 | 'manual' 手動油門
    this.input = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    this.ai = {}; // AI 記憶
    this.controlledByPlayer = false;
    this.canScore = true; // 攻擊手得分資格（得分後需回己方半場）
    this.reset(position, yaw);
  }

  get isStriker() {
    return this.role === 'striker';
  }

  reset(position, yaw = this.yaw ?? 0) {
    this.pos = clone(position);
    this.prevPos = clone(position);
    this.vel = vec();
    this.yaw = yaw;
    this.pitch = 0; // >0 機頭朝下（向前飛）
    this.roll = 0; // >0 右側朝下（向右飛）
    this.pitchRate = 0;
    this.rollRate = 0;
    this.yawSpin = 0; // 撞擊造成的額外偏航
    this.thrust = 0;
    this.throttleOut = 0; // 0..1，用於音效與顯示
    this.status = 'ok'; // 'ok' 正常 | 'down' 失控墜落
    this.downTimer = 0;
    this.onGround = position.y <= this.radius + 0.01;
    this.propPhase = 0;
  }

  // 機體座標軸（世界座標）
  forward() {
    return { x: Math.cos(this.yaw), y: 0, z: -Math.sin(this.yaw) };
  }
  right() {
    return { x: Math.sin(this.yaw), y: 0, z: Math.cos(this.yaw) };
  }
  bodyUp() {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cr = Math.cos(this.roll);
    const sr = Math.sin(this.roll);
    const ux = cr * sp;
    const uy = cr * cp;
    const uz = sr;
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    return { x: ux * cy + uz * sy, y: uy, z: -ux * sy + uz * cy };
  }

  knockDown(rng = Math.random) {
    if (this.status === 'down') return false;
    this.status = 'down';
    this.downTimer = 0;
    this.pitchRate = (rng() - 0.5) * 18;
    this.rollRate = (rng() - 0.5) * 18;
    this.yawSpin = (rng() - 0.5) * 10;
    return true;
  }

  // motorsEnabled=false 時（倒數）馬達怠速；forceLand=true 時（局間）自動降落
  step(dt, motorsEnabled = true, forceLand = false) {
    const P = PHYSICS;
    const maxThrust = this.mass * P.g * P.thrustToWeight;
    const inp = forceLand ? { throttle: -0.5, yaw: 0, pitch: 0, roll: 0 } : this.input;
    const mode = forceLand ? 'althold' : this.flightMode;
    let thrust = 0;

    if (this.status === 'ok') {
      const idleOnGround =
        !motorsEnabled || (this.onGround && (mode === 'althold' ? inp.throttle < 0.1 : inp.throttle < -0.6));

      // 姿態：二階追蹤目標傾角（自穩模式）
      const tgtPitch = idleOnGround ? 0 : clamp(inp.pitch, -1, 1) * P.maxTilt;
      const tgtRoll = idleOnGround ? 0 : clamp(inp.roll, -1, 1) * P.maxTilt;
      const w = P.attitudeOmega;
      const z = P.attitudeZeta;
      this.pitchRate += (w * w * (tgtPitch - this.pitch) - 2 * z * w * this.pitchRate) * dt;
      this.rollRate += (w * w * (tgtRoll - this.roll) - 2 * z * w * this.rollRate) * dt;
      this.pitch += this.pitchRate * dt;
      this.roll += this.rollRate * dt;

      const yawCmd = idleOnGround ? 0 : -clamp(inp.yaw, -1, 1) * P.maxYawRate;
      this.yaw += (yawCmd + this.yawSpin) * dt;
      this.yawSpin *= Math.exp(-3 * dt);

      if (!idleOnGround) {
        if (mode === 'althold') {
          const vzTarget = clamp(inp.throttle, -1, 1) * P.maxClimb;
          const az = 5 * (vzTarget - this.vel.y);
          const tiltComp = Math.max(Math.cos(this.pitch) * Math.cos(this.roll), 0.5);
          thrust = (this.mass * (P.g + az)) / tiltComp;
        } else {
          thrust = ((clamp(inp.throttle, -1, 1) + 1) / 2) * maxThrust;
        }
        thrust = clamp(thrust, 0, maxThrust);
      }

      if (Math.abs(this.pitch) > P.lossOfControlTilt || Math.abs(this.roll) > P.lossOfControlTilt) {
        this.knockDown();
      }
    } else {
      // 失控：馬達停止、翻滾
      this.pitch += this.pitchRate * dt;
      this.roll += this.rollRate * dt;
      this.yaw += this.yawSpin * dt;
      if (this.onGround) {
        const damp = Math.exp(-4 * dt);
        this.pitchRate *= damp;
        this.rollRate *= damp;
        this.yawSpin *= damp;
        this.downTimer += dt;
        if (this.downTimer >= P.recoverTime) {
          // 扶正、可重新起飛
          this.status = 'ok';
          this.pitch = this.roll = this.pitchRate = this.rollRate = this.yawSpin = 0;
        }
      }
    }

    this.thrust = thrust;
    this.throttleOut = thrust / maxThrust;
    this.propPhase += (0.15 + this.throttleOut) * 90 * dt;

    // 力：推力 + 重力 + 空氣阻力
    const up = this.bodyUp();
    const a = {
      x: (up.x * thrust) / this.mass,
      y: (up.y * thrust) / this.mass - P.g,
      z: (up.z * thrust) / this.mass,
    };
    const speed = Math.hypot(this.vel.x, this.vel.y, this.vel.z);
    const drag = P.dragLinear + P.dragQuadratic * speed;
    a.x -= this.vel.x * drag;
    a.y -= this.vel.y * drag;
    a.z -= this.vel.z * drag;

    this.prevPos = clone(this.pos);
    this.vel.x += a.x * dt;
    this.vel.y += a.y * dt;
    this.vel.z += a.z * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
  }
}
