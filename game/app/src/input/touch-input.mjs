// Shared gesture adapter for the existing Player and physical inputs. No FSM rules here.
export const TOUCH_MS = 60;
export const CONFIRM_MS = 650;
export const ZONES = ['izquierda', 'central', 'derecha'];

export class TouchInput {
  constructor({ read, send, contact = () => {}, change = (_active) => {}, now = () => performance.now(), schedule = setTimeout, unschedule = clearTimeout }) {
    Object.assign(this, { read, send, contact, change, now, schedule, unschedule });
    this.active = null;
    this.timer = null;
    this.count = 0;
  }

  begin(zone, source = 'web', time = this.now(), externalClock = false) {
    const { s, session, locked } = this.read();
    if (!ZONES.includes(zone) || this.active || locked || s.presentation || !['S0', 'S1', 'S2'].includes(s.state)) return false;
    const a = { zone, source, session, start: time, done: false, gesture: `${source}-${session}-${++this.count}` };
    this.active = a;
    this.change(a);
    this.contact();
    if (zone === 'central' && !externalClock) this.timer = this.schedule(() => this.advance(zone, source, a.start + CONFIRM_MS), CONFIRM_MS);
    return true;
  }

  advance(zone, source, time) {
    const a = this.active, current = this.read();
    if (!a || a.zone !== zone || a.source !== source || a.done || zone !== 'central' || time - a.start < CONFIRM_MS) return;
    if (current.session !== a.session || current.locked || current.s.presentation) return;
    a.done = true;
    this.send({ type: current.s.state === 'S0' ? 'WAKE' : 'CONFIRM', stable: true, gesture: a.gesture });
  }

  end(zone, source = 'web', time = this.now()) {
    const a = this.active;
    if (!a || a.zone !== zone || a.source !== source) return;
    const elapsed = time - a.start;
    this.advance(zone, source, time);
    const { s, session, locked } = this.read();
    this.cancel();
    if (a.done || elapsed < TOUCH_MS || session !== a.session || locked || s.presentation) return;
    if (zone === 'central') {
      if (s.state !== 'S0') this.send({ type: 'REPEAT' });
    } else if (s.state !== 'S0') {
      const n = s.context.A.length, dir = zone === 'derecha' ? 1 : -1;
      const i = s.selected === null ? (dir === 1 ? 0 : n - 1) : (s.selected + dir + n) % n;
      this.send({ type: 'SELECT', i, stable: true, gesture: a.gesture });
    }
  }

  cancel(source) {
    if (source && this.active?.source !== source) return;
    if (this.timer !== null) this.unschedule(this.timer);
    this.timer = null;
    this.active = null;
    this.change(null);
  }
}
