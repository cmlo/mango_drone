// 場地與機體參數（近似 FAI 無人機足球規格，可依實際採用的規則書調整）
// 座標系：Y 向上；X 為場地長邊（紅隊防守 -X、進攻 +X）；Z 為場地寬邊。

export const FIELD_PRESETS = {
  DS40: {
    label: 'DS40（40 cm 球型機）',
    length: 20, // 場地長 (m)
    width: 10, // 場地寬 (m)
    height: 5, // 網籠高度 (m)
    ballRadius: 0.2, // 保護球半徑 (m)
    mass: 1.0, // 機重 (kg)
    goalInner: 0.6, // 球門環內徑 (m)
    goalOuter: 0.8, // 球門環外徑 (m)
    goalHeight: 2.0, // 球門中心離地高度 (m)
    goalOffset: 2.0, // 球門距底線 (m)
  },
  DS20: {
    label: 'DS20（20 cm 球型機）',
    length: 16,
    width: 8,
    height: 4,
    ballRadius: 0.1,
    mass: 0.25,
    goalInner: 0.4,
    goalOuter: 0.52,
    goalHeight: 1.8,
    goalOffset: 1.5,
  },
};

export const PHYSICS = {
  g: 9.81,
  dt: 1 / 120, // 物理固定步長 (s)
  thrustToWeight: 2.4, // 最大推重比
  maxTilt: (35 * Math.PI) / 180, // 自穩模式最大傾角
  maxYawRate: (220 * Math.PI) / 180, // 最大偏航角速度
  maxClimb: 3.0, // 定高模式最大爬升/下降速度 (m/s)
  attitudeOmega: 22, // 姿態迴路自然頻率 (rad/s)
  attitudeZeta: 0.85, // 姿態迴路阻尼比
  dragLinear: 0.25, // 線性阻力 (1/s)
  dragQuadratic: 0.09, // 二次阻力 (1/m)
  wallRestitution: 0.45,
  floorRestitution: 0.25,
  droneRestitution: 0.6,
  contactFriction: 0.3,
  knockdownSpeed: 2.5, // 相對撞擊速度超過此值才可能被撞落 (m/s)
  knockdownSpan: 6, // 撞擊速度每超出此值，撞落機率 +100%
  knockdownMaxChance: 0.5,
  lossOfControlTilt: (80 * Math.PI) / 180, // 傾角超過即失控
  recoverTime: 2.5, // 墜地後重新起飛的等待時間 (s)
};

export const MATCH_DEFAULTS = {
  teamSize: 5, // 每隊機數（含 1 架攻擊手）
  setDuration: 180, // 每局秒數
  sets: 3, // 局數（三局兩勝）
  countdown: 3, // 開局倒數秒數
  breakTime: 4, // 局間休息秒數
};

export const TEAM_COLORS = [0xff3b3b, 0x2f7bff];
export const TEAM_NAMES = ['紅隊', '藍隊'];
export const STRIKER_COLOR = 0xffd23f;

export function makeField(presetKey = 'DS40', goalScale = 1) {
  const p = FIELD_PRESETS[presetKey] ?? FIELD_PRESETS.DS40;
  return {
    ...p,
    key: presetKey,
    goalInner: p.goalInner * goalScale,
    goalOuter: p.goalInner * goalScale + (p.goalOuter - p.goalInner),
  };
}
