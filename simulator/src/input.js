// 輸入：鍵盤、遊戲手把（Gamepad API）、觸控虛擬搖桿
// 輸出統一為搖桿量 { throttle, yaw, pitch, roll }，範圍 -1..1
import { clamp } from './vec.js';

const DEAD = 0.08;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
const expo = (v, e = 0.35) => v * (1 - e) + v * v * v * e;

class VirtualStick {
  constructor(el, { springY = true } = {}) {
    this.el = el;
    this.knob = el.querySelector('.knob');
    this.springY = springY;
    this.x = 0;
    this.y = 0;
    this.pointer = null;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
  }
  onDown(e) {
    e.preventDefault();
    this.pointer = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.onMove(e);
  }
  onMove(e) {
    if (e.pointerId !== this.pointer) return;
    const r = this.el.getBoundingClientRect();
    const half = r.width / 2;
    let x = (e.clientX - (r.left + half)) / (half * 0.8);
    let y = -(e.clientY - (r.top + r.height / 2)) / (half * 0.8);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    this.x = x;
    this.y = y;
    this.draw();
  }
  onUp(e) {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    this.x = 0;
    if (this.springY) this.y = 0;
    this.draw();
  }
  draw() {
    const r = this.el.clientWidth * 0.4;
    this.knob.style.transform = `translate(calc(-50% + ${this.x * r}px), calc(-50% + ${-this.y * r}px))`;
  }
}

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // 本幀剛按下
    this.radioMode = 2; // 美國手 Mode 2 / 日本手 Mode 1
    this.flightMode = 'althold';
    this.kbThrottle = -1; // 手動油門模式下，鍵盤油門為「不回中」
    this.prevButtons = [];
    this.lastSource = 'keyboard';
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.lastSource = 'keyboard';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  attachTouch(leftEl, rightEl) {
    this.leftStick = new VirtualStick(leftEl, { springY: true });
    this.rightStick = new VirtualStick(rightEl, { springY: true });
    this.applyTouchSpring();
  }

  // 手動油門時油門搖桿不回中（左手 Mode 2 / 右手 Mode 1）
  applyTouchSpring() {
    if (!this.leftStick) return;
    const manual = this.flightMode === 'manual';
    this.leftStick.springY = !(manual && this.radioMode === 2);
    this.rightStick.springY = !(manual && this.radioMode === 1);
    if (manual) {
      const s = this.radioMode === 2 ? this.leftStick : this.rightStick;
      if (s.pointer === null) {
        s.y = -1;
        s.draw();
      }
    }
  }

  setModes(radioMode, flightMode) {
    this.radioMode = radioMode;
    this.flightMode = flightMode;
    this.kbThrottle = -1;
    this.applyTouchSpring();
  }

  // 消耗一次性按鍵事件
  consume(...codes) {
    for (const c of codes) {
      if (this.pressed.has(c)) {
        this.pressed.delete(c);
        return true;
      }
    }
    return false;
  }

  readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || gp.axes.length < 4) continue;
      const btn = gp.buttons.map((b) => b.pressed);
      btn.forEach((p, i) => {
        if (p && !this.prevButtons[i]) this.pressed.add(`Pad${i}`);
      });
      this.prevButtons = btn;
      const ax = gp.axes.map(dz);
      if (ax.some((v) => v !== 0) || btn.some(Boolean)) this.lastSource = 'gamepad';
      return ax;
    }
    return null;
  }

  // 依 Mode 1/2 把左右搖桿對應到四個通道
  mapSticks(lx, ly, rx, ry) {
    if (this.radioMode === 1) return { yaw: lx, pitch: ly, roll: rx, throttle: ry };
    return { yaw: lx, throttle: ly, roll: rx, pitch: ry };
  }

  sample(dt) {
    const k = (c) => (this.keys.has(c) ? 1 : 0);
    const out = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };

    // 鍵盤（固定 Mode 2 配置）：W/S 油門、A/D 偏航、方向鍵或 I/K/J/L 俯仰橫滾
    const kThr = k('KeyW') - k('KeyS');
    out.yaw = k('KeyD') - k('KeyA');
    out.pitch = k('ArrowUp') + k('KeyI') - k('ArrowDown') - k('KeyK');
    out.roll = k('ArrowRight') + k('KeyL') - k('ArrowLeft') - k('KeyJ');
    out.pitch = clamp(out.pitch, -1, 1) * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 0.45 : 1);
    out.roll = clamp(out.roll, -1, 1) * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 0.45 : 1);
    if (this.flightMode === 'manual') {
      this.kbThrottle = clamp(this.kbThrottle + kThr * dt * 1.4, -1, 1);
      out.throttle = this.kbThrottle;
    } else {
      out.throttle = kThr;
    }
    let used = out.yaw || out.pitch || out.roll || kThr;

    // 觸控
    if (this.leftStick) {
      const t = this.mapSticks(this.leftStick.x, this.leftStick.y, this.rightStick.x, this.rightStick.y);
      const touching = this.leftStick.pointer !== null || this.rightStick.pointer !== null;
      if (touching || this.flightMode === 'manual') {
        if (touching) this.lastSource = 'touch';
        if (this.lastSource === 'touch') {
          out.yaw = expo(t.yaw);
          out.pitch = expo(t.pitch);
          out.roll = expo(t.roll);
          out.throttle = t.throttle;
          used = true;
        }
      }
    }

    // 手把
    const ax = this.readGamepad();
    if (ax && this.lastSource === 'gamepad') {
      const g = this.mapSticks(ax[0], -ax[1], ax[2], -ax[3]);
      out.yaw = expo(g.yaw);
      out.pitch = expo(g.pitch);
      out.roll = expo(g.roll);
      out.throttle = g.throttle;
      used = true;
    }
    out.active = Boolean(used);
    return out;
  }

  endFrame() {
    this.pressed.clear();
  }
}
