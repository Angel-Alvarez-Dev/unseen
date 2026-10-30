// Transport only. Protocol interpretation belongs to a verified firmware adapter.
export class SerialSession {
  constructor({ serial, onChange = (_snapshot) => {}, onMessage = (_content, _entry) => {}, onStop = () => {}, authorizeCommand = (_command) => false }) {
    Object.assign(this, { serial, onChange, onMessage, onStop, authorizeCommand });
    this.state = 'desconectado';
    this.error = '';
    this.entries = [];
    this.limit = 300;
    this.discarded = 0;
    this.sequence = 0;
    this.port = null;
    this.reader = null;
    this.readTask = null;
    this.closeTask = null;
    this.stopping = false;
    this.pending = '';
    this.pendingEntry = null;
    this.allowedCommands = [];
    this.writes = new Set();
    this.generation = 0;
    this.openTask = null;
    this.opened = false;
    this.fragmented = false;
    this.disconnected = event => {
      if (event.target === this.port || event.port === this.port) void this.disconnect('Se desconectó el Nano. Comprueba el cable USB y vuelve a conectar.');
    };
  }

  snapshot() { return { state: this.state, error: this.error, entries: [...this.entries], limit: this.limit, discarded: this.discarded }; }
  publish() { this.onChange(this.snapshot()); }
  add(direction, content, status, extra = {}) {
    const entry = { id: ++this.sequence, version: 0, time: new Date().toISOString(), direction, content, status, ...extra };
    this.entries.push(entry);
    this.trim();
    this.publish();
    return entry;
  }
  update(entry, changes) { Object.assign(entry, changes); entry.version++; this.publish(); }
  trim() {
    const count = Math.max(0, this.entries.length - this.limit);
    this.entries.splice(0, count);
    this.discarded += count;
  }
  setLimit(limit) { this.limit = Math.max(50, Math.min(1000, Math.trunc(Number(limit)) || 300)); this.trim(); this.publish(); }
  clear() { this.entries = []; this.discarded = 0; this.pendingEntry = null; this.publish(); }

  async connect(options, initialization = []) {
    if (this.state === 'conectado' || this.state === 'conectando' || this.closeTask) return;
    this.state = 'conectando'; this.error = ''; this.stopping = false;
    this.allowedCommands = [...initialization];
    this.pending = ''; this.pendingEntry = null;
    this.fragmented = false;
    const generation = ++this.generation;
    this.publish();
    let selected;
    try {
      if (!this.serial) throw Error('Web Serial no está disponible. Usa Chrome o Edge de escritorio en localhost o HTTPS.');
      selected = await this.serial.requestPort(); // Must run directly from the user's click.
      if (generation !== this.generation) return;
      this.port = selected;
      this.openTask = selected.open(options).then(() => { this.opened = true; });
      await this.openTask;
      if (generation !== this.generation) return;
      this.serial.addEventListener('disconnect', this.disconnected);
      if (!selected.readable) throw Error('El puerto no ofrece un canal de lectura.');
      this.reader = selected.readable.getReader();
      this.state = 'conectado'; this.publish();
      this.readTask = this.readLoop();
      for (const command of initialization) await this.send(command);
    } catch (error) {
      if (generation !== this.generation) return;
      if (error?.name === 'NotFoundError') {
        this.port = null; this.state = 'desconectado';
        this.error = 'Selección de puerto cancelada. Puedes volver a conectar.';
        this.publish();
      } else await this.disconnect(`No se pudo conectar: ${error.message || error}. Cierra otros monitores seriales y vuelve a conectar.`);
    }
  }

