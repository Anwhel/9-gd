/* Browser saving (localStorage) plus export/import of project files. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';

  const INDEX_KEY = 'questStudio.projects';
  const PROJ_KEY = id => 'questStudio.project.' + id;
  const LAST_KEY = 'questStudio.lastProject';

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { localStorage.setItem(k, v); }

  function list() {
    try { return JSON.parse(safeGet(INDEX_KEY)) || []; } catch (e) { return []; }
  }
  function writeIndex(idx) { safeSet(INDEX_KEY, JSON.stringify(idx)); }

  function save(project) {
    project.updated = Date.now();
    safeSet(PROJ_KEY(project.id), JSON.stringify(project));
    const idx = list().filter(p => p.id !== project.id);
    idx.unshift({ id: project.id, name: project.name, updated: project.updated });
    writeIndex(idx);
    try { safeSet(LAST_KEY, project.id); } catch (e) { /* ignore */ }
  }

  function load(id) {
    const raw = safeGet(PROJ_KEY(id));
    if (!raw) return null;
    try { return upgrade(JSON.parse(raw)); } catch (e) { return null; }
  }

  function remove(id) {
    try { localStorage.removeItem(PROJ_KEY(id)); } catch (e) { /* ignore */ }
    writeIndex(list().filter(p => p.id !== id));
  }

  function lastId() { return safeGet(LAST_KEY); }

  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // Fill in anything missing so older/hand-edited files still open.
  function upgrade(p) {
    if (!p || typeof p !== 'object' || !p.assets || !Array.isArray(p.maps)) throw new Error('Not a Quest Studio project file.');
    p.format = 'quest-studio';
    p.version = p.version || 1;
    p.palette = p.palette || RPG.DEFAULT_PALETTE.slice();
    p.scripts = p.scripts || {};
    p.scripts.start = p.scripts.start || { lang: 'js', code: '' };
    p.player = p.player || { sprite: Object.keys(p.assets)[0], map: p.maps[0].id, x: 1, y: 1, health: 5 };
    p.maps.forEach(m => {
      m.scripts = m.scripts || {};
      m.scripts.enter = m.scripts.enter || { lang: 'js', code: '' };
      m.entities = m.entities || [];
      m.detail = m.detail || new Array(m.width * m.height).fill(null);
      m.entities.forEach(e => {
        e.scripts = e.scripts || {};
        ['interact', 'touch'].forEach(k => { e.scripts[k] = e.scripts[k] || { lang: 'js', code: '' }; });
        if (e.visible === undefined) e.visible = true;
      });
    });
    Object.values(p.assets).forEach(a => { a.fps = a.fps || 3; a.frames = a.frames && a.frames.length ? a.frames : [RPG.blankPixels()]; });
    return p;
  }

  function fileSafe(name) { return (name || 'project').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'project'; }

  function exportProject(project) {
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    download(blob, fileSafe(project.name) + '.quest.json');
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function importFile(file) {
    return file.text().then(text => {
      const p = upgrade(JSON.parse(text));
      // Don't silently replace a different project that happens to share an id.
      if (list().some(x => x.id === p.id)) p.id = newId();
      save(p);
      return p;
    });
  }

  RPG.storage = { list, save, load, remove, lastId, newId, upgrade, exportProject, importFile, download, fileSafe };
})(window.RPG);
