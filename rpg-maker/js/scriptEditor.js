/* Script editor with live pseudocode and flowchart views. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // Command reference: [name, description, JavaScript example, Python example]
  const COMMANDS = [
    ['Talking', null],
    ['say', 'Show a message box', 'say("Hello, traveller!");', 'say("Hello, traveller!")'],
    ['ask (choices)', 'Ask a question with buttons; gives back the choice', 'let answer = ask("Will you help?", "Yes", "No");', 'answer = ask("Will you help?", "Yes", "No")'],
    ['ask (typing)', 'Player types an answer', 'let name = ask("What is your name?");', 'name = ask("What is your name?")'],
    ['askNumber', 'Player types a number', 'let guess = askNumber("Guess a number 1-10");', 'guess = ask_number("Guess a number 1-10")'],
    ['Items', null],
    ['giveItem', 'Put an item in the bag', 'giveItem("Key");', 'give_item("Key")'],
    ['takeItem', 'Remove an item from the bag', 'takeItem("Key");', 'take_item("Key")'],
    ['hasItem', 'true if the bag has the item', 'if (hasItem("Key")) {\n  say("You have the key!");\n}', 'if has_item("Key"):\n    say("You have the key!")'],
    ['itemCount', 'How many of an item', 'let coins = itemCount("Coin");', 'coins = item_count("Coin")'],
    ['Remembering things', null],
    ['setVar', 'Remember a value for the rest of the game', 'setVar("talkedToSage", true);', 'set_var("talked_to_sage", True)'],
    ['getVar', 'Get a remembered value (null/None if not set)', 'if (getVar("talkedToSage")) {\n  say("Hello again!");\n}', 'if get_var("talked_to_sage"):\n    say("Hello again!")'],
    ['Player', null],
    ['changeHealth', 'Heal (+) or hurt (−) the player', 'changeHealth(-1);', 'change_health(-1)'],
    ['getHealth', 'Player health now', 'if (getHealth() < 2) {\n  say("You look hurt!");\n}', 'if get_health() < 2:\n    say("You look hurt!")'],
    ['addScore', 'Add points', 'addScore(10);', 'add_score(10)'],
    ['getScore', 'Points so far', 'say("Score: " + getScore());', 'say(f"Score: {get_score()}")'],
    ['goToMap', 'Send the player to a map at (x, y)', 'goToMap("Cave", 2, 3);', 'go_to_map("Cave", 2, 3)'],
    ['teleport', 'Move the player on this map', 'teleport(5, 5);', 'teleport(5, 5)'],
    ['movePlayer', 'Walk the player by (dx, dy)', 'movePlayer(0, 2);', 'move_player(0, 2)'],
    ['Characters & map', null],
    ['moveSelf', 'Walk this character by (dx, dy)', 'moveSelf(2, 0);', 'move_self(2, 0)'],
    ['moveEntity', 'Walk another character', 'moveEntity("Sage", 0, -1);', 'move_entity("Sage", 0, -1)'],
    ['hide / show', 'Hide or show this character', 'hide();', 'hide()'],
    ['hideEntity / showEntity', 'Hide or show another character', 'showEntity("Door");', 'show_entity("Door")'],
    ['setTile', 'Change a tile at (x, y)', 'setTile(10, 4, "Path");', 'set_tile(10, 4, "Path")'],
    ['getTile', 'Name of the tile at (x, y)', 'if (getTile(3, 3) == "Water") {\n  say("Splash!");\n}', 'if get_tile(3, 3) == "Water":\n    say("Splash!")'],
    ['Other', null],
    ['playSound', 'Sounds: ' + ['coin', 'open', 'hit', 'hurt', 'win', 'lose', 'talk', 'magic', 'step'].join(', '), 'playSound("coin");', 'play_sound("coin")'],
    ['wait', 'Pause for some seconds', 'wait(1);', 'wait(1)'],
    ['random', 'Random whole number between two numbers', 'let roll = random(1, 6);', 'roll = random(1, 6)'],
    ['win / lose', 'End the game', 'win("You saved the village!");', 'win("You saved the village!")'],
    ['print', 'Write to the Output panel (for testing)', 'print("x is", x);', 'print("x is", x)'],
    ['Code patterns', null],
    ['if / else', 'Make a decision', 'if (getScore() > 10) {\n  say("Great!");\n} else {\n  say("Keep trying!");\n}', 'if get_score() > 10:\n    say("Great!")\nelse:\n    say("Keep trying!")'],
    ['while loop', 'Repeat while something is true', 'let tries = 0;\nwhile (tries < 3) {\n  tries = tries + 1;\n  say("Try number " + tries);\n}', 'tries = 0\nwhile tries < 3:\n    tries = tries + 1\n    say(f"Try number {tries}")'],
    ['for loop', 'Repeat a set number of times', 'for (let i = 1; i <= 3; i++) {\n  say("Count: " + i);\n}', 'for i in range(1, 4):\n    say(f"Count: {i}")'],
    ['function', 'Name a group of steps to reuse', 'function greet(name) {\n  say("Hi " + name + "!");\n}\n\ngreet("Sam");', 'def greet(name):\n    say(f"Hi {name}!")\n\ngreet("Sam")']
  ];

  const SE = {
    app: null, p: null, ref: null, view: 'pseudo', cm: null,

    init(app) {
      this.app = app;
      this.cm = CodeMirror($('#codeHost'), {
        value: '', mode: 'javascript', theme: 'material-darker', lineNumbers: true,
        indentUnit: 4, tabSize: 4, lineWrapping: true, matchBrackets: true, autoCloseBrackets: true,
        extraKeys: { Tab: cm => cm.execCommand(cm.somethingSelected() ? 'indentMore' : 'insertSoftTab'), 'Shift-Tab': 'indentLess' }
      });
      this.cm.on('change', () => {
        const s = this.script();
        if (!s || this.loading) return;
        s.code = this.cm.getValue();
        this.app.changed();
        clearTimeout(this.viewT);
        this.viewT = setTimeout(() => { this.updateView(); this.renderList(); }, 350);
      });
      $$('#langSwitch [data-lang]').forEach(b => b.onclick = () => this.setLang(b.dataset.lang));
      $$('#viewSwitch [data-view]').forEach(b => b.onclick = () => {
        this.view = b.dataset.view;
        $$('#viewSwitch [data-view]').forEach(x => x.classList.toggle('active', x === b));
        $('#pseudoView').hidden = this.view !== 'pseudo';
        $('#flowView').hidden = this.view !== 'flow';
        $('#fitWrap').hidden = this.view !== 'flow';
        $('#btnDownloadView').textContent = this.view === 'flow' ? '⬇ Save PNG' : '⬇ Save .txt';
        this.updateView();
      });
      $('#flowFit').onchange = e => $('#flowView').classList.toggle('fit', e.target.checked);
      $('#flowView').classList.add('fit');
      $('#btnApi').onclick = () => { const p = $('#apiPanel'); p.hidden = !p.hidden; if (!p.hidden) this.renderApi(); };
      $('#btnTestScript').onclick = () => this.app.showTab('play');
      $('#btnCopyView').onclick = () => this.copyView();
      $('#btnDownloadView').onclick = () => this.downloadView();
      $('#btnDownloadView').textContent = '⬇ Save .txt';
    },

    load(p) {
      this.p = p;
      this.ref = { type: 'game', event: 'start' };
      // open the first script that has code in it
      const first = this.allRefs().find(r => this.scriptFor(r).code.trim());
      if (first) this.ref = first;
    },

    show() {
      if (!this.p) return;
      if (!this.scriptFor(this.ref)) this.ref = { type: 'game', event: 'start' };
      this.renderList();
      this.loadEditor();
      setTimeout(() => this.cm.refresh(), 0);
    },

    select(ref) { this.ref = ref; },

    allRefs() {
      const refs = [{ type: 'game', event: 'start' }];
      this.p.maps.forEach(m => {
        refs.push({ type: 'map', mapId: m.id, event: 'enter' });
        m.entities.forEach(e => ['interact', 'touch'].forEach(ev => refs.push({ type: 'entity', mapId: m.id, entId: e.id, event: ev })));
      });
      return refs;
    },
    scriptFor(ref) {
      if (!ref) return null;
      if (ref.type === 'game') return this.p.scripts.start;
      const m = this.p.maps.find(x => x.id === ref.mapId);
      if (!m) return null;
      if (ref.type === 'map') return m.scripts.enter;
      const e = m.entities.find(x => x.id === ref.entId);
      return e ? e.scripts[ref.event] : null;
    },
    script() { return this.scriptFor(this.ref); },
    titleFor(ref) {
      if (ref.type === 'game') return 'Game – when the game starts';
      const m = this.p.maps.find(x => x.id === ref.mapId);
      if (ref.type === 'map') return `${m.name} – when the player enters`;
      const e = m.entities.find(x => x.id === ref.entId);
      return `${e.name} – ${ref.event === 'interact' ? 'when talked to' : 'when touched'}`;
    },
    same(a, b) { return a && b && a.type === b.type && a.mapId === b.mapId && a.entId === b.entId && a.event === b.event; },

    renderList() {
      const ul = $('#scriptList');
      ul.innerHTML = '';
      const item = (ref, label, indent) => {
        const s = this.scriptFor(ref);
        const li = document.createElement('li');
        li.className = (this.same(ref, this.ref) ? 'active ' : '') + (indent ? 'indent' : '');
        const has = s.code.trim();
        li.innerHTML = `<span class="dot ${has ? 'on' : ''}"></span><span class="grow"></span><span class="lang">${has ? (s.lang === 'py' ? 'PY' : 'JS') : ''}</span>`;
        li.children[1].textContent = label;
        li.onclick = () => { this.ref = ref; this.renderList(); this.loadEditor(); };
        ul.appendChild(li);
      };
      const head = t => { const li = document.createElement('li'); li.className = 'group'; li.textContent = t; ul.appendChild(li); };
      head('🎮 Game');
      item({ type: 'game', event: 'start' }, '🏁 When the game starts', true);
      this.p.maps.forEach(m => {
        head('🗺️ ' + m.name);
        item({ type: 'map', mapId: m.id, event: 'enter' }, '🚪 When entered', true);
        m.entities.forEach(e => {
          item({ type: 'entity', mapId: m.id, entId: e.id, event: 'interact' }, `💬 ${e.name}: talked to`, true);
          if (!e.solid || e.scripts.touch.code.trim()) item({ type: 'entity', mapId: m.id, entId: e.id, event: 'touch' }, `👣 ${e.name}: touched`, true);
        });
      });
    },

    loadEditor() {
      const s = this.script();
      if (!s) return;
      this.loading = true;
      this.cm.setOption('mode', s.lang === 'py' ? 'python' : 'javascript');
      this.cm.setValue(s.code);
      this.cm.clearHistory();
      this.loading = false;
      $('#scriptTitle').textContent = this.titleFor(this.ref);
      $$('#langSwitch [data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === s.lang));
      if (!$('#apiPanel').hidden) this.renderApi();
      this.updateView();
    },

    setLang(lang) {
      const s = this.script();
      if (!s || s.lang === lang) return;
      if (s.code.trim()) {
        const name = lang === 'py' ? 'Python' : 'JavaScript';
        if (!confirm(`Switch this script to ${name}? Your current code will be kept, but turned into comments so you can rewrite it.`)) return;
        const prefix = lang === 'py' ? '# ' : '// ';
        s.code = s.code.split('\n').map(l => l.trim() ? prefix + l : l).join('\n') + '\n';
      }
      s.lang = lang;
      this.app.changed();
      this.loadEditor();
      this.renderList();
    },

    /* --------------- pseudocode / flowchart --------------- */
    checkSyntax(s) {
      // returns {line, message} or null
      if (s.lang === 'py') {
        if (typeof Sk === 'undefined') return null;
        try {
          Sk.configure({ __future__: Sk.python3 });
          Sk.parse('<stdin>', s.code);
        } catch (e) {
          const line = e.traceback && e.traceback[0] ? e.traceback[0].lineno : (e.args && e.args.v && e.args.v[2]) || null;
          let msg = e.toString ? e.toString() : String(e);
          msg = msg.replace(/ on line \d+$/, '');
          return this.friendlyPyError(s.code, line, msg);
        }
        return null;
      }
      try { acorn.parse(s.code, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
      catch (e) { return { line: e.loc ? e.loc.line : null, message: e.message.replace(/\s*\(\d+:\d+\)$/, '') }; }
      return null;
    },

    // Skulpt's messages can be vague ("bad input"), so look for common mistakes.
    friendlyPyError(code, line, msg) {
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].replace(/#.*$/, '').trim();
        if (/^(if|elif|else|while|for|def)\b/.test(t) && !t.endsWith(':') && !/[([{,\\]$/.test(t)) {
          return { line: i + 1, message: `Missing a colon ":" at the end of this line.` };
        }
        if (/^(if|elif|while)\b/.test(t) && /[^=!<>]=[^=]/.test(t.replace(/(["']).*?\1/g, ''))) {
          return { line: i + 1, message: 'Use == to compare (a single = means "set").' };
        }
      }
      if (/bad input/.test(msg)) msg = 'SyntaxError: Python could not understand this line. Check brackets, quotes and colons.';
      if (/IndentationError|unindent|indent/i.test(msg)) msg += ' – check the spaces at the start of the line.';
      return { line, message: msg };
    },

    updateView() {
      const s = this.script();
      if (!s) return;
      const status = $('#codeStatus');
      if (this.errLine != null) { this.cm.removeLineClass(this.errLine, 'background', 'cm-error-line'); this.errLine = null; }
      const err = s.code.trim() ? this.checkSyntax(s) : null;
      if (err) {
        status.className = 'code-status bad';
        status.textContent = `⚠ ${err.line ? 'Line ' + err.line + ': ' : ''}${err.message}`;
        if (err.line) { this.errLine = err.line - 1; this.cm.addLineClass(this.errLine, 'background', 'cm-error-line'); }
      } else {
        status.className = 'code-status ok';
        status.textContent = s.code.trim() ? '✓ No syntax errors found' : 'Empty script – click 📖 Commands for ideas.';
      }
      if (!s.code.trim()) {
        $('#pseudoView').textContent = 'Write some code and the pseudocode will appear here.';
        $('#flowView').innerHTML = '<p class="hint">Write some code and the flowchart will appear here.</p>';
        return;
      }
      if (err && s.lang === 'js') {
        // JavaScript can't be modelled until it parses; keep the last good view
        $('#pseudoView').classList.add('stale');
        $('#flowView').classList.add('stale');
        return;
      }
      $('#pseudoView').classList.remove('stale');
      $('#flowView').classList.remove('stale');
      try {
        const model = RPG.codeModel.parse(s.code, s.lang);
        const title = this.titleFor(this.ref).split(' – ')[0];
        this.pseudo = RPG.codeModel.toPseudocode(model, title);
        if (this.view === 'pseudo') $('#pseudoView').textContent = this.pseudo;
        else $('#flowView').innerHTML = RPG.flowchart.render(model, title);
      } catch (e) {
        $('#pseudoView').textContent = 'Could not build the pseudocode: ' + e.message;
      }
    },

    copyView() {
      if (this.view === 'pseudo') {
        navigator.clipboard.writeText($('#pseudoView').textContent).then(() => this.app.toast('Pseudocode copied'), () => this.app.toast('Copy failed – select the text and copy it instead', true));
        return;
      }
      this.flowPNG().then(blob => {
        if (!window.ClipboardItem) throw new Error('no clipboard');
        return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }).then(() => this.app.toast('Flowchart image copied'), () => this.app.toast('Copy not supported here – use Save PNG', true));
    },

    downloadView() {
      const name = RPG.storage.fileSafe(this.titleFor(this.ref).replace(' – ', ' '));
      if (this.view === 'pseudo') {
        RPG.storage.download(new Blob([$('#pseudoView').textContent], { type: 'text/plain' }), name + '_pseudocode.txt');
      } else {
        this.flowPNG().then(b => RPG.storage.download(b, name + '_flowchart.png'));
      }
    },

    flowPNG() {
      const svg = $('#flowView svg');
      if (!svg) return Promise.reject(new Error('no chart'));
      const w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
          const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
          c.toBlob(res);
        };
        img.onerror = rej;
        img.src = url;
      });
    },

    /* --------------- command reference --------------- */
    renderApi() {
      const s = this.script();
      const py = s && s.lang === 'py';
      const el = $('#apiPanel');
      el.innerHTML = `<div class="panel-head"><h3>Commands (${py ? 'Python' : 'JavaScript'})</h3><button class="btn sm" id="apiClose">✕</button></div><p class="hint">Click a command to add it to your script.</p>`;
      el.querySelector('#apiClose').onclick = () => { el.hidden = true; };
      const grid = document.createElement('div'); grid.className = 'api-grid';
      COMMANDS.forEach(c => {
        if (!c[1]) { const h = document.createElement('h4'); h.textContent = c[0]; grid.appendChild(h); return; }
        const b = document.createElement('button');
        b.className = 'api-item';
        const code = py ? c[3] : c[2];
        b.innerHTML = '<b></b><span class="muted small"></span><code></code>';
        b.children[0].textContent = c[0];
        b.children[1].textContent = c[1];
        b.children[2].textContent = code;
        b.onclick = () => this.insert(code);
        grid.appendChild(b);
      });
      el.appendChild(grid);
    },

    insert(code) {
      const cm = this.cm;
      const cur = cm.getCursor();
      const line = cm.getLine(cur.line);
      const indent = line.match(/^\s*/)[0];
      const text = code.split('\n').map((l, i) => i ? indent + l : l).join('\n');
      if (line.trim()) { cm.replaceRange('\n' + indent + text, { line: cur.line, ch: line.length }); }
      else cm.replaceRange(text, { line: cur.line, ch: indent.length }, { line: cur.line, ch: line.length });
      cm.focus();
    }
  };

  RPG.scriptEditor = SE;
})(window.RPG);
