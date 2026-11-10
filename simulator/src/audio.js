// 簡易音效：馬達聲、碰撞聲、得分提示（Web Audio，需使用者互動後才啟動）
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(c.destination);
    this.motorGain = c.createGain();
    this.motorGain.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    this.osc = c.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 110;
    this.osc2 = c.createOscillator();
    this.osc2.type = 'square';
    this.osc2.frequency.value = 113;
    const g2 = c.createGain();
    g2.gain.value = 0.3;
    this.osc.connect(lp);
    this.osc2.connect(g2).connect(lp);
    lp.connect(this.motorGain).connect(this.master);
    this.osc.start();
    this.osc2.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  motor(throttle) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 95 + throttle * 300;
    this.osc.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(f * 1.02, t, 0.05);
    this.motorGain.gain.setTargetAtTime(throttle > 0.01 ? 0.05 + throttle * 0.12 : 0, t, 0.08);
  }

  hit(strength = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const len = 0.12;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = Math.min(0.9, 0.15 + strength * 0.12);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  chime(notes = [660, 880, 1320]) {
    if (!this.ctx) return;
    const c = this.ctx;
    notes.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = c.currentTime + i * 0.11;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.4);
    });
  }

  buzzer() {
    this.chime([440, 440, 330]);
  }
}