  // No free-form command UI: only initialization or the verified profile's command grammar.
  async send(command, metadata = {}, onQueued = (_entry) => {}) {
    if (!this.allowedCommands.includes(command) && !this.authorizeCommand(command)) throw Error('Comando no autorizado por el protocolo verificado.');
    const entry = this.add('TX', command, 'pendiente', metadata); // Before acquiring writer or writing bytes.
    onQueued(entry); // Register correlation before an ACK can arrive, even inside write().
    let writer;
    const writing = (async () => {
      try {
        if (this.state !== 'conectado' || this.stopping || !this.port?.writable) throw Error('Puerto desconectado o no disponible');
        writer = this.port.writable.getWriter();
        await writer.write(new TextEncoder().encode(command));
        if (this.stopping) throw Error('Conexión interrumpida durante el envío; entrega no confirmada');
        this.update(entry, { ...(entry.status === 'pendiente' ? { status: 'enviado' } : {}), sentAt: new Date().toISOString() });
      } catch (error) {
        this.update(entry, { status: 'error de envío', error: String(error.message || error) });
        // Do not await disconnect here: cleanup awaits all in-flight writes.
        void this.disconnect(`Falló el envío #${entry.id}: ${error.message || error}. Vuelve a conectar.`);
        throw error;
      } finally { writer?.releaseLock(); }
    })();
    this.writes.add(writing);
    try { await writing; } finally { this.writes.delete(writing); }
    return entry;
  }

  receive(text) {
    this.pending += text;
    while (this.pending) {
      const end = this.pending.indexOf('\n');
      if (end >= 4096 || (end === -1 && this.pending.length > 4096)) {
        const content = this.pending.slice(0, 4096);
        const entry = this.pendingEntry || this.add('RX', content, 'fragmento sin terminador');
        this.update(entry, { content, status: 'fragmento sin terminador; no interpretado' });
        this.fragmented = true;
        this.pendingEntry = null; this.pending = this.pending.slice(4096);
        continue;
      }
      if (end === -1) break;
      const content = this.pending.slice(0, end + 1);
      this.pending = this.pending.slice(end + 1);
      const entry = this.pendingEntry || this.add('RX', content, 'recibido');
      this.pendingEntry = null;
      this.update(entry, { content, status: this.fragmented ? 'fin de mensaje fragmentado; no interpretado' : 'recibido' });
      const details = this.fragmented ? null : this.onMessage(content, entry);
      this.fragmented = false;
      if (details) this.update(entry, details);
    }
    if (this.pending) {
      // Bounded even for a malformed device that never sends a line terminator.
      this.pendingEntry ||= this.add('RX', this.pending, 'recibiendo; sin terminador');
      this.update(this.pendingEntry, { content: this.pending });
    }
  }

  async readLoop() {
    const decoder = new TextDecoder();
    let failure = '';
    try {
      while (!this.stopping) {
        const { value, done } = await this.reader.read();
        if (done) { if (!this.stopping) failure = 'El Nano cerró el flujo serial. Comprueba el cable y vuelve a conectar.'; break; }
        this.receive(decoder.decode(value, { stream: true }));
      }
    } catch (error) { if (!this.stopping) failure = `Error de lectura: ${error.message || error}. Vuelve a conectar.`; }
    finally {
      const tail = decoder.decode(); if (tail) this.receive(tail);
      if (this.pendingEntry) this.update(this.pendingEntry, { status: 'incompleto al desconectar; no interpretado' });
      this.pending = ''; this.pendingEntry = null;
      this.reader?.releaseLock(); this.reader = null;
    }
    if (failure) void this.disconnect(failure);
  }

  disconnect(reason = '') {
    if (this.closeTask) return this.closeTask;
    this.stopping = true;
    ++this.generation;
    this.error = reason;
    this.state = reason ? 'error' : 'desconectado';
    this.onStop();
    this.publish();
    this.serial?.removeEventListener('disconnect', this.disconnected);
    this.closeTask = (async () => {
      try {
        await this.openTask?.catch(() => {});
        await this.reader?.cancel();
        await this.readTask;
        await Promise.allSettled([...this.writes]);
        if (this.port && this.opened) await this.port.close();
      } catch (error) {
        this.error = reason || `Error al cerrar el puerto: ${error.message || error}. Desconecta el cable y vuelve a conectar.`;
        this.state = 'error';
      } finally {
        this.port = null; this.reader = null; this.readTask = null;
        this.openTask = null; this.opened = false;
        this.closeTask = null; this.publish();
      }
    })();
    return this.closeTask;
  }
}
