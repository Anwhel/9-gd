/* App shell: tabs, project management, autosave and the Play tab. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const App = {
    project: null,
    tab: 'map',
    game: null,

    init() {
      const last = RPG.storage.lastId();
      let p = last && RPG.storage.load(last);
      if (!p) {
        const first = RPG.storage.list()[0];
        p = first && RPG.storage.load(first.id);
      }
      if (!p) { p = RPG.makeStarterProject(); this.trySave(p); }
      this.bindShell();
      RPG.mapEditor.init(this);
      RPG.artEditor.init(this);
      RPG.scriptEditor.init(this);
      this.open(p);
      window.addEventListener('beforeunload', () => { if (this.dirty) this.saveNow(); });
    },

    open(project) {
      this.stopGame();
      this.project = project;
      $('#projName').value = project.name;
      RPG.mapEditor.load(project);
      RPG.artEditor.load(project);
      RPG.scriptEditor.load(project);
      this.setSaveState('Saved');
      this.showTab(this.tab === 'play' ? 'map' : this.tab);
    },

    /* ---------------- saving ---------------- */
    changed() {
      this.dirty = true;
      this.setSaveState('Saving…');
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.saveNow(), 700);
    },
    saveNow() {
      clearTimeout(this.saveTimer);
      if (this.trySave(this.project)) { this.dirty = false; this.setSaveState('Saved'); }
    },
    trySave(p) {
      try { RPG.storage.save(p); return true; }
      catch (e) {
        this.setSaveState('Not saved!', true);
        this.toast('Could not save in this browser (storage full or blocked). Use Export to keep a copy!', true);
        return false;
      }
    },
    setSaveState(t, bad) {
      const el = $('#saveState');
      el.textContent = t === 'Saved' ? '✓ Saved' : t;
      el.classList.toggle('bad', !!bad);
    },

    toast(msg, bad) {
      const t = $('#toast');
      t.textContent = msg; t.hidden = false;
      t.classList.toggle('bad', !!bad);
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 2500);
    },

    /* ---------------- tabs ---------------- */
    showTab(name) {
      if (this.tab === 'play' && name !== 'play') this.stopGame();
      this.tab = name;
      $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
      if (name === 'map') RPG.mapEditor.show();
      if (name === 'art') RPG.artEditor.show();
      if (name === 'scripts') RPG.scriptEditor.show();
      if (name === 'play') this.startGame();
    },

    editScript(ref) {
      RPG.scriptEditor.select(ref);
      this.showTab('scripts');
    },

    /* ---------------- play ---------------- */
    startGame() {
      this.stopGame();
      this.saveNow();
      $('#overlay').hidden = true;
      $('#dialog').hidden = true;
      $('#gameLog').innerHTML = '';
      const p = this.project;
      if (!p.maps.find(m => m.id === p.player.map)) p.player.map = p.maps[0].id;
      this.game = new RPG.Game(p, {
        canvas: $('#gameCanvas'), hud: $('#hud'), dialog: $('#dialog'), overlay: $('#overlay'),
        log: $('#gameLog'), stage: $('#stage'),
        restart: () => this.startGame()
      });
      if (document.activeElement) document.activeElement.blur();
    },
    stopGame() {
      if (this.game) { this.game.stop(); this.game = null; }
    },

    /* ---------------- projects ---------------- */
    bindShell() {
      $$('.tab-btn').forEach(b => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
      $('#projName').addEventListener('input', e => { this.project.name = e.target.value || 'Untitled'; this.changed(); });
      $('#btnExport').onclick = () => { this.saveNow(); RPG.storage.exportProject(this.project); };
      const pickImport = () => $('#importFile').click();
      $('#btnImport').onclick = pickImport;
      $('#dlgImport').onclick = pickImport;
      $('#importFile').onchange = e => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        RPG.storage.importFile(f).then(p => {
          $('#projectsDlg').close();
          this.saveNow();
          this.open(p);
          this.toast(`Opened "${p.name}"`);
        }).catch(err => this.toast('That file could not be opened: ' + err.message, true));
      };
      $('#btnProjects').onclick = () => { this.saveNow(); this.renderProjects(); $('#projectsDlg').showModal(); };
      $('#newStarter').onclick = () => this.newProject(RPG.makeStarterProject());
      $('#newBlank').onclick = () => this.newProject(this.blankProject());
      $('#btnRestart').onclick = () => this.startGame();
      $('#btnClearLog').onclick = () => { $('#gameLog').innerHTML = ''; };
      // let clicks on the stage give keyboard focus back to the game
      $('#stage').addEventListener('mousedown', () => { if (document.activeElement) document.activeElement.blur(); });
    },

    newProject(p) {
      this.saveNow();
      p.id = RPG.storage.newId();
      const base = p.name;
      const names = RPG.storage.list().map(x => x.name);
      let n = 2;
      while (names.includes(p.name)) p.name = `${base} ${n++}`;
      this.trySave(p);
      $('#projectsDlg').close();
      this.open(p);
    },

    blankProject() {
      const starter = RPG.makeStarterProject();
      const keep = ['grass', 'path', 'wall', 'water', 'tree', 'hero'];
      const assets = {};
      keep.forEach(k => { assets[k] = starter.assets[k]; });
      const W = 20, H = 15;
      return {
        format: 'quest-studio', version: 1, id: '', name: 'Untitled Game',
        palette: RPG.DEFAULT_PALETTE.slice(), assets,
        maps: [{ id: 'm1', name: 'Map 1', width: W, height: H, ground: new Array(W * H).fill('grass'), detail: new Array(W * H).fill(null), entities: [], scripts: { enter: { lang: 'js', code: '' } } }],
        player: { sprite: 'hero', map: 'm1', x: 2, y: 2, health: 5 },
        scripts: { start: { lang: 'js', code: '' } }
      };
    },

    renderProjects() {
      const ul = $('#projList');
      ul.innerHTML = '';
      RPG.storage.list().forEach(item => {
        const li = document.createElement('li');
        li.className = item.id === this.project.id ? 'active' : '';
        const when = new Date(item.updated).toLocaleString();
        li.innerHTML = `<div class="grow"><b></b><div class="muted small">Last saved ${when}</div></div>`;
        li.querySelector('b').textContent = item.name;
        const open = document.createElement('button');
        open.type = 'button'; open.className = 'btn sm'; open.textContent = item.id === this.project.id ? 'Open (current)' : 'Open';
        open.onclick = () => {
          const p = RPG.storage.load(item.id);
          if (!p) return this.toast('Could not load that project.', true);
          $('#projectsDlg').close();
          this.open(p);
        };
        const exp = document.createElement('button');
        exp.type = 'button'; exp.className = 'btn sm'; exp.textContent = '⬇ Export';
        exp.onclick = () => { const p = RPG.storage.load(item.id); if (p) RPG.storage.exportProject(p); };
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'btn sm danger'; del.textContent = 'Delete';
        del.onclick = () => {
          if (!confirm(`Delete "${item.name}" from this browser? Export it first if you want to keep a copy.`)) return;
          RPG.storage.remove(item.id);
          if (item.id === this.project.id) {
            const next = RPG.storage.list()[0];
            this.open(next ? RPG.storage.load(next.id) : (() => { const p = RPG.makeStarterProject(); this.trySave(p); return p; })());
          }
          this.renderProjects();
        };
        li.append(open, exp, del);
        ul.appendChild(li);
      });
    }
  };

  RPG.app = App;
  window.addEventListener('DOMContentLoaded', () => App.init());
})(window.RPG);
