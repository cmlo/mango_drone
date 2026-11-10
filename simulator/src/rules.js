// 比賽規則：只有攻擊手（Striker）可從正面穿過對方球門得分；
// 得分後攻擊手須先回到己方半場才可再次得分；每局限時，多局制。
import { MATCH_DEFAULTS } from './config.js';
import { sub, dot, scale, len, add } from './vec.js';

// 判斷攻擊手本步是否由正面穿過球門環
export function crossedGoal(drone, goal) {
  const a = dot(sub(drone.prevPos, goal.center), goal.normal);
  const b = dot(sub(drone.pos, goal.center), goal.normal);
  if (!(a > 0 && b <= 0)) return false;
  const t = a / (a - b);
  const p = add(drone.prevPos, scale(sub(drone.pos, drone.prevPos), t));
  const dv = sub(p, goal.center);
  const radial = sub(dv, scale(goal.normal, dot(dv, goal.normal)));
  return len(radial) < goal.inner;
}

export const inOwnHalf = (drone) => (drone.team === 0 ? drone.pos.x < 0 : drone.pos.x > 0);

export class Match {
  constructor(opts = {}) {
    const o = { ...MATCH_DEFAULTS, mode: 'match', ...opts };
    this.mode = o.mode; // 'match' 對戰 | 'practice' 練習
    this.setDuration = o.setDuration;
    this.sets = o.sets;
    this.countdownTime = o.countdown;
    this.breakTime = o.breakTime;
    this.setIndex = 0;
    this.goals = [0, 0];
    this.setsWon = [0, 0];
    this.totalGoals = [0, 0];
    this.setResults = [];
    this.winner = null;
    if (this.mode === 'practice') {
      this.phase = 'playing';
      this.timer = 0; // 練習模式：正向計時
    } else {
      this.phase = 'countdown';
      this.timer = this.countdownTime;
    }
  }

  get setsToWin() {
    return Math.floor(this.sets / 2) + 1;
  }

  // 回傳事件陣列：goal / rearm / start / setEnd / nextSet / matchEnd
  update(dt, world) {
    const ev = [];
    world.motorsEnabled = this.phase === 'playing' || this.phase === 'break' || this.phase === 'finished';
    world.landing = this.phase === 'break' || this.phase === 'finished';

    if (this.phase === 'countdown') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'playing';
        this.timer = this.setDuration;
        world.motorsEnabled = true;
        world.landing = false;
        ev.push({ type: 'start', set: this.setIndex });
      }
      return ev;
    }

    if (this.phase === 'break') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const done =
          this.setIndex + 1 >= this.sets || this.setsWon[0] >= this.setsToWin || this.setsWon[1] >= this.setsToWin;
        if (done) {
          this.phase = 'finished';
          this.winner = this.decideWinner();
          ev.push({ type: 'matchEnd', winner: this.winner });
        } else {
          this.setIndex++;
          this.goals = [0, 0];
          this.phase = 'countdown';
          this.timer = this.countdownTime;
          world.resetPositions();
          ev.push({ type: 'nextSet', set: this.setIndex });
        }
      }
      return ev;
    }

    if (this.phase !== 'playing') return ev;

    // 得分判定
    for (const d of world.drones) {
      if (!d.isStriker) continue;
      if (d.canScore && d.status === 'ok') {
        for (const g of world.goals) {
          if (g.team !== d.team && crossedGoal(d, g)) {
            d.canScore = false;
            this.goals[d.team]++;
            this.totalGoals[d.team]++;
            ev.push({ type: 'goal', team: d.team, drone: d });
          }
        }
      } else if (!d.canScore && inOwnHalf(d)) {
        d.canScore = true;
        ev.push({ type: 'rearm', drone: d });
      }
    }

    if (this.mode === 'practice') {
      this.timer += dt;
      return ev;
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      const [r, b] = this.goals;
      const setWinner = r > b ? 0 : b > r ? 1 : null;
      if (setWinner !== null) this.setsWon[setWinner]++;
      this.setResults.push({ goals: [r, b], winner: setWinner });
      this.phase = 'break';
      this.timer = this.breakTime;
      world.landing = true;
      ev.push({ type: 'setEnd', set: this.setIndex, winner: setWinner, goals: [r, b] });
    }
    return ev;
  }

  decideWinner() {
    const [a, b] = this.setsWon;
    if (a !== b) return a > b ? 0 : 1;
    const [ga, gb] = this.totalGoals;
    if (ga !== gb) return ga > gb ? 0 : 1;
    return null; // 平手
  }
}
