/* The game player: movement, drawing, dialog, and running student
 * scripts written in JavaScript or Python. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';

  const T = RPG.TILE;
  const VIEW_W = 20, VIEW_H = 15; // tiles visible on screen

  class StopGame extends Error { constructor() { super('stopped'); this.isStop = true; } }

  /* ------------------------------ Sound ------------------------------- */
  let actx = null;
  function beep(notes, type) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      notes.forEach(([freq, dur]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + dur);
        t += dur * 0.9;
      });
    } catch (e) { /* audio not available */ }
  }
  const SOUNDS = {
    coin: () => beep([[988, 0.08], [1319, 0.25]]),
    open: () => beep([[330, 0.08], [440, 0.08], [554, 0.15]], 'triangle'),
    hit: () => beep([[200, 0.08], [120, 0.15]], 'sawtooth'),
    hurt: () => beep([[300, 0.1], [180, 0.2]], 'sawtooth'),
    win: () => beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]]),
    lose: () => beep([[392, 0.2], [330, 0.2], [262, 0.4]], 'triangle'),
    talk: () => beep([[660, 0.04]]),
    magic: () => beep([[880, 0.06], [1175, 0.06], [1568, 0.06], [2093, 0.15]], 'sine'),
    step: () => beep([[140, 0.03]], 'triangle')
  };

  /* --------------------- JavaScript script transform ------------------ */
  const API_NAMES = [
    'say', 'ask', 'askNumber', 'wait', 'print', 'toast',
    'giveItem', 'takeItem', 'hasItem', 'itemCount',
    'setVar', 'getVar', 'changeHealth', 'getHealth', 'addScore', 'getScore',
    'goToMap', 'teleport', 'movePlayer', 'moveSelf', 'moveEntity', 'hide', 'show',
    'hideEntity', 'showEntity', 'setTile', 'getTile', 'playSound', 'win', 'lose', 'random',
    'playerX', 'playerY'
  ];
  // snake_case versions for Python (both styles work in both languages)
  const snake = s => s.replace(/[A-Z]/g, c => '_' + c.toLowerCase());

  function transformJS(code) {
    const ast = acorn.parse(code, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
    const inserts = []; // {pos, text, pri}
    const userFns = new Set();
    walk(ast, n => { if (n.type === 'FunctionDeclaration' && n.id) userFns.add(n.id.name); });
    const apiSet = new Set(API_NAMES.concat(API_NAMES.map(snake)));
    walk(ast, (n, parent) => {
      if (n.type === 'FunctionDeclaration' && !n.async) inserts.push({ pos: n.start, text: 'async ', pri: 1 });
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' &&
          (apiSet.has(n.callee.name) || userFns.has(n.callee.name)) &&
          !(parent && parent.type === 'AwaitExpression')) {
        inserts.push({ pos: n.start, text: '(await ', pri: 2 });
        inserts.push({ pos: n.end, text: ')', pri: 0 });
      }
      if (/^(While|DoWhile|For|ForOf|ForIn)Statement$/.test(n.type)) {
        if (n.body.type === 'BlockStatement') inserts.push({ pos: n.body.start + 1, text: '__tick();', pri: 0 });
        else {
          inserts.push({ pos: n.body.start, text: '{__tick();', pri: 0 });
          inserts.push({ pos: n.body.end, text: '}', pri: 3 });
        }
      }
    });
    // Apply from the end so earlier positions stay valid.
    inserts.sort((a, b) => b.pos - a.pos || b.pri - a.pri);
    let out = code;
    inserts.forEach(i => { out = out.slice(0, i.pos) + i.text + out.slice(i.pos); });
    return out;
  }
  function walk(node, fn, parent) {
    if (!node || typeof node.type !== 'string') return;
    fn(node, parent);
    for (const k in node) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn, node));
      else if (v && typeof v.type === 'string') walk(v, fn, node);
    }
  }

  /* ------------------------------- Game ------------------------------- */
  class Game {
    constructor(project, els) {
      // Work on a copy so the game can change tiles etc. without editing the project.
      this.src = project;
      this.p = JSON.parse(JSON.stringify(project));
      // keep original pixel arrays (shared) so the art cache works
      this.p.assets = project.assets;
      this.els = els;
      this.ctx = els.canvas.getContext('2d');
      this.vars = {};
      this.inventory = [];
      this.score = 0;
      this.maxHealth = this.p.player.health || 5;
      this.health = this.maxHealth;
      this.player = { x: this.p.player.x, y: this.p.player.y, px: 0, py: 0, dir: 1, moving: null };
      this.keys = {};
      this.running = true;
      this.busy = 0;          // number of scripts in progress
      this.scriptQueue = Promise.resolve();
      this.ended = false;
      this.t0 = performance.now();
      this.dialogResolve = null;
      this.log = els.log;
      this.setMap(this.p.player.map, this.player.x, this.player.y, false);
      this.onKey = this.onKey.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keyup', this.onKeyUp);
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
      this.updateHUD();
      this.runScript(this.p.scripts.start, null, 'Game start').then(() => this.runEnter());
    }

    stop() {
      this.running = false;
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('keyup', this.onKeyUp);
      if (this.dialogReject) this.dialogReject(new StopGame());
      this.els.dialog.hidden = true;
    }

    /* ---------- map helpers ---------- */
    mapById(idOrName) {
      const s = String(idOrName).toLowerCase();
      return this.p.maps.find(m => m.id === idOrName) || this.p.maps.find(m => m.name.toLowerCase() === s);
    }
    setMap(id, x, y) {
      const m = this.mapById(id);
      if (!m) throw new Error(`There is no map called "${id}"`);
      this.map = m;
      this.player.x = x; this.player.y = y;
      this.player.moving = null;
      this.entities = m.entities;
    }
    assetByName(nameOrId) {
      if (nameOrId == null) return null;
      const a = this.p.assets;
      if (a[nameOrId]) return a[nameOrId];
      const s = String(nameOrId).toLowerCase();
      return Object.values(a).find(x => x.name.toLowerCase() === s) || null;
    }
    tileSolid(x, y) {
      const m = this.map;
      if (x < 0 || y < 0 || x >= m.width || y >= m.height) return true;
      const i = y * m.width + x;
      const g = this.p.assets[m.ground[i]], d = this.p.assets[m.detail[i]];
      return !!((g && g.solid) || (d && d.solid));
    }
    entityAt(x, y) {
      return this.entities.find(e => e.visible && e.x === x && e.y === y && !e.moving);
    }
    entityByName(name) {
      const s = String(name).toLowerCase();
      for (const m of this.p.maps) {
        const e = m.entities.find(e => e.name.toLowerCase() === s || e.id === name);
        if (e) return e;
      }
      return null;
    }

    /* ---------- input ---------- */
    onKey(e) {
      if (!this.running) return;
      if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) &&
          !this.els.dialog.contains(document.activeElement)) return;
      const k = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(k) && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
      if (this.dialogKey && this.dialogKey(e)) return;
      this.keys[k.toLowerCase()] = true;
      if ((k === ' ' || k === 'Enter' || k === 'e' || k === 'z') && !this.busy && !this.ended) this.interact();
    }
    onKeyUp(e) { this.keys[e.key.toLowerCase()] = false; }

    interact() {
      const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][this.player.dir];
      const tx = this.player.x + dx, ty = this.player.y + dy;
      const ent = this.entityAt(tx, ty) || this.entityAt(this.player.x, this.player.y);
      if (ent && ent.scripts.interact && ent.scripts.interact.code.trim()) {
        this.runScript(ent.scripts.interact, ent, `${ent.name} – when talked to`);
      }
    }

    /* ---------- update & draw ---------- */
    frame(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
      this.last = now;
      this.update(dt);
      this.draw(Math.max(0, now - this.t0));
      requestAnimationFrame(this.frame);
    }

    update(dt) {
      const speed = 7; // tiles per second
      const pl = this.player;
      [pl, ...this.entities].forEach(o => {
        if (!o.moving) return;
        o.moving.t += dt * speed;
        if (o.moving.t >= 1) {
          const done = o.moving.done;
          o.moving = null;
          if (done) done();
        }
      });
      if (pl.moving || this.busy || this.ended) return;
      const k = this.keys;
      let dx = 0, dy = 0;
      if (k.arrowup || k.w) { dy = -1; pl.dir = 0; }
      else if (k.arrowdown || k.s) { dy = 1; pl.dir = 2; }
      else if (k.arrowleft || k.a) { dx = -1; pl.dir = 3; }
      else if (k.arrowright || k.d) { dx = 1; pl.dir = 1; }
      if (!dx && !dy) return;
      const nx = pl.x + dx, ny = pl.y + dy;
      const ent = this.entityAt(nx, ny);
      if (this.tileSolid(nx, ny) || (ent && ent.solid)) return;
      this.slide(pl, nx, ny, () => {
        const here = this.entityAt(pl.x, pl.y);
        if (here && !here.solid && here.scripts.touch && here.scripts.touch.code.trim()) {
          this.runScript(here.scripts.touch, here, `${here.name} – when touched`);
        }
      });
    }

    slide(o, nx, ny, done) {
      o.moving = { fx: o.x, fy: o.y, t: 0, done };
      o.x = nx; o.y = ny;
    }

    drawPos(o) {
      if (!o.moving) return [o.x, o.y];
      const t = o.moving.t;
      return [o.moving.fx + (o.x - o.moving.fx) * t, o.moving.fy + (o.y - o.moving.fy) * t];
    }

    draw(t) {
      const ctx = this.ctx, m = this.map, A = this.p.assets;
      const cw = this.els.canvas.width, ch = this.els.canvas.height;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      const [ppx, ppy] = this.drawPos(this.player);
      // camera follows the player, clamped to the map
      let camX = (ppx + 0.5) * T - cw / 2, camY = (ppy + 0.5) * T - ch / 2;
      camX = m.width * T <= cw ? (m.width * T - cw) / 2 : Math.max(0, Math.min(camX, m.width * T - cw));
      camY = m.height * T <= ch ? (m.height * T - ch) / 2 : Math.max(0, Math.min(camY, m.height * T - ch));
      camX = Math.round(camX); camY = Math.round(camY);
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
        const i = y * m.width + x, sx = x * T - camX, sy = y * T - camY;
        if (sx < -T || sy < -T || sx > cw || sy > ch) continue;
        const g = A[m.ground[i]]; if (g) ctx.drawImage(RPG.art.assetCanvas(g, t), sx, sy);
        const d = A[m.detail[i]]; if (d) ctx.drawImage(RPG.art.assetCanvas(d, t), sx, sy);
      }
      const drawSprite = (asset, x, y, flip, moving) => {
        const c = RPG.art.assetCanvas(asset, moving || asset.frames.length > 1 ? t : 0);
        if (!c) return;
        const sx = Math.round(x * T - camX), sy = Math.round(y * T - camY);
        if (flip) { ctx.save(); ctx.translate(sx + T, sy); ctx.scale(-1, 1); ctx.drawImage(c, 0, 0); ctx.restore(); }
        else ctx.drawImage(c, sx, sy);
      };
      const objs = this.entities.filter(e => e.visible).map(e => ({ e, pos: this.drawPos(e) }));
      objs.push({ player: true, pos: [ppx, ppy] });
      objs.sort((a, b) => a.pos[1] - b.pos[1]);
      objs.forEach(o => {
        if (o.player) {
          const a = A[this.p.player.sprite];
          if (!a) return;
          // only animate the hero while walking
          const canvas = RPG.art.frameCanvas(a.frames[this.player.moving ? Math.floor(t / (1000 / (a.fps || 6))) % a.frames.length : 0]);
          const sx = Math.round(o.pos[0] * T - camX), sy = Math.round(o.pos[1] * T - camY);
          if (this.player.dir === 3) { ctx.save(); ctx.translate(sx + T, sy); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0); ctx.restore(); }
          else ctx.drawImage(canvas, sx, sy);
        } else {
          drawSprite(A[o.e.sprite], o.pos[0], o.pos[1], o.e.flip, true);
        }
      });
    }

    updateHUD() {
      const h = this.els.hud;
      let hearts = '';
      for (let i = 0; i < this.maxHealth; i++) hearts += `<span class="heart${i < this.health ? '' : ' empty'}">♥</span>`;
      const counts = {};
      this.inventory.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
      const inv = Object.keys(counts).map(k => `<span class="inv-item">${esc(k)}${counts[k] > 1 ? ' ×' + counts[k] : ''}</span>`).join('') || '<span class="muted">empty</span>';
      h.innerHTML = `<div>${hearts}</div><div>Score: <b>${this.score}</b></div><div class="inv">Bag: ${inv}</div>`;
    }

    print(msg, kind) {
      const line = document.createElement('div');
      line.className = 'log-line ' + (kind || '');
      line.textContent = msg;
      this.log.appendChild(line);
      this.log.scrollTop = this.log.scrollHeight;
    }

    /* ---------- dialog ---------- */
    showDialog(speaker, text, options, inputType) {
      return new Promise((resolve, reject) => {
        if (!this.running) return reject(new StopGame());
        const d = this.els.dialog;
        d.hidden = false;
        d.innerHTML = '';
        d.onclick = null;
        if (speaker) { const s = document.createElement('div'); s.className = 'speaker'; s.textContent = speaker; d.appendChild(s); }
        const body = document.createElement('div'); body.className = 'dtext'; d.appendChild(body);
        // typewriter effect
        const full = String(text);
        let shown = 0;
        const timer = setInterval(() => {
          shown += 2; body.textContent = full.slice(0, shown);
          if (shown >= full.length) { clearInterval(timer); body.textContent = full; }
        }, 16);
        const finish = v => {
          clearInterval(timer);
          d.hidden = true; d.innerHTML = ''; d.onclick = null;
          this.dialogKey = null; this.dialogResolve = null; this.dialogReject = null;
          resolve(v);
        };
        this.dialogReject = e => { clearInterval(timer); this.dialogKey = null; reject(e); };
        const skipTyping = () => { if (shown < full.length) { shown = full.length; body.textContent = full; return true; } return false; };

        if (options && options.length) {
          const list = document.createElement('div'); list.className = 'choices'; d.appendChild(list);
          let sel = 0;
          const btns = options.map((o, i) => {
            const b = document.createElement('button');
            b.textContent = o; b.type = 'button';
            b.onclick = () => finish(o);
            b.onmouseenter = () => { sel = i; paint(); };
            list.appendChild(b);
            return b;
          });
          const paint = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
          paint();
          this.dialogKey = e => {
            const k = e.key;
            if (k === 'ArrowUp' || k === 'w' || k === 'ArrowLeft' || k === 'a') { sel = (sel + btns.length - 1) % btns.length; paint(); }
            else if (k === 'ArrowDown' || k === 's' || k === 'ArrowRight' || k === 'd') { sel = (sel + 1) % btns.length; paint(); }
            else if (k === ' ' || k === 'Enter' || k === 'e' || k === 'z') { if (!skipTyping()) finish(options[sel]); }
            else if (/^[1-9]$/.test(k) && options[+k - 1]) finish(options[+k - 1]);
            return true;
          };
        } else if (inputType) {
          const form = document.createElement('form'); form.className = 'answer';
          const inp = document.createElement('input');
          inp.type = inputType === 'number' ? 'number' : 'text'; inp.step = 'any';
          inp.placeholder = 'Type your answer…';
          const ok = document.createElement('button'); ok.textContent = 'OK';
          form.append(inp, ok); d.appendChild(form);
          form.onsubmit = ev => {
            ev.preventDefault();
            if (inputType === 'number') {
              if (inp.value.trim() === '' || isNaN(+inp.value)) { inp.focus(); return; }
              finish(+inp.value);
            } else finish(inp.value);
          };
          setTimeout(() => inp.focus(), 30);
          this.dialogKey = e => e.target === inp ? false : true;
        } else {
          const more = document.createElement('div'); more.className = 'more'; more.textContent = '▼ space'; d.appendChild(more);
          d.onclick = () => { if (!skipTyping()) finish(); };
          this.dialogKey = e => {
            if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'z') { if (!skipTyping()) finish(); }
            return true;
          };
        }
      });
    }

    endGame(won, msg) {
      this.ended = true;
      (won ? SOUNDS.win : SOUNDS.lose)();
      const o = this.els.overlay;
      o.hidden = false;
      o.innerHTML = `<h2>${won ? '🏆 You win!' : '💀 Game over'}</h2><p>${esc(msg || '')}</p><p>Score: ${this.score}</p><button type="button" class="btn primary">Play again</button>`;
      o.querySelector('button').onclick = () => this.els.restart();
      throw new StopGame();
    }

    /* ---------- script API ---------- */
    makeAPI(self) {
      const g = this;
      const check = () => { if (!g.running) throw new StopGame(); };
      const yielded = () => { g.lastYield = performance.now(); };
      const toNum = (v, name) => {
        const n = Number(v);
        if (Number.isNaN(n)) throw new Error(`${name} needs a number, but got "${v}"`);
        return n;
      };
      const api = {
        async say(text, speaker) {
          check(); SOUNDS.talk();
          await g.showDialog(speaker !== undefined ? speaker : (self ? self.name : ''), text === undefined ? '' : text);
          yielded();
        },
        async ask(question, ...options) {
          check();
          if (options.length === 1 && Array.isArray(options[0])) options = options[0];
          const r = await g.showDialog(self ? self.name : '', question, options.map(String), options.length ? null : 'text');
          yielded();
          return r;
        },
        async askNumber(question) {
          check();
          const r = await g.showDialog(self ? self.name : '', question, null, 'number');
          yielded();
          return r;
        },
        wait(seconds) {
          check();
          return new Promise(res => setTimeout(res, toNum(seconds, 'wait') * 1000)).then(() => { check(); yielded(); });
        },
        print(...a) { g.print(a.join(' ')); },
        toast(text) { g.toast(String(text)); },
        giveItem(name, count) { for (let i = 0; i < (count || 1); i++) g.inventory.push(String(name)); g.updateHUD(); },
        takeItem(name, count) {
          for (let i = 0; i < (count || 1); i++) {
            const idx = g.inventory.findIndex(x => x.toLowerCase() === String(name).toLowerCase());
            if (idx >= 0) g.inventory.splice(idx, 1);
          }
          g.updateHUD();
        },
        hasItem(name) { return g.inventory.some(x => x.toLowerCase() === String(name).toLowerCase()); },
        itemCount(name) { return g.inventory.filter(x => x.toLowerCase() === String(name).toLowerCase()).length; },
        setVar(name, value) { g.vars[name] = value; },
        getVar(name, fallback) { return name in g.vars ? g.vars[name] : (fallback === undefined ? null : fallback); },
        changeHealth(n) {
          n = toNum(n, 'changeHealth');
          g.health = Math.max(0, Math.min(g.maxHealth, g.health + n));
          if (n < 0) SOUNDS.hurt(); else if (n > 0) SOUNDS.magic();
          g.updateHUD();
          if (g.health <= 0) g.endGame(false, 'You ran out of health.');
        },
        getHealth() { return g.health; },
        addScore(n) { g.score += toNum(n, 'addScore'); g.updateHUD(); },
        getScore() { return g.score; },
        async goToMap(name, x, y) {
          check();
          const m = g.mapById(name);
          if (!m) throw new Error(`There is no map called "${name}"`);
          g.setMap(m.id, x === undefined ? g.player.x : toNum(x, 'goToMap'), y === undefined ? g.player.y : toNum(y, 'goToMap'));
          g.pendingEnter = true;
        },
        teleport(x, y) { g.player.x = toNum(x, 'teleport'); g.player.y = toNum(y, 'teleport'); g.player.moving = null; },
        playerX() { return g.player.x; },
        playerY() { return g.player.y; },
        movePlayer(dx, dy) { return g.moveObj(g.player, toNum(dx, 'movePlayer'), toNum(dy, 'movePlayer'), true); },
        moveSelf(dx, dy) {
          if (!self) throw new Error('moveSelf only works in a character\'s script');
          return g.moveObj(self, toNum(dx, 'moveSelf'), toNum(dy, 'moveSelf'));
        },
        moveEntity(name, dx, dy) {
          const e = g.entityByName(name);
          if (!e) throw new Error(`There is no character called "${name}"`);
          return g.moveObj(e, toNum(dx, 'moveEntity'), toNum(dy, 'moveEntity'));
        },
        hide() { if (self) self.visible = false; },
        show() { if (self) self.visible = true; },
        hideEntity(name) { const e = g.entityByName(name); if (!e) throw new Error(`There is no character called "${name}"`); e.visible = false; },
        showEntity(name) { const e = g.entityByName(name); if (!e) throw new Error(`There is no character called "${name}"`); e.visible = true; },
        setTile(x, y, tile, layer) {
          const m = g.map; x = toNum(x, 'setTile'); y = toNum(y, 'setTile');
          if (x < 0 || y < 0 || x >= m.width || y >= m.height) throw new Error(`(${x}, ${y}) is outside the map`);
          const a = tile ? g.assetByName(tile) : null;
          if (tile && !a) throw new Error(`There is no tile called "${tile}"`);
          const useDetail = layer === 'detail' || layer === 'top';
          (useDetail ? m.detail : m.ground)[y * m.width + x] = a ? a.id : null;
        },
        getTile(x, y) {
          const m = g.map, i = y * m.width + x;
          const a = g.p.assets[m.detail[i]] || g.p.assets[m.ground[i]];
          return a ? a.name : null;
        },
        playSound(name) {
          const s = SOUNDS[String(name).toLowerCase()];
          if (!s) throw new Error(`Unknown sound "${name}". Try: ${Object.keys(SOUNDS).join(', ')}`);
          s();
        },
        win(msg) { g.endGame(true, msg); },
        lose(msg) { g.endGame(false, msg); },
        random(a, b) {
          if (b === undefined) { b = a; a = 1; }
          a = Math.ceil(toNum(a, 'random')); b = Math.floor(toNum(b, 'random'));
          return a + Math.floor(Math.random() * (b - a + 1));
        }
      };
      return api;
    }

    moveObj(o, dx, dy, isPlayer) {
      // Move one tile at a time so the movement is animated.
      const steps = Math.abs(dx) + Math.abs(dy);
      const sx = Math.sign(dx), sy = Math.sign(dy);
      let p = Promise.resolve();
      for (let i = 0; i < steps; i++) {
        const useX = i < Math.abs(dx);
        p = p.then(() => new Promise(res => {
          if (!this.running) return res();
          const nx = o.x + (useX ? sx : 0), ny = o.y + (useX ? 0 : sy);
          if (isPlayer) this.player.dir = useX ? (sx > 0 ? 1 : 3) : (sy > 0 ? 2 : 0);
          else if (useX) o.flip = sx < 0;
          const blocker = this.entityAt(nx, ny);
          const playerThere = !isPlayer && this.player.x === nx && this.player.y === ny;
          if (this.tileSolid(nx, ny) || (blocker && blocker !== o && blocker.solid) || playerThere) return res();
          this.slide(o, nx, ny, res);
        }));
      }
      return p.then(() => { this.lastYield = performance.now(); });
    }

    toast(text) {
      const t = document.createElement('div');
      t.className = 'game-toast'; t.textContent = text;
      this.els.stage.appendChild(t);
      setTimeout(() => t.remove(), 2500);
    }

    /* ---------- running scripts ---------- */
    runEnter() {
      return this.runScript(this.map.scripts && this.map.scripts.enter, null, `${this.map.name} – when entered`);
    }

    // Scripts run one after another, never at the same time.
    runScript(script, self, label) {
      if (!script || !script.code || !script.code.trim()) return Promise.resolve();
      this.busy++;
      const job = this.scriptQueue.then(() => {
        if (!this.running) return;
        return (script.lang === 'py' ? this.runPython(script.code, self) : this.runJS(script.code, self));
      }).catch(err => {
        if (!this.running || this.ended || (err && (err.isStop || (err.nativeError && err.nativeError.isStop)))) return;
        this.reportError(err, label, script.lang);
      }).then(() => {
        this.busy--;
        if (this.pendingEnter && this.running) { this.pendingEnter = false; this.runEnter(); }
      });
      this.scriptQueue = job;
      return job;
    }

    reportError(err, label, lang) {
      let msg = err && err.message ? err.message : String(err);
      let line = null;
      if (lang === 'py') {
        msg = err && err.toString ? err.toString() : String(err);
        const m = msg.match(/ on line (\d+)/);
        if (m) { line = +m[1]; msg = msg.replace(m[0], ''); }
      } else if (err && err.lineNumber) line = err.lineNumber;
      else if (err && err.stack) {
        const m = err.stack.match(/<anonymous>:(\d+):\d+/);
        if (m) line = +m[1] - 3; // 2 wrapper lines + "use strict"
      }
      const text = `Error in ${label}${line ? ' (line ' + line + ')' : ''}: ${msg}`;
      this.print(text, 'error');
      this.toast('⚠ ' + text);
      if (this.els.onError) this.els.onError(text);
    }

    runJS(code, self) {
      let transformed;
      try { transformed = transformJS(code); }
      catch (e) {
        const err = new Error(e.message.replace(/\s*\(\d+:\d+\)$/, ''));
        err.lineNumber = e.loc ? e.loc.line : null;
        throw err;
      }
      const api = this.makeAPI(self);
      const names = [], values = [];
      Object.keys(api).forEach(k => {
        names.push(k); values.push(api[k]);
        const s = snake(k);
        if (s !== k) { names.push(s); values.push(api[k]); }
      });
      this.lastYield = performance.now();
      const g = this;
      names.push('__tick'); values.push(() => {
        if (!g.running) throw new StopGame();
        if (performance.now() - g.lastYield > 5000) throw new Error('Your loop ran for too long without stopping. Is it an infinite loop?');
      });
      names.push('vars'); values.push(this.vars);
      names.push('me'); values.push(self ? { name: self.name, get x() { return self.x; }, get y() { return self.y; } } : null);
      names.push('player'); values.push({ get x() { return g.player.x; }, get y() { return g.player.y; }, get health() { return g.health; }, get score() { return g.score; } });
      names.push('console'); values.push({ log: (...a) => g.print(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')) });
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(...names, '"use strict";\n' + transformed);
      return fn(...values);
    }

    runPython(code, self) {
      if (typeof Sk === 'undefined') return Promise.reject(new Error('Python engine failed to load.'));
      const g = this;
      const api = this.makeAPI(self);
      const toPy = v => {
        if (v === undefined || v === null) return Sk.builtin.none.none$;
        return Sk.ffi.remapToPy(v);
      };
      const toJs = v => Sk.ffi.remapToJs(v);
      const wrap = (fn, name) => new Sk.builtin.func(function (...args) {
        if (!g.running) throw new Sk.builtin.SystemExit('stopped');
        let r;
        try { r = fn(...args.map(toJs)); }
        catch (e) {
          if (e && e.isStop) throw e;
          throw new Sk.builtin.RuntimeError(`${name}: ${e.message}`);
        }
        if (r && typeof r.then === 'function') {
          return Sk.misceval.promiseToSuspension(r.then(toPy, e => {
            if (e && e.isStop) throw e;
            throw new Sk.builtin.RuntimeError(`${name}: ${e.message}`);
          }));
        }
        return toPy(r);
      });
      Sk.configure({
        output: text => { if (text.trim()) g.print(text.replace(/\n$/, '')); },
        read: f => {
          if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[f] === undefined) throw new Error(`File not found: '${f}'`);
          return Sk.builtinFiles.files[f];
        },
        __future__: Sk.python3,
        yieldLimit: 50,
        execLimit: null,
        killableWhile: true,
        killableFor: true
      });
      Object.keys(api).forEach(k => {
        if (k === 'print') return; // keep Python's own print
        const f = wrap(api[k], k);
        Sk.builtins[k] = f;
        Sk.builtins[snake(k)] = f;
      });
      Sk.builtins.me_name = toPy(self ? self.name : null);
      this.lastYield = performance.now();
      return Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true), {
        '*': () => {
          if (!g.running) throw new StopGame();
          if (performance.now() - g.lastYield > 5000) throw new Error('Your loop ran for too long without stopping. Is it an infinite loop?');
        }
      });
    }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  RPG.Game = Game;
  RPG.VIEW = { w: VIEW_W, h: VIEW_H };
  RPG.SOUND_NAMES = Object.keys(SOUNDS);
  RPG.transformJS = transformJS;
})(window.RPG);
