/* Pixel art editor for tiles and characters. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const N = RPG.TILE;

  const AE = {
    app: null, p: null, asset: null, frame: 0,
    tool: 'pencil', color: '#38b764', filter: 'all', mirror: false,
    undoStack: [], redoStack: [],

    init(app) {
      this.app = app;
      this.canvas = $('#artCanvas');
      this.ctx = this.canvas.getContext('2d');
      $$('#artTools [data-tool]').forEach(b => b.onclick = () => this.setTool(b.dataset.tool));
      $$('#artFilter [data-f]').forEach(b => b.onclick = () => {
        this.filter = b.dataset.f;
        $$('#artFilter [data-f]').forEach(x => x.classList.toggle('active', x === b));
        this.renderList();
      });
      $('#artNewTile').onclick = () => this.create('tile');
      $('#artNewSprite').onclick = () => this.create('sprite');
      $('#artMirror').onchange = e => { this.mirror = e.target.checked; this.draw(); };
      $('#artColor').oninput = e => { this.color = e.target.value; this.renderPalette(); };
      $('#artAddColor').onclick = () => {
        const c = $('#artColor').value;
        if (!this.p.palette.includes(c)) { this.p.palette.push(c); this.app.changed(); }
        this.color = c; this.renderPalette();
      };
      $('#artFlipH').onclick = () => this.transform((x, y) => [N - 1 - x, y]);
      $('#artFlipV').onclick = () => this.transform((x, y) => [x, N - 1 - y]);
      $('#artShiftL').onclick = () => this.transform((x, y) => [(x + 1) % N, y]);
      $('#artShiftR').onclick = () => this.transform((x, y) => [(x + N - 1) % N, y]);
      $('#artShiftU').onclick = () => this.transform((x, y) => [x, (y + 1) % N]);
      $('#artShiftD').onclick = () => this.transform((x, y) => [x, (y + N - 1) % N]);
      $('#artClear').onclick = () => { this.pushUndo(); this.px().fill(''); this.edited(); };
      $('#artUndo').onclick = () => this.undo();
      $('#artRedo').onclick = () => this.redo();
      $('#artFps').oninput = e => { if (this.asset) { this.asset.fps = +e.target.value; $('#artFpsVal').textContent = e.target.value; this.app.changed(); } };
      this.bindMouse();
      window.addEventListener('keydown', e => this.onKey(e));
      const loop = t => { if (this.app.tab === 'art') this.drawPreview(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    load(p) {
      this.p = p;
      this.asset = Object.values(p.assets)[0] || null;
      this.frame = 0;
      this.undoStack = []; this.redoStack = [];
    },

    show() {
      if (!this.p) return;
      if (this.asset && !this.p.assets[this.asset.id]) this.asset = Object.values(this.p.assets)[0] || null;
      this.renderList(); this.renderPalette(); this.renderFrames(); this.renderProps(); this.draw();
    },

    px() { return this.asset.frames[this.frame]; },

    create(kind) {
      const base = kind === 'tile' ? 'Tile' : 'Character';
      let n = 1;
      const names = Object.values(this.p.assets).map(a => a.name);
      while (names.includes(`${base} ${n}`)) n++;
      const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const a = { id, name: `${base} ${n}`, kind, frames: [RPG.blankPixels()], fps: 3, solid: false };
      if (kind === 'tile') a.frames[0].fill(this.p.palette[6] || '#38b764');
      this.p.assets[id] = a;
      this.asset = a; this.frame = 0;
      this.undoStack = []; this.redoStack = [];
      this.app.changed();
      this.show();
    },

    /* ----------------------- panels ----------------------- */
    renderList() {
      const el = $('#artList');
      el.innerHTML = '';
      Object.values(this.p.assets).filter(a => this.filter === 'all' || a.kind === this.filter).forEach(a => {
        const b = document.createElement('button');
        b.className = 'asset' + (a === this.asset ? ' active' : '') + (a.solid ? ' solid' : '');
        b.title = a.name;
        b.innerHTML = `<img alt="" src="${RPG.art.thumbURL(a)}"><span></span><em>${a.kind === 'tile' ? 'tile' : 'char'}</em>`;
        b.querySelector('span').textContent = a.name;
        b.onclick = () => { this.asset = a; this.frame = 0; this.undoStack = []; this.redoStack = []; this.show(); };
        el.appendChild(b);
      });
    },

    renderPalette() {
      const el = $('#artPalette');
      el.innerHTML = '';
      const add = (col, title) => {
        const b = document.createElement('button');
        b.className = 'swatch' + (col === this.color ? ' active' : '') + (col ? '' : ' clear');
        b.style.background = col || '';
        b.title = title || col;
        b.onclick = () => { this.color = col; if (col) $('#artColor').value = col; if (this.tool === 'eraser' || this.tool === 'picker') this.setTool('pencil'); this.renderPalette(); };
        b.oncontextmenu = e => {
          e.preventDefault();
          if (!col || !confirm('Remove this colour from the palette? (Pixels already drawn keep it.)')) return;
          this.p.palette = this.p.palette.filter(c => c !== col);
          this.app.changed(); this.renderPalette();
        };
        el.appendChild(b);
      };
      add('', 'Transparent (see-through)');
      this.p.palette.forEach(c => add(c));
      if (this.color && !this.p.palette.includes(this.color)) add(this.color, 'Current colour (not in palette)');
    },

    renderFrames() {
      const el = $('#artFrames');
      el.innerHTML = '';
      if (!this.asset) return;
      this.asset.frames.forEach((f, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'frame' + (i === this.frame ? ' active' : '');
        const c = document.createElement('canvas'); c.width = c.height = 48;
        const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
        cx.drawImage(RPG.art.frameCanvas(f), 0, 0, 48, 48);
        c.onclick = () => { this.frame = i; this.renderFrames(); this.draw(); };
        wrap.appendChild(c);
        const lbl = document.createElement('span'); lbl.textContent = i + 1; wrap.appendChild(lbl);
        if (this.asset.frames.length > 1) {
          const del = document.createElement('button'); del.textContent = '✕'; del.title = 'Delete frame';
          del.onclick = () => {
            this.asset.frames.splice(i, 1);
            this.frame = Math.min(this.frame, this.asset.frames.length - 1);
            this.undoStack = []; this.redoStack = [];
            this.app.changed(); this.renderFrames(); this.draw();
          };
          wrap.appendChild(del);
        }
        el.appendChild(wrap);
      });
      if (this.asset.frames.length < 8) {
        const add = document.createElement('button');
        add.className = 'frame add'; add.innerHTML = '+<span>copy frame</span>';
        add.title = 'Add a new frame (a copy of the current one)';
        add.onclick = () => {
          this.asset.frames.splice(this.frame + 1, 0, this.px().slice());
          this.frame++;
          this.undoStack = []; this.redoStack = [];
          this.app.changed(); this.renderFrames(); this.draw();
        };
        el.appendChild(add);
      }
      $('#artFps').value = this.asset.fps || 3;
      $('#artFpsVal').textContent = this.asset.fps || 3;
    },

    renderProps() {
      const el = $('#artProps');
      el.innerHTML = '';
      const a = this.asset;
      if (!a) { el.innerHTML = '<p class="hint">Make a tile or character to start drawing.</p>'; return; }
      const panel = document.createElement('div'); panel.className = 'panel';
      panel.innerHTML = `<h3>${a.kind === 'tile' ? 'Tile' : 'Character'} settings</h3>`;
      const nameF = RPG.mapEditor.field('Name', 'text', a.name, v => { a.name = v || 'Unnamed'; this.app.changed(); clearTimeout(this.nameT); this.nameT = setTimeout(() => this.renderList(), 400); });
      panel.appendChild(nameF);
      const kind = document.createElement('div'); kind.className = 'field';
      kind.innerHTML = `<label>Type</label><select><option value="tile">Tile (painted on the map)</option><option value="sprite">Character / object (can have scripts)</option></select>`;
      const ks = kind.querySelector('select'); ks.value = a.kind;
      ks.onchange = () => {
        if (this.usage(a) && !confirm('This art is already used on a map. Changing its type will remove it from the maps. Continue?')) { ks.value = a.kind; return; }
        this.removeUsage(a); a.kind = ks.value; this.app.changed(); this.show();
      };
      panel.appendChild(kind);
      if (a.kind === 'tile') {
        panel.appendChild(RPG.mapEditor.check('Solid – the player can\'t walk through it', a.solid, v => { a.solid = v; this.app.changed(); this.renderList(); }));
      }
      const used = this.usage(a);
      const info = document.createElement('p'); info.className = 'muted small';
      info.textContent = used ? `Used ${used} time${used > 1 ? 's' : ''} in your maps.` : 'Not used on any map yet.';
      panel.appendChild(info);
      const hint = document.createElement('p'); hint.className = 'muted small';
      hint.innerHTML = `In scripts, refer to it as <code></code>.`;
      hint.querySelector('code').textContent = JSON.stringify(a.name);
      panel.appendChild(hint);
      el.appendChild(panel);

      const act = document.createElement('div'); act.className = 'panel';
      act.innerHTML = '<h3>More</h3>';
      const row = document.createElement('div'); row.className = 'row gap wrap';
      const mk = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'btn sm ' + (cls || ''); b.textContent = label; b.onclick = fn; row.appendChild(b); return b; };
      mk('Duplicate', () => {
        const id = 'a' + Date.now().toString(36);
        const copy = JSON.parse(JSON.stringify(a)); copy.id = id; copy.name = a.name + ' copy';
        this.p.assets[id] = copy; this.asset = copy; this.frame = 0; this.app.changed(); this.show();
      });
      mk('Import image…', () => this.importImage());
      mk('Save PNG', () => {
        const c = document.createElement('canvas'); c.width = N * a.frames.length * 4; c.height = N * 4;
        const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
        a.frames.forEach((f, i) => cx.drawImage(RPG.art.frameCanvas(f), i * N * 4, 0, N * 4, N * 4));
        c.toBlob(b => RPG.storage.download(b, RPG.storage.fileSafe(a.name) + '.png'));
      });
      mk('Delete', () => this.deleteAsset(), 'danger');
      act.appendChild(row);
      el.appendChild(act);

      const tips = document.createElement('div'); tips.className = 'panel tips';
      tips.innerHTML = `<h3>Tips</h3><ul class="small"><li>Right-click to erase.</li><li>Turn on <b>Mirror</b> to draw symmetrical characters.</li><li>Add frames to animate (water, walking, blinking).</li><li>Right-click a colour to remove it from the palette.</li></ul>`;
      el.appendChild(tips);
    },

    usage(a) {
      let n = 0;
      this.p.maps.forEach(m => {
        m.ground.forEach(v => { if (v === a.id) n++; });
        m.detail.forEach(v => { if (v === a.id) n++; });
        m.entities.forEach(e => { if (e.sprite === a.id) n++; });
      });
      if (this.p.player.sprite === a.id) n++;
      return n;
    },
    removeUsage(a) {
      this.p.maps.forEach(m => {
        m.ground = m.ground.map(v => v === a.id ? null : v);
        m.detail = m.detail.map(v => v === a.id ? null : v);
        m.entities = m.entities.filter(e => e.sprite !== a.id);
      });
    },
    deleteAsset() {
      const a = this.asset;
      if (this.p.player.sprite === a.id) return this.app.toast('This is the player\'s look. Choose a different player look in the Map tab first.', true);
      const used = this.usage(a);
      if (!confirm(used ? `"${a.name}" is used ${used} time(s). Deleting it removes it from your maps. Delete?` : `Delete "${a.name}"?`)) return;
      this.removeUsage(a);
      delete this.p.assets[a.id];
      this.asset = Object.values(this.p.assets)[0] || null;
      this.frame = 0;
      this.app.changed(); this.show();
    },

    importImage() {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = N;
          const cx = c.getContext('2d');
          cx.imageSmoothingEnabled = false;
          // crop to a centred square, then shrink to 16x16
          const s = Math.min(img.width, img.height);
          cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N);
          const d = cx.getImageData(0, 0, N, N).data;
          this.pushUndo();
          const px = this.px();
          for (let i = 0; i < N * N; i++) {
            const a = d[i * 4 + 3];
            px[i] = a < 128 ? '' : '#' + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
          }
          URL.revokeObjectURL(img.src);
          this.edited();
        };
        img.src = URL.createObjectURL(f);
      };
      inp.click();
    },

    /* ----------------------- editing ----------------------- */
    setTool(t) {
      this.tool = t;
      $$('#artTools [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    },
    onKey(e) {
      if (this.app.tab !== 'art' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.redo(); return; }
      const map = { b: 'pencil', e: 'eraser', f: 'fill', l: 'line', r: 'rect', i: 'picker' };
      if (!e.ctrlKey && !e.metaKey && map[k]) this.setTool(map[k]);
    },
    pushUndo() {
      if (!this.asset) return;
      this.undoStack.push({ a: this.asset, f: this.frame, px: this.px().slice() });
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
    },
    applyState(s, toStack) {
      if (!this.p.assets[s.a.id] || !s.a.frames[s.f]) return;
      this.asset = s.a; this.frame = s.f;
      toStack.push({ a: s.a, f: s.f, px: this.px().slice() });
      const px = this.px();
      s.px.forEach((v, i) => { px[i] = v; });
      this.edited(true);
    },
    undo() { const s = this.undoStack.pop(); if (s) this.applyState(s, this.redoStack); },
    redo() { const s = this.redoStack.pop(); if (s) this.applyState(s, this.undoStack); },

    transform(fn) {
      if (!this.asset) return;
      this.pushUndo();
      const src = this.px().slice(), px = this.px();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const [sx, sy] = fn(x, y);
        px[y * N + x] = src[sy * N + sx];
      }
      this.edited();
    },

    edited(full) {
      RPG.art.invalidate(this.px());
      this.draw();
      this.app.changed();
      clearTimeout(this.thumbT);
      this.thumbT = setTimeout(() => { this.renderList(); this.renderFrames(); }, full ? 0 : 250);
    },

    setPx(x, y, col) {
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      const px = this.px();
      px[y * N + x] = col;
      if (this.mirror) px[y * N + (N - 1 - x)] = col;
    },

    cellAt(e) {
      const r = this.canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * N), Math.floor((e.clientY - r.top) / r.height * N)];
    },

    bindMouse() {
      const c = this.canvas;
      c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('pointerdown', e => {
        if (!this.asset) return;
        c.setPointerCapture(e.pointerId);
        const [x, y] = this.cellAt(e);
        const erase = e.button === 2 || this.tool === 'eraser';
        const col = erase ? '' : this.color;
        if (this.tool === 'picker' && e.button !== 2) {
          const v = this.px()[y * N + x];
          this.color = v; if (v) $('#artColor').value = v;
          this.setTool('pencil'); this.renderPalette();
          return;
        }
        this.pushUndo();
        if (this.tool === 'fill' && !erase) { this.fill(x, y, col); this.edited(); return; }
        if ((this.tool === 'line' || this.tool === 'rect') && e.button !== 2) {
          this.shape = { x0: x, y0: y, x1: x, y1: y, col, base: this.px().slice() };
          this.drawShape(); return;
        }
        this.stroke = { col, last: [x, y] };
        this.setPx(x, y, col);
        this.edited();
      });
      c.addEventListener('pointermove', e => {
        const [x, y] = this.cellAt(e);
        this.hover = [x, y];
        if (this.shape) { this.shape.x1 = x; this.shape.y1 = y; this.drawShape(); return; }
        if (this.stroke) {
          RPG.mapEditor.lineCells(this.stroke.last[0], this.stroke.last[1], x, y).forEach(([cx, cy]) => this.setPx(cx, cy, this.stroke.col));
          this.stroke.last = [x, y];
          this.edited();
        } else this.draw();
      });
      const end = () => { this.stroke = null; this.shape = null; };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    },

    drawShape() {
      const s = this.shape, px = this.px();
      s.base.forEach((v, i) => { px[i] = v; });
      if (this.tool === 'line') {
        RPG.mapEditor.lineCells(s.x0, s.y0, s.x1, s.y1).forEach(([x, y]) => this.setPx(x, y, s.col));
      } else {
        const xa = Math.min(s.x0, s.x1), xb = Math.max(s.x0, s.x1), ya = Math.min(s.y0, s.y1), yb = Math.max(s.y0, s.y1);
        for (let x = xa; x <= xb; x++) { this.setPx(x, ya, s.col); this.setPx(x, yb, s.col); }
        for (let y = ya; y <= yb; y++) { this.setPx(xa, y, s.col); this.setPx(xb, y, s.col); }
      }
      this.edited();
    },

    fill(x, y, col) {
      const px = this.px();
      const target = px[y * N + x];
      if (target === col) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= N || cy >= N || px[cy * N + cx] !== target) continue;
        px[cy * N + cx] = col;
        if (this.mirror) px[cy * N + (N - 1 - cx)] = col;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    },

    /* ----------------------- drawing ----------------------- */
    draw() {
      const ctx = this.ctx, W = this.canvas.width, s = W / N;
      ctx.clearRect(0, 0, W, W);
      // checkerboard shows transparency
      for (let y = 0; y < N * 2; y++) for (let x = 0; x < N * 2; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#2a3148' : '#353d57';
        ctx.fillRect(x * s / 2, y * s / 2, s / 2, s / 2);
      }
      if (!this.asset) return;
      // faint previous frame ("onion skin") helps with animation
      if (this.frame > 0) {
        ctx.globalAlpha = 0.2;
        this.asset.frames[this.frame - 1].forEach((c, i) => { if (c) { ctx.fillStyle = c; ctx.fillRect((i % N) * s, Math.floor(i / N) * s, s, s); } });
        ctx.globalAlpha = 1;
      }
      this.px().forEach((c, i) => { if (c) { ctx.fillStyle = c; ctx.fillRect((i % N) * s, Math.floor(i / N) * s, s, s); } });
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { ctx.moveTo(i * s + 0.5, 0); ctx.lineTo(i * s + 0.5, W); ctx.moveTo(0, i * s + 0.5); ctx.lineTo(W, i * s + 0.5); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(W / 2 + 0.5, 0); ctx.lineTo(W / 2 + 0.5, W); ctx.moveTo(0, W / 2 + 0.5); ctx.lineTo(W, W / 2 + 0.5); ctx.stroke();
      if (this.mirror) { ctx.strokeStyle = '#ef7d57'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, W); ctx.stroke(); }
      if (this.hover) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(this.hover[0] * s + 1, this.hover[1] * s + 1, s - 2, s - 2);
      }
    },

    drawPreview(t) {
      if (!this.asset) return;
      const pc = $('#artPreview').getContext('2d');
      pc.imageSmoothingEnabled = false;
      pc.clearRect(0, 0, 64, 64);
      pc.fillStyle = '#38b764'; pc.fillRect(0, 0, 64, 64);
      pc.drawImage(RPG.art.assetCanvas(this.asset, t), 0, 0, 64, 64);
      const tc = $('#artTilePreview').getContext('2d');
      tc.imageSmoothingEnabled = false;
      tc.fillStyle = '#1a1c2c'; tc.fillRect(0, 0, 96, 96);
      const fc = RPG.art.assetCanvas(this.asset, t);
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) tc.drawImage(fc, x * 32, y * 32, 32, 32);
    }
  };

  RPG.artEditor = AE;
})(window.RPG);
