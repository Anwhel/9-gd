/* Map editor: paint tiles on two layers and place characters. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const T = RPG.TILE;

  const ME = {
    app: null, p: null, map: null,
    layer: 'ground', tool: 'paint',
    tile: 'grass', sprite: null, selected: null,
    zoom: 2, grid: true,
    undoStack: [], redoStack: [],

    init(app) {
      this.app = app;
      this.canvas = $('#mapCanvas');
      this.ctx = this.canvas.getContext('2d');
      $$('#mapTools [data-tool]').forEach(b => b.onclick = () => this.setTool(b.dataset.tool));
      $$('.layer-switch [data-layer]').forEach(b => b.onclick = () => this.setLayer(b.dataset.layer));
      $('#mapGrid').onchange = e => { this.grid = e.target.checked; this.draw(); };
      $('#mapZoom').oninput = e => { this.zoom = +e.target.value; this.resize(); };
      $('#mapUndo').onclick = () => this.undo();
      $('#mapRedo').onclick = () => this.redo();
      $('#mapAdd').onclick = () => this.addMap();
      this.bindMouse();
      window.addEventListener('keydown', e => this.onKey(e));
      const loop = t => { if (this.app.tab === 'map') this.draw(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    load(p) {
      this.p = p;
      this.map = p.maps.find(m => m.id === p.player.map) || p.maps[0];
      this.undoStack = []; this.redoStack = [];
      this.selected = null;
      const tiles = this.assetsOf('tile');
      if (!p.assets[this.tile] || p.assets[this.tile].kind !== 'tile') this.tile = tiles[0] ? tiles[0].id : null;
      const sprites = this.assetsOf('sprite');
      if (!p.assets[this.sprite]) this.sprite = sprites[0] ? sprites[0].id : null;
      this.show();
    },

    show() {
      if (!this.p) return;
      this.renderMapList();
      this.renderPalette();
      this.renderInspector();
      this.resize();
    },

    assetsOf(kind) { return Object.values(this.p.assets).filter(a => a.kind === kind); },

    /* ------------------------ side panels ------------------------ */
    renderMapList() {
      const ul = $('#mapList');
      ul.innerHTML = '';
      this.p.maps.forEach(m => {
        const li = document.createElement('li');
        li.className = m === this.map ? 'active' : '';
        li.textContent = m.name + (this.p.player.map === m.id ? ' 🚩' : '');
        li.title = `${m.width} × ${m.height}`;
        li.onclick = () => { this.map = m; this.selected = null; this.undoStack = []; this.redoStack = []; this.show(); };
        ul.appendChild(li);
      });
    },

    renderPalette() {
      const grid = $('#mapPalette');
      grid.innerHTML = '';
      const chars = this.layer === 'chars';
      $('#paletteTitle').textContent = chars ? 'Characters & objects' : 'Tiles';
      $('#paletteHint').textContent = chars
        ? 'Click the map to place the chosen character. Click a character to select it, drag to move. Delete key removes it.'
        : (this.layer === 'detail' ? 'The Top layer draws over the ground – great for trees, rocks and furniture.' : 'Pick a tile, then paint on the map. Right-click erases.');
      const list = this.assetsOf(chars ? 'sprite' : 'tile');
      list.forEach(a => {
        const b = document.createElement('button');
        b.className = 'asset' + ((chars ? this.sprite : this.tile) === a.id ? ' active' : '');
        b.title = a.name + (a.solid ? ' (solid)' : '');
        b.innerHTML = `<img alt="" src="${RPG.art.thumbURL(a)}"><span></span>`;
        b.querySelector('span').textContent = a.name;
        if (a.solid) b.classList.add('solid');
        b.onclick = () => {
          if (chars) this.sprite = a.id; else this.tile = a.id;
          if (this.tool === 'erase' || this.tool === 'pick' || this.tool === 'player') this.setTool('paint');
          this.renderPalette();
        };
        grid.appendChild(b);
      });
      const add = document.createElement('button');
      add.className = 'asset add';
      add.innerHTML = '<b>+</b><span>Draw new</span>';
      add.title = 'Draw a new ' + (chars ? 'character' : 'tile') + ' in the Art tab';
      add.onclick = () => { RPG.artEditor.create(chars ? 'sprite' : 'tile'); this.app.showTab('art'); };
      grid.appendChild(add);
    },

    renderInspector() {
      const el = $('#inspector');
      el.innerHTML = '';
      const p = this.p, m = this.map;
      const ent = this.selected && m.entities.find(e => e.id === this.selected);
      const h = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

      if (ent) {
        const panel = h(`<div class="panel"><div class="panel-head"><h3>Character</h3><button class="btn sm" data-act="close">✕</button></div></div>`);
        panel.querySelector('[data-act=close]').onclick = () => { this.selected = null; this.renderInspector(); };
        panel.appendChild(this.field('Name', 'text', ent.name, v => { ent.name = v || 'Unnamed'; this.app.changed(); }));
        panel.appendChild(this.spriteSelect('Looks like', ent.sprite, v => { ent.sprite = v; this.app.changed(); }));
        panel.appendChild(this.check('Blocks the player (solid)', ent.solid, v => { ent.solid = v; this.app.changed(); this.renderInspector(); }));
        panel.appendChild(this.check('Visible when the game starts', ent.visible, v => { ent.visible = v; this.app.changed(); }));
        panel.appendChild(h(`<p class="muted small">Position: (${ent.x}, ${ent.y})</p>`));
        el.appendChild(panel);

        const sp = h(`<div class="panel"><h3>Events</h3></div>`);
        sp.appendChild(this.scriptButton('💬 When talked to', 'Player faces it and presses Space', ent.scripts.interact,
          { type: 'entity', mapId: m.id, entId: ent.id, event: 'interact' }));
        const touch = this.scriptButton('👣 When touched', ent.solid ? 'Only works if the character is NOT solid' : 'Player walks onto it', ent.scripts.touch,
          { type: 'entity', mapId: m.id, entId: ent.id, event: 'touch' });
        if (ent.solid) touch.classList.add('dim');
        sp.appendChild(touch);
        el.appendChild(sp);

        const act = h(`<div class="panel row gap"><button class="btn sm">Duplicate</button><button class="btn sm danger">Delete</button></div>`);
        act.children[0].onclick = () => {
          this.snapshot();
          const copy = JSON.parse(JSON.stringify(ent));
          copy.id = 'e' + Date.now().toString(36);
          copy.name = ent.name + ' 2';
          const spot = this.freeSpotNear(ent.x, ent.y);
          copy.x = spot[0]; copy.y = spot[1];
          m.entities.push(copy);
          this.selected = copy.id;
          this.app.changed(); this.renderInspector();
        };
        act.children[1].onclick = () => this.deleteSelected();
        el.appendChild(act);
        return;
      }

      // Map settings
      const mp = h(`<div class="panel"><h3>This map</h3></div>`);
      mp.appendChild(this.field('Map name', 'text', m.name, v => { m.name = v || 'Map'; this.app.changed(); this.renderMapList(); }));
      const size = h(`<div class="field"><label>Size (tiles)</label><div class="row gap"><input type="number" min="5" max="100" value="${m.width}" aria-label="Width"> × <input type="number" min="5" max="100" value="${m.height}" aria-label="Height"><button class="btn sm">Resize</button></div></div>`);
      const [wIn, hIn] = size.querySelectorAll('input');
      size.querySelector('button').onclick = () => this.resizeMap(+wIn.value, +hIn.value);
      mp.appendChild(size);
      mp.appendChild(this.scriptButton('🚪 When the player enters', 'Runs each time this map is entered', m.scripts.enter, { type: 'map', mapId: m.id, event: 'enter' }));
      if (p.maps.length > 1) {
        const del = h(`<button class="btn sm danger">Delete map</button>`);
        del.onclick = () => this.deleteMap();
        mp.appendChild(del);
      }
      el.appendChild(mp);

      const gp = h(`<div class="panel"><h3>Game</h3></div>`);
      gp.appendChild(this.spriteSelect('Player looks like', p.player.sprite, v => { p.player.sprite = v; this.app.changed(); }));
      gp.appendChild(this.field('Starting health', 'number', p.player.health, v => { p.player.health = Math.max(1, Math.min(20, +v || 5)); this.app.changed(); }));
      const startMap = p.maps.find(x => x.id === p.player.map);
      gp.appendChild(h(`<p class="muted small">Player starts on <b>${esc(startMap ? startMap.name : '?')}</b> at (${p.player.x}, ${p.player.y}). Use 🚩 Player start to move it.</p>`));
      gp.appendChild(this.scriptButton('🏁 When the game starts', 'Runs once at the beginning', p.scripts.start, { type: 'game', event: 'start' }));
      el.appendChild(gp);

      el.appendChild(h(`<div class="panel tips"><h3>Tips</h3><ul class="small">
        <li>Use the <b>Characters</b> layer to add people, items and doors.</li>
        <li>Click a character to give it scripts.</li>
        <li>Tiles marked <b>solid</b> in the Art tab block the player.</li></ul></div>`));
    },

    field(label, type, value, onChange) {
      const d = document.createElement('div'); d.className = 'field';
      const l = document.createElement('label'); l.textContent = label;
      const i = document.createElement('input'); i.type = type; i.value = value;
      i.oninput = () => onChange(i.value);
      d.append(l, i);
      return d;
    },
    check(label, value, onChange) {
      const l = document.createElement('label'); l.className = 'chk field';
      const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!value;
      i.onchange = () => onChange(i.checked);
      l.append(i, document.createTextNode(' ' + label));
      return l;
    },
    spriteSelect(label, value, onChange) {
      const d = document.createElement('div'); d.className = 'field';
      const l = document.createElement('label'); l.textContent = label;
      const row = document.createElement('div'); row.className = 'row gap center-v';
      const img = document.createElement('img'); img.className = 'thumb';
      const s = document.createElement('select');
      this.assetsOf('sprite').forEach(a => {
        const o = document.createElement('option'); o.value = a.id; o.textContent = a.name;
        if (a.id === value) o.selected = true;
        s.appendChild(o);
      });
      const upd = () => { const a = this.p.assets[s.value]; img.src = a ? RPG.art.thumbURL(a) : ''; };
      s.onchange = () => { onChange(s.value); upd(); };
      upd();
      row.append(img, s);
      d.append(l, row);
      return d;
    },
    scriptButton(title, sub, script, ref) {
      const b = document.createElement('button');
      b.className = 'script-btn';
      const lines = script && script.code.trim() ? script.code.trim().split('\n').length : 0;
      const lang = script && script.lang === 'py' ? 'Python' : 'JavaScript';
      b.innerHTML = `<b></b><span class="muted small"></span><span class="badge ${lines ? 'on' : ''}">${lines ? lang + ' · ' + lines + ' line' + (lines > 1 ? 's' : '') : 'empty'}</span>`;
      b.querySelector('b').textContent = title;
      b.querySelector('span').textContent = sub;
      b.onclick = () => this.app.editScript(ref);
      return b;
    },

    /* --------------------------- maps --------------------------- */
    addMap() {
      const name = prompt('Name for the new map:', 'Map ' + (this.p.maps.length + 1));
      if (!name) return;
      const W = 20, H = 15;
      const fill = this.tile || null;
      const m = {
        id: 'm' + Date.now().toString(36), name, width: W, height: H,
        ground: new Array(W * H).fill(fill), detail: new Array(W * H).fill(null),
        entities: [], scripts: { enter: { lang: 'js', code: '' } }
      };
      this.p.maps.push(m);
      this.map = m; this.selected = null;
      this.app.changed(); this.show();
      this.app.toast(`Map "${name}" added. Use goToMap("${name}", x, y) in a script to send the player here.`);
    },
    deleteMap() {
      if (!confirm(`Delete the map "${this.map.name}" and everything on it?`)) return;
      const idx = this.p.maps.indexOf(this.map);
      this.p.maps.splice(idx, 1);
      if (this.p.player.map === this.map.id) { this.p.player.map = this.p.maps[0].id; this.p.player.x = 1; this.p.player.y = 1; }
      this.map = this.p.maps[0];
      this.app.changed(); this.show();
    },
    resizeMap(w, h) {
      w = Math.max(5, Math.min(100, w | 0)); h = Math.max(5, Math.min(100, h | 0));
      const m = this.map;
      if (w === m.width && h === m.height) return;
      this.snapshot();
      const ng = [], nd = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const inside = x < m.width && y < m.height;
        ng.push(inside ? m.ground[y * m.width + x] : (this.tile || null));
        nd.push(inside ? m.detail[y * m.width + x] : null);
      }
      m.ground = ng; m.detail = nd; m.width = w; m.height = h;
      m.entities = m.entities.filter(e => e.x < w && e.y < h);
      if (this.p.player.map === m.id) { this.p.player.x = Math.min(this.p.player.x, w - 1); this.p.player.y = Math.min(this.p.player.y, h - 1); }
      this.app.changed(); this.show();
    },

    /* ------------------------- tools ------------------------- */
    setTool(t) {
      this.tool = t;
      $$('#mapTools [data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    },
    setLayer(l) {
      this.layer = l;
      $$('.layer-switch [data-layer]').forEach(b => b.classList.toggle('active', b.dataset.layer === l));
      if (l !== 'chars') this.selected = null;
      this.renderPalette(); this.renderInspector();
    },

    snapshot() {
      const m = this.map;
      this.undoStack.push(JSON.stringify({ id: m.id, w: m.width, h: m.height, g: m.ground, d: m.detail, e: m.entities, pl: this.p.player }));
      if (this.undoStack.length > 60) this.undoStack.shift();
      this.redoStack = [];
    },
    restore(json) {
      const s = JSON.parse(json);
      const m = this.p.maps.find(x => x.id === s.id);
      if (!m) return;
      m.width = s.w; m.height = s.h; m.ground = s.g; m.detail = s.d; m.entities = s.e;
      this.p.player = s.pl;
      this.map = m;
      if (this.selected && !m.entities.find(e => e.id === this.selected)) this.selected = null;
      this.app.changed(); this.show();
    },
    current() {
      const m = this.map;
      return JSON.stringify({ id: m.id, w: m.width, h: m.height, g: m.ground, d: m.detail, e: m.entities, pl: this.p.player });
    },
    undo() { if (!this.undoStack.length) return; this.redoStack.push(this.current()); this.restore(this.undoStack.pop()); },
    redo() { if (!this.redoStack.length) return; this.undoStack.push(this.current()); this.restore(this.redoStack.pop()); },

    onKey(e) {
      if (this.app.tab !== 'map') return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.redo(); return; }
      if ((k === 'delete' || k === 'backspace') && this.selected) { e.preventDefault(); this.deleteSelected(); return; }
      const map = { p: 'paint', f: 'fill', r: 'rect', e: 'erase', i: 'pick' };
      if (!e.ctrlKey && !e.metaKey && map[k]) this.setTool(map[k]);
    },

    deleteSelected() {
      const m = this.map;
      const ent = m.entities.find(e => e.id === this.selected);
      if (!ent) return;
      const hasCode = ent.scripts.interact.code.trim() || ent.scripts.touch.code.trim();
      if (hasCode && !confirm(`Delete "${ent.name}" and its scripts?`)) return;
      this.snapshot();
      m.entities = m.entities.filter(e => e !== ent);
      this.selected = null;
      this.app.changed(); this.renderInspector();
    },

    freeSpotNear(x, y) {
      const m = this.map;
      for (let r = 1; r < 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
        if (!m.entities.some(e => e.x === nx && e.y === ny)) return [nx, ny];
      }
      return [x, y];
    },

    /* ------------------------- mouse ------------------------- */
    cellAt(ev) {
      const r = this.canvas.getBoundingClientRect();
      const s = T * this.zoom;
      return [Math.floor((ev.clientX - r.left) / s), Math.floor((ev.clientY - r.top) / s)];
    },
    inside(x, y) { return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height; },

    bindMouse() {
      const c = this.canvas;
      c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('pointerdown', e => {
        const [x, y] = this.cellAt(e);
        if (!this.inside(x, y)) return;
        c.setPointerCapture(e.pointerId);
        const right = e.button === 2;
        const m = this.map;
        this.drag = null;

        if (this.tool === 'player') {
          this.snapshot();
          this.p.player.map = m.id; this.p.player.x = x; this.p.player.y = y;
          this.app.changed(); this.renderInspector(); this.renderMapList();
          return;
        }
        if (this.layer === 'chars') {
          const ent = m.entities.slice().reverse().find(en => en.x === x && en.y === y);
          if (right || this.tool === 'erase') {
            if (ent) { this.selected = ent.id; this.deleteSelected(); }
            return;
          }
          if (ent) {
            this.selected = ent.id;
            this.drag = { ent, moved: false, snap: this.current() };
          } else if (this.sprite && this.tool !== 'pick') {
            this.snapshot();
            const a = this.p.assets[this.sprite];
            const n = m.entities.filter(en => en.sprite === a.id).length;
            const newEnt = {
              id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
              name: a.name + (n ? ' ' + (n + 1) : ''), sprite: a.id, x, y, solid: true, visible: true,
              scripts: { interact: { lang: 'js', code: '' }, touch: { lang: 'js', code: '' } }
            };
            m.entities.push(newEnt);
            this.selected = newEnt.id;
            this.app.changed();
          } else this.selected = null;
          this.renderInspector();
          return;
        }
        const layerArr = this.layer === 'detail' ? m.detail : m.ground;
        const value = (right || this.tool === 'erase') ? null : this.tile;
        if (this.tool === 'pick') {
          const v = m.detail[y * m.width + x] || m.ground[y * m.width + x];
          if (v) { this.tile = v; this.setLayer(m.detail[y * m.width + x] ? 'detail' : 'ground'); this.setTool('paint'); }
          return;
        }
        this.snapshot();
        if (this.tool === 'fill' && !right) { this.flood(layerArr, x, y, value); this.app.changed(); return; }
        if (this.tool === 'rect' && !right) { this.drag = { rect: [x, y, x, y], arr: layerArr, value }; return; }
        this.drag = { paint: true, arr: layerArr, value, last: [x, y] };
        layerArr[y * m.width + x] = value;
        this.app.changed();
      });
      c.addEventListener('pointermove', e => {
        const [x, y] = this.cellAt(e);
        $('#mapCoords').textContent = this.inside(x, y) ? `x: ${x}, y: ${y}` : '';
        this.hover = this.inside(x, y) ? [x, y] : null;
        const d = this.drag;
        if (!d) return;
        const m = this.map;
        if (d.ent) {
          if (this.inside(x, y) && (x !== d.ent.x || y !== d.ent.y)) {
            if (!d.moved) { this.undoStack.push(d.snap); this.redoStack = []; }
            d.ent.x = x; d.ent.y = y; d.moved = true;
          }
        } else if (d.rect) {
          d.rect[2] = Math.max(0, Math.min(m.width - 1, x)); d.rect[3] = Math.max(0, Math.min(m.height - 1, y));
        } else if (d.paint && this.inside(x, y)) {
          // fill gaps when the mouse moves quickly
          this.lineCells(d.last[0], d.last[1], x, y).forEach(([cx, cy]) => { d.arr[cy * m.width + cx] = d.value; });
          d.last = [x, y];
        }
      });
      const end = () => {
        const d = this.drag;
        if (!d) return;
        if (d.rect) {
          const [x0, y0, x1, y1] = d.rect, m = this.map;
          for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
            for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) d.arr[y * m.width + x] = d.value;
        }
        if (d.ent && d.moved) this.renderInspector();
        this.drag = null;
        this.app.changed();
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('pointerleave', () => { this.hover = null; $('#mapCoords').textContent = ''; });
    },

    lineCells(x0, y0, x1, y1) {
      const out = [];
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        out.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return out;
    },

    flood(arr, x, y, value) {
      const m = this.map, W = m.width;
      const target = arr[y * W + x];
      if (target === value) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= W || cy >= m.height) continue;
        const i = cy * W + cx;
        if (arr[i] !== target) continue;
        arr[i] = value;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    },

    /* ------------------------- drawing ------------------------- */
    resize() {
      if (!this.map) return;
      const s = T * this.zoom;
      this.canvas.width = this.map.width * s;
      this.canvas.height = this.map.height * s;
      this.draw();
    },

    draw(t) {
      const m = this.map; if (!m) return;
      const ctx = this.ctx, s = T * this.zoom, A = this.p.assets;
      if (this.canvas.width !== m.width * s || this.canvas.height !== m.height * s) { this.canvas.width = m.width * s; this.canvas.height = m.height * s; }
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0b0f1a';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
        const i = y * m.width + x;
        const g = A[m.ground[i]];
        if (g) ctx.drawImage(RPG.art.frameCanvas(g.frames[0]), x * s, y * s, s, s);
        else { ctx.fillStyle = (x + y) % 2 ? '#1e2638' : '#182030'; ctx.fillRect(x * s, y * s, s, s); }
        const d = A[m.detail[i]];
        if (d) {
          if (this.layer === 'ground') ctx.globalAlpha = 0.55;
          ctx.drawImage(RPG.art.frameCanvas(d.frames[0]), x * s, y * s, s, s);
          ctx.globalAlpha = 1;
        }
      }
      // characters
      m.entities.forEach(e => {
        const a = A[e.sprite];
        if (this.layer !== 'chars') ctx.globalAlpha = 0.85;
        if (!e.visible) ctx.globalAlpha = 0.4;
        if (a) ctx.drawImage(RPG.art.assetCanvas(a, t), e.x * s, e.y * s, s, s);
        ctx.globalAlpha = 1;
        const has = e.scripts.interact.code.trim() || e.scripts.touch.code.trim();
        if (has && this.layer === 'chars') { ctx.fillStyle = '#ffcd75'; ctx.font = `${Math.max(9, s / 3)}px sans-serif`; ctx.fillText('⚡', e.x * s + s * 0.62, e.y * s + s * 0.3); }
      });
      // player start
      if (this.p.player.map === m.id) {
        const a = A[this.p.player.sprite];
        const px = this.p.player.x * s, py = this.p.player.y * s;
        if (a) ctx.drawImage(RPG.art.frameCanvas(a.frames[0]), px, py, s, s);
        ctx.strokeStyle = '#a7f070'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(px + 1, py + 1, s - 2, s - 2); ctx.setLineDash([]);
      }
      if (this.grid && s >= 16) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= m.width; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, m.height * s); }
        for (let y = 0; y <= m.height; y++) { ctx.moveTo(0, y * s + 0.5); ctx.lineTo(m.width * s, y * s + 0.5); }
        ctx.stroke();
      }
      const sel = this.selected && m.entities.find(e => e.id === this.selected);
      if (sel) { ctx.strokeStyle = '#ffcd75'; ctx.lineWidth = 3; ctx.strokeRect(sel.x * s + 1.5, sel.y * s + 1.5, s - 3, s - 3); }
      if (this.drag && this.drag.rect) {
        const [x0, y0, x1, y1] = this.drag.rect;
        ctx.strokeStyle = '#41a6f6'; ctx.lineWidth = 2;
        ctx.strokeRect(Math.min(x0, x1) * s, Math.min(y0, y1) * s, (Math.abs(x1 - x0) + 1) * s, (Math.abs(y1 - y0) + 1) * s);
      }
      if (this.hover && !this.drag) {
        const [hx, hy] = this.hover;
        const brush = this.layer === 'chars' ? A[this.sprite] : A[this.tile];
        if (brush && (this.tool === 'paint' || this.tool === 'rect') && !(this.layer === 'chars' && m.entities.some(e => e.x === hx && e.y === hy))) {
          ctx.globalAlpha = 0.5;
          ctx.drawImage(RPG.art.frameCanvas(brush.frames[0]), hx * s, hy * s, s, s);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        ctx.strokeRect(hx * s + 0.5, hy * s + 0.5, s - 1, s - 1);
      }
    }
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  RPG.mapEditor = ME;
})(window.RPG);
