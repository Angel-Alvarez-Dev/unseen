// New protocol implemented by firmware/nano_sensors/nano_sensors.ino.
// It is not claimed to be the protocol previously loaded on the user's Nano.
// Source: user's annotated shield image and role confirmation, 2026-10-11.
export const documentedSensors = [
  { id: 'U2_L', zone: 'izquierda', label: 'Azul · izquierda', pin: 'D7' },
  { id: 'U2_C', zone: 'central', label: 'Verde · centro', pin: 'D6' },
  { id: 'U2_R', zone: 'derecha', label: 'Rojo · derecha', pin: 'D5' },
];

export class NanoDecoder {
  constructor() { this.reset(); }
  reset() { this.last = null; this.time = 0; }
  decode(line) {
    const match = /^UNSEEN_NANO_SENSORS\/1 seq=(\d{1,10}) ms=(\d{1,10}) azul=([01]) verde=([01]) rojo=([01])\r?\n$/.exec(line);
    if (!match) return null;
    const seq = Number(match[1]), ms = Number(match[2]);
    if (seq > 0xffffffff || ms > 0xffffffff) return null;
    const deltaSeq = this.last ? (seq - this.last.seq) >>> 0 : 0;
    const deltaMs = this.last ? (ms - this.last.ms) >>> 0 : 0;
    if (this.last && deltaSeq === 0) return { status: 'recibido; secuencia duplicada, sin interacción', duplicate: true };
    const reset = !this.last || deltaSeq !== 1 || deltaMs > 500;
    this.time = reset ? 0 : this.time + deltaMs;
    this.last = { seq, ms };
    const levels = documentedSensors.map((sensor, i) => ({ zone: sensor.zone, active: match[i + 3] === '1' }));
    const interpreted = levels.map(({ zone, active }) => `${zone}: ${active ? 'tocado' : 'libre'}`).join(' · ');
    return { levels, time: this.time, reset, sensor: 'Azul D7 · Verde D6 · Rojo D5', status: `${reset ? 'recibido; estado inicial sincronizado' : 'recibido'} · ${interpreted}`, seq, ms };
  }
}

export const nanoProfile = {
  name: 'UNSEEN_NANO_SENSORS/1',
  serialOptions: { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
  initialization: [],
  sensors: documentedSensors,
};
