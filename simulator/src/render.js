// three.js 3D 呈現：場地、網籠、球門、球型無人機與攝影機
import * as THREE from 'three';
import { TEAM_COLORS, STRIKER_COLOR } from './config.js';

const CAMERA_MODES = ['chase', 'fpv', 'stand', 'top'];
export const CAMERA_LABELS = { chase: '跟隨視角', fpv: 'FPV 第一人稱', stand: '看台視角', top: '俯視' };

function fieldTexture(field) {
  const ppm = 48; // 每公尺像素
  const c = document.createElement('canvas');
  c.width = Math.round(field.length * ppm);
  c.height = Math.round(field.width * ppm);
  const g = c.getContext('2d');
  g.fillStyle = '#16302a';
  g.fillRect(0, 0, c.width, c.height);
  // 草皮條紋
  for (let i = 0; i < field.length; i += 2) {
    g.fillStyle = 'rgba(255,255,255,0.025)';
    g.fillRect(i * ppm, 0, ppm, c.height);
  }
  g.strokeStyle = 'rgba(235,245,240,0.75)';
  g.lineWidth = 0.06 * ppm;
  const L = field.length * ppm;
  const W = field.width * ppm;
  g.strokeRect(g.lineWidth, g.lineWidth, L - 2 * g.lineWidth, W - 2 * g.lineWidth);
  g.beginPath();
  g.moveTo(L / 2, 0);
  g.lineTo(L / 2, W);
  g.stroke();
  g.beginPath();
  g.arc(L / 2, W / 2, 1.5 * ppm, 0, Math.PI * 2);
  g.stroke();
  // 球門區
  const off = field.goalOffset * ppm;
  for (const [x, col] of [
    [off, 'rgba(255,59,59,0.22)'],
    [L - off, 'rgba(47,123,255,0.22)'],
  ]) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, W / 2, 1.2 * ppm, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function buildArena(scene, field) {
  const L = field.length;
  const W = field.width;
  const H = field.height;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(L, W),
    new THREE.MeshStandardMaterial({ map: fieldTexture(field), roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(L + 30, W + 30),
    new THREE.MeshStandardMaterial({ color: 0x0b1416, roughness: 1 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.01;
  scene.add(outer);

  // 網籠：細網格 + 支架
  const pts = [];
  const step = 0.5;
  const pushLine = (a, b) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (let y = step; y < H; y += step) {
    pushLine([-L / 2, y, -W / 2], [L / 2, y, -W / 2]);
    pushLine([-L / 2, y, W / 2], [L / 2, y, W / 2]);
    pushLine([-L / 2, y, -W / 2], [-L / 2, y, W / 2]);
    pushLine([L / 2, y, -W / 2], [L / 2, y, W / 2]);
  }
  for (let x = -L / 2; x <= L / 2 + 1e-6; x += step) {
    pushLine([x, 0, -W / 2], [x, H, -W / 2]);
    pushLine([x, 0, W / 2], [x, H, W / 2]);
    pushLine([x, H, -W / 2], [x, H, W / 2]);
  }
  for (let z = -W / 2; z <= W / 2 + 1e-6; z += step) {
    pushLine([-L / 2, 0, z], [-L / 2, H, z]);
    pushLine([L / 2, 0, z], [L / 2, H, z]);
    pushLine([-L / 2, H, z], [L / 2, H, z]);
  }
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const net = new THREE.LineSegments(
    netGeo,
    new THREE.LineBasicMaterial({ color: 0x9fd8cf, transparent: true, opacity: 0.09, depthWrite: false }),
  );
  scene.add(net);

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)),
    new THREE.LineBasicMaterial({ color: 0xcfe9e4, transparent: true, opacity: 0.55 }),
  );
  frame.position.y = H / 2;
  scene.add(frame);

  // 支柱
  const postMat = new THREE.MeshStandardMaterial({ color: 0x55666a, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i <= 4; i++) {
    for (const z of [-W / 2, W / 2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H, 8), postMat);
      p.position.set(-L / 2 + (i * L) / 4, H / 2, z);
      scene.add(p);
    }
  }
}

function buildGoal(goal) {
  const group = new THREE.Group();
  const color = TEAM_COLORS[goal.team];
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(goal.R, goal.tube, 16, 48),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 }),
  );
  ring.rotation.y = Math.PI / 2; // 環軸向沿 X
  group.add(ring);
  // 環內的淡色光幕，提示得分面
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(goal.inner, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.y = Math.PI / 2;
  group.add(disc);
  const topY = goal.center.y - goal.R - goal.tube;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, topY, 8),
    new THREE.MeshStandardMaterial({ color: 0xbfc9cc, metalness: 0.5, roughness: 0.5 }),
  );
  post.position.y = -goal.center.y + topY / 2;
  group.add(post);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0x30393b }),
  );
  base.position.y = -goal.center.y + 0.03;
  group.add(base);
  const light = new THREE.PointLight(color, 2.5, 4, 2);
  group.add(light);
  group.position.set(goal.center.x, goal.center.y, goal.center.z);
  group.userData.disc = disc;
  return group;
}

function buildDrone(drone) {
  const r = drone.radius;
  const group = new THREE.Group();
  const color = TEAM_COLORS[drone.team];

  // 外層球型保護籠（測地線框）
  const cageGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r, 1));
  const cageColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35);
  const cage = new THREE.LineSegments(cageGeo, new THREE.LineBasicMaterial({ color: cageColor }));
  group.add(cage);
  // 赤道環（隊伍顏色）
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.98, r * 0.05, 6, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }),
  );
  band.rotation.x = Math.PI / 2;
  group.add(band);

  // 機身：X 型機臂 + 中心
  const armMat = new THREE.MeshStandardMaterial({ color: 0x222628, roughness: 0.6 });
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.06, r * 0.1), armMat);
    arm.rotation.y = a;
    group.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.BoxGeometry(r * 0.45, r * 0.22, r * 0.35), armMat);
  group.add(hub);
  // 機頭指示燈（前方 +X）
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  nose.position.set(r * 0.3, 0, 0);
  group.add(nose);

  const props = [];
  const propMat = new THREE.MeshBasicMaterial({
    color: 0x9aa4a8,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  for (const [px, pz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 3), propMat);
    p.rotation.x = -Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(px * r * 0.53, r * 0.06, pz * r * 0.53);
    pivot.add(p);
    group.add(pivot);
    props.push({ pivot, dir: px * pz });
  }

  // 攻擊手：金色雙環
  if (drone.isStriker) {
    const ringMat = new THREE.MeshStandardMaterial({
      color: STRIKER_COLOR,
      emissive: STRIKER_COLOR,
      emissiveIntensity: 0.9,
    });
    for (const rot of [0, Math.PI / 2]) {
      const sr = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.04, 6, 32), ringMat);
      sr.rotation.y = rot;
      group.add(sr);
    }
  }
  return { group, props, cage, band };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071012);
    this.scene.fog = new THREE.Fog(0x071012, 30, 60);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
    this.cameraMode = 'chase';
    this.blobTex = blobTexture();
    this.camPos = new THREE.Vector3(0, 6, 14);
    this.camLook = new THREE.Vector3();

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x1a2420, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-6, 14, 8);
    this.scene.add(sun);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // 依世界狀態重建場景物件
  build(world) {
    if (this.root) this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    const arena = new THREE.Group();
    buildArena(arena, world.field);
    this.root.add(arena);
    this.goalMeshes = world.goals.map((g) => {
      const m = buildGoal(g);
      this.root.add(m);
      return m;
    });
    this.droneMeshes = new Map();
    for (const d of world.drones) {
      const m = buildDrone(d);
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }),
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.01;
      this.root.add(m.group, blob);
      this.droneMeshes.set(d, { ...m, blob });
    }
    // 玩家標記：頭頂倒三角
    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.18, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    marker.rotation.x = Math.PI;
    this.marker = marker;
    this.root.add(marker);
    this.world = world;
  }

  cycleCamera() {
    const i = CAMERA_MODES.indexOf(this.cameraMode);
    this.cameraMode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length];
    this.snap = true;
    return this.cameraMode;
  }

  flashGoal(team) {
    const m = this.goalMeshes?.find((_, i) => this.world.goals[i].team === team);
    if (m) m.userData.flash = 1.2;
  }

  render(dt, player) {
    const world = this.world;
    const t = performance.now() / 1000;
    for (const d of world.drones) {
      const m = this.droneMeshes.get(d);
      m.group.position.set(d.pos.x, d.pos.y, d.pos.z);
      m.group.rotation.set(d.roll, d.yaw, -d.pitch, 'YZX');
      for (const p of m.props) p.pivot.rotation.y = d.propPhase * p.dir;
      const down = d.status !== 'ok';
      m.band.material.emissiveIntensity = down ? (Math.sin(t * 12) > 0 ? 1 : 0.05) : 0.9;
      // 地面陰影
      const h = Math.max(d.pos.y - d.radius, 0);
      const s = d.radius * 2.4 * (1 + h * 0.15);
      m.blob.scale.set(s, s, 1);
      m.blob.position.set(d.pos.x, 0.012, d.pos.z);
      m.blob.material.opacity = Math.max(0.15, 0.85 - h * 0.12);
      m.group.visible = !(this.cameraMode === 'fpv' && d === player);
    }
    for (const gm of this.goalMeshes) {
      const f = gm.userData.flash ?? 0;
      gm.userData.flash = Math.max(0, f - dt);
      gm.userData.disc.material.opacity = 0.08 + 0.5 * Math.max(0, Math.sin(f * 15)) * (f > 0 ? 1 : 0);
    }

    if (player) {
      this.marker.visible = this.cameraMode !== 'fpv';
      this.marker.position.set(
        player.pos.x,
        player.pos.y + player.radius + 0.25 + Math.sin(t * 4) * 0.04,
        player.pos.z,
      );
    }
    this.updateCamera(dt, player);
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(dt, player) {
    const cam = this.camera;
    const f = this.world.field;
    const portrait = cam.aspect < 1;
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 5);
    if (this.snap) this.snapYaw = true;
    this.snap = false;

    if (this.cameraMode === 'fpv' && player) {
      cam.fov = 100;
      cam.up.set(0, 1, 0);
      cam.position.set(player.pos.x, player.pos.y + player.radius * 0.2, player.pos.z);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(player.roll, player.yaw, -player.pitch, 'YZX'));
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)));
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((20 * Math.PI) / 180, 0, 0)));
      cam.quaternion.copy(q);
      cam.updateProjectionMatrix();
      return;
    }

    let pos;
    let look;
    if (this.cameraMode === 'chase' && player) {
      cam.fov = portrait ? 80 : 70;
      // 攝影機偏航平滑跟隨；墜機翻滾時不跟著轉
      if (this.camYaw === undefined || this.snapYaw) this.camYaw = player.yaw;
      this.snapYaw = false;
      if (player.status === 'ok') {
        let dy = player.yaw - this.camYaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.camYaw += dy * (1 - Math.exp(-dt * 8));
      }
      const fwd = { x: Math.cos(this.camYaw), z: -Math.sin(this.camYaw) };
      const back = portrait ? 3.6 : 3.0;
      pos = new THREE.Vector3(player.pos.x - fwd.x * back, player.pos.y + 1.2, player.pos.z - fwd.z * back);
      pos.x = THREE.MathUtils.clamp(pos.x, -f.length / 2 - 2, f.length / 2 + 2);
      pos.z = THREE.MathUtils.clamp(pos.z, -f.width / 2 - 2, f.width / 2 + 2);
      pos.y = Math.max(pos.y, 0.6);
      look = new THREE.Vector3(player.pos.x + fwd.x * 2, player.pos.y + 0.2, player.pos.z + fwd.z * 2);
    } else if (this.cameraMode === 'top') {
      cam.fov = 60;
      const span = portrait ? f.length : f.length * 0.62;
      pos = new THREE.Vector3(0, span / (2 * Math.tan((30 * Math.PI) / 180)) + 2, 0.001);
      look = new THREE.Vector3(0, 0, 0);
    } else {
      // 看台：場邊高處，跟隨玩家左右
      cam.fov = portrait ? 75 : 55;
      const px = player ? player.pos.x * 0.6 : 0;
      pos = new THREE.Vector3(px, f.height + 3, f.width / 2 + (portrait ? 11 : 8));
      look = new THREE.Vector3(px * 0.9, 1.2, 0);
    }
    cam.up.set(0, 1, 0);
    if (this.cameraMode === 'top') {
      if (portrait)
        cam.up.set(1, 0, 0); // 直式螢幕：場地縱向顯示，進攻方向朝上
      else cam.up.set(0, 0, -1);
    }
    this.camPos.lerp(pos, this.cameraMode === 'top' ? 1 : k);
    this.camLook.lerp(look, this.cameraMode === 'top' ? 1 : k);
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    cam.updateProjectionMatrix();
  }
}
