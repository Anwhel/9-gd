/* Converts student code (JavaScript or Python) into a simple shared
 * "program model" (IR), then turns that model into pseudocode text.
 * The flowchart renderer (flowchart.js) draws the same model.
 *
 * IR node shapes:
 *   {kind:'seq', items:[...]}
 *   {kind:'stmt', text, io:'out'|'in'|null}   // process / input-output
 *   {kind:'if', cond, then:seq, else:seq|null}
 *   {kind:'loop', loopType:'while'|'for'|'repeat', head, body:seq}
 *   {kind:'func', name, params, body:seq}
 *   {kind:'return', text}
 *   {kind:'break'} / {kind:'continue'}
 */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';

  // Functions whose calls count as output (parallelogram) or input.
  const OUTPUT_FNS = ['say', 'print', 'console.log', 'toast', 'win', 'lose'];
  const INPUT_FNS = ['ask', 'input', 'prompt', 'askNumber', 'ask_number'];

  function seq(items) { return { kind: 'seq', items: items || [] }; }

  /* ---------------- Friendly text for common game API calls ------------- */
  // name -> (argsArray) => pseudocode text
  const API_TEXT = {
    say: a => `DISPLAY ${a.join(', ')}`,
    print: a => `DISPLAY ${a.join(', ')}`,
    'console.log': a => `DISPLAY ${a.join(', ')}`,
    toast: a => `DISPLAY ${a.join(', ')} (popup)`,
    ask: a => `INPUT answer to ${a[0] || ''}${a[1] ? ' from choices ' + a.slice(1).join(', ') : ''}`,
    askNumber: a => `INPUT number answer to ${a[0] || ''}`,
    ask_number: a => `INPUT number answer to ${a[0] || ''}`,
    input: a => `INPUT ${a[0] || ''}`,
    wait: a => `WAIT ${a[0]} seconds`,
    giveItem: a => `ADD ${a[0]} to inventory`,
    give_item: a => `ADD ${a[0]} to inventory`,
    takeItem: a => `REMOVE ${a[0]} from inventory`,
    take_item: a => `REMOVE ${a[0]} from inventory`,
    hasItem: a => `player has ${a[0]}`,
    has_item: a => `player has ${a[0]}`,
    setVar: a => `SET ${unquote(a[0])} TO ${a[1]}`,
    set_var: a => `SET ${unquote(a[0])} TO ${a[1]}`,
    getVar: a => `${unquote(a[0])}`,
    get_var: a => `${unquote(a[0])}`,
    changeHealth: a => `CHANGE player health BY ${a[0]}`,
    change_health: a => `CHANGE player health BY ${a[0]}`,
    addScore: a => `ADD ${a[0]} to score`,
    add_score: a => `ADD ${a[0]} to score`,
    goToMap: a => `MOVE player to map ${a[0]}${a.length > 2 ? ' at (' + a[1] + ', ' + a[2] + ')' : ''}`,
    go_to_map: a => `MOVE player to map ${a[0]}${a.length > 2 ? ' at (' + a[1] + ', ' + a[2] + ')' : ''}`,
    teleport: a => `MOVE player to (${a[0]}, ${a[1]})`,
    moveSelf: a => `MOVE this character by (${a[0]}, ${a[1]})`,
    move_self: a => `MOVE this character by (${a[0]}, ${a[1]})`,
    movePlayer: a => `MOVE player by (${a[0]}, ${a[1]})`,
    move_player: a => `MOVE player by (${a[0]}, ${a[1]})`,
    hide: () => `HIDE this character`,
    show: a => `SHOW character ${a[0] || ''}`,
    hideEntity: a => `HIDE character ${a[0]}`,
    hide_entity: a => `HIDE character ${a[0]}`,
    showEntity: a => `SHOW character ${a[0]}`,
    show_entity: a => `SHOW character ${a[0]}`,
    setTile: a => `SET tile at (${a[0]}, ${a[1]}) TO ${a[2]}`,
    set_tile: a => `SET tile at (${a[0]}, ${a[1]}) TO ${a[2]}`,
    playSound: a => `PLAY sound ${a[0]}`,
    play_sound: a => `PLAY sound ${a[0]}`,
    win: a => `END GAME (win) showing ${a[0] || ''}`,
    lose: a => `END GAME (lose) showing ${a[0] || ''}`,
    getHealth: () => 'player health',
    get_health: () => 'player health',
    getScore: () => 'score',
    get_score: () => 'score',
    itemCount: a => `number of ${a[0]} in inventory`,
    item_count: a => `number of ${a[0]} in inventory`,
    getTile: a => `tile at (${a[0]}, ${a[1]})`,
    get_tile: a => `tile at (${a[0]}, ${a[1]})`,
    playerX: () => 'player x', player_x: () => 'player x',
    playerY: () => 'player y', player_y: () => 'player y',
    moveEntity: a => `MOVE character ${a[0]} by (${a[1]}, ${a[2]})`,
    move_entity: a => `MOVE character ${a[0]} by (${a[1]}, ${a[2]})`,
    random: a => `random number from ${a[0]} to ${a[1]}`,
    'random.randint': a => `random number from ${a[0]} to ${a[1]}`,
    'Math.random': () => `random number`,
    len: a => `length of ${a[0]}`,
    str: a => `${a[0]} as text`,
    int: a => `${a[0]} as whole number`,
    'parseInt': a => `${a[0]} as whole number`,
    'Number': a => `${a[0]} as number`,
    'String': a => `${a[0]} as text`
  };
  function unquote(s) { return (s || '').replace(/^["'`](.*)["'`]$/, '$1'); }

  function callText(name, args) {
    if (API_TEXT[name]) return API_TEXT[name](args);
    return `CALL ${name}(${args.join(', ')})`;
  }
  function ioFor(name) {
    if (OUTPUT_FNS.includes(name)) return 'out';
    if (INPUT_FNS.includes(name)) return 'in';
    return null;
  }

  /* ======================= JavaScript (via acorn) ======================= */
  function jsToModel(code) {
    const ast = acorn.parse(code, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
    return seq(jsBlock(ast.body));
  }

  const JS_OPS = { '===': '=', '==': '=', '!==': '≠', '!=': '≠', '&&': 'AND', '||': 'OR', '<=': '≤', '>=': '≥' };

  function jsExpr(n) {
    if (!n) return '';
    switch (n.type) {
      case 'Literal':
        if (typeof n.value === 'string') return JSON.stringify(n.value);
        return String(n.raw);
      case 'TemplateLiteral': {
        let s = '';
        n.quasis.forEach((q, i) => {
          s += q.value.cooked;
          if (n.expressions[i]) s += '" + ' + jsExpr(n.expressions[i]) + ' + "';
        });
        return ('"' + s + '"').replace(/^"" \+ /, '').replace(/ \+ ""$/, '');
      }
      case 'Identifier': return n.name;
      case 'ThisExpression': return 'this';
      case 'AwaitExpression': return jsExpr(n.argument);
      case 'MemberExpression':
        return n.computed ? `${jsExpr(n.object)}[${jsExpr(n.property)}]` : `${jsExpr(n.object)}.${jsExpr(n.property)}`;
      case 'BinaryExpression':
      case 'LogicalExpression':
        return `${jsExprP(n.left)} ${JS_OPS[n.operator] || n.operator} ${jsExprP(n.right)}`;
      case 'UnaryExpression':
        if (n.operator === '!') return `NOT ${jsExprP(n.argument)}`;
        return `${n.operator}${jsExpr(n.argument)}`;
      case 'UpdateExpression': return `${jsExpr(n.argument)}${n.operator}`;
      case 'CallExpression': {
        const name = jsExpr(n.callee);
        const args = n.arguments.map(jsExpr);
        if (API_TEXT[name]) return API_TEXT[name](args);
        if (name.endsWith('.includes')) return `${name.slice(0, -9)} contains ${args[0]}`;
        return `${name}(${args.join(', ')})`;
      }
      case 'ArrayExpression': return `[${n.elements.map(jsExpr).join(', ')}]`;
      case 'ObjectExpression': return '{…}';
      case 'ConditionalExpression': return `(${jsExpr(n.consequent)} IF ${jsExpr(n.test)} ELSE ${jsExpr(n.alternate)})`;
      case 'AssignmentExpression': return `${jsExpr(n.left)} ${n.operator} ${jsExpr(n.right)}`;
      case 'ArrowFunctionExpression':
      case 'FunctionExpression': return 'function';
      default: return '…';
    }
  }
  function jsExprP(n) {
    const s = jsExpr(n);
    return (n.type === 'LogicalExpression' || n.type === 'ConditionalExpression') ? `(${s})` : s;
  }

  function jsBlock(body) {
    const out = [];
    (Array.isArray(body) ? body : [body]).forEach(st => jsStmt(st, out));
    return out;
  }
  function jsBody(st) {
    if (!st) return seq([]);
    return seq(st.type === 'BlockStatement' ? jsBlock(st.body) : jsBlock([st]));
  }

  function jsStmt(st, out) {
    switch (st.type) {
      case 'ExpressionStatement': {
        let e = st.expression;
        if (e.type === 'AwaitExpression') e = e.argument;
        if (e.type === 'CallExpression') {
          const name = jsExpr(e.callee);
          out.push({ kind: 'stmt', text: callText(name, e.arguments.map(jsExpr)), io: ioFor(name) });
        } else if (e.type === 'AssignmentExpression') {
          out.push(jsAssign(jsExpr(e.left), e.operator, e.right));
        } else if (e.type === 'UpdateExpression') {
          const v = jsExpr(e.argument);
          out.push({ kind: 'stmt', text: e.operator === '++' ? `ADD 1 TO ${v}` : `SUBTRACT 1 FROM ${v}` });
        } else {
          out.push({ kind: 'stmt', text: jsExpr(e) });
        }
        break;
      }
      case 'VariableDeclaration':
        st.declarations.forEach(d => {
          if (d.init) out.push(jsAssign(jsExpr(d.id), '=', d.init));
          else out.push({ kind: 'stmt', text: `CREATE ${jsExpr(d.id)}` });
        });
        break;
      case 'IfStatement':
        out.push({
          kind: 'if', cond: jsExpr(st.test), then: jsBody(st.consequent),
          else: st.alternate ? jsBody(st.alternate) : null
        });
        break;
      case 'WhileStatement':
        out.push({ kind: 'loop', loopType: 'while', head: jsExpr(st.test), body: jsBody(st.body) });
        break;
      case 'DoWhileStatement':
        out.push({ kind: 'loop', loopType: 'while', head: jsExpr(st.test), body: jsBody(st.body), doWhile: true });
        break;
      case 'ForStatement': {
        // Recognise the common "for (let i = a; i < b; i++)" pattern.
        let head = null;
        try {
          const d = st.init && st.init.declarations ? st.init.declarations[0] : null;
          const v = d ? jsExpr(d.id) : null;
          if (v && st.test && st.test.type === 'BinaryExpression' && jsExpr(st.test.left) === v &&
              st.update && /\+\+|\+=/.test(st.update.operator || '')) {
            let end = jsExpr(st.test.right);
            if (st.test.operator === '<') end = /^\d+$/.test(end) ? String(+end - 1) : end + ' - 1';
            head = `${v} FROM ${jsExpr(d.init)} TO ${end}`;
          }
        } catch (e) { /* fall through */ }
        if (head) {
          out.push({ kind: 'loop', loopType: 'for', head, body: jsBody(st.body) });
        } else {
          if (st.init) jsStmt(st.init.type === 'VariableDeclaration' ? st.init : { type: 'ExpressionStatement', expression: st.init }, out);
          const body = jsBody(st.body);
          if (st.update) jsStmt({ type: 'ExpressionStatement', expression: st.update }, body.items);
          out.push({ kind: 'loop', loopType: 'while', head: st.test ? jsExpr(st.test) : 'true', body });
        }
        break;
      }
      case 'ForOfStatement':
      case 'ForInStatement': {
        const d = st.left.declarations ? st.left.declarations[0].id : st.left;
        out.push({ kind: 'loop', loopType: 'for', head: `EACH ${jsExpr(d)} IN ${jsExpr(st.right)}`, body: jsBody(st.body) });
        break;
      }
      case 'FunctionDeclaration':
        out.push({ kind: 'func', name: st.id.name, params: st.params.map(jsExpr), body: jsBody(st.body) });
        break;
      case 'ReturnStatement':
        out.push({ kind: 'return', text: st.argument ? jsExpr(st.argument) : '' });
        break;
      case 'BreakStatement': out.push({ kind: 'break' }); break;
      case 'ContinueStatement': out.push({ kind: 'continue' }); break;
      case 'BlockStatement': jsBlock(st.body).forEach(x => out.push(x)); break;
      case 'SwitchStatement': {
        // Turn a switch into a chain of IF / ELSE IF.
        const disc = jsExpr(st.discriminant);
        let root = null, cur = null, def = null;
        st.cases.forEach(c => {
          const body = seq(jsBlock(c.consequent.filter(x => x.type !== 'BreakStatement')));
          if (!c.test) { def = body; return; }
          const node = { kind: 'if', cond: `${disc} = ${jsExpr(c.test)}`, then: body, else: null };
          if (!root) root = node; else cur.else = seq([node]);
          cur = node;
        });
        if (root) { if (def) cur.else = def; out.push(root); }
        else if (def) def.items.forEach(x => out.push(x));
        break;
      }
      case 'EmptyStatement': break;
      default:
        out.push({ kind: 'stmt', text: st.type });
    }
  }

  function jsAssign(left, op, rightNode) {
    let right = rightNode;
    if (right && right.type === 'AwaitExpression') right = right.argument;
    if (right && right.type === 'CallExpression') {
      const name = jsExpr(right.callee);
      const io = ioFor(name);
      if (io === 'in') {
        const args = right.arguments.map(jsExpr);
        const choices = args.length > 1 ? ` (choices: ${args.slice(1).join(', ')})` : '';
        return { kind: 'stmt', io: 'in', text: `DISPLAY ${args[0] || '""'}${choices}\nINPUT ${left}` };
      }
    }
    const r = jsExpr(right);
    if (op === '+=') return { kind: 'stmt', text: `ADD ${r} TO ${left}` };
    if (op === '-=') return { kind: 'stmt', text: `SUBTRACT ${r} FROM ${left}` };
    if (op === '*=') return { kind: 'stmt', text: `MULTIPLY ${left} BY ${r}` };
    return { kind: 'stmt', text: `SET ${left} TO ${r}` };
  }

  /* ========================= Python (indent parser) ===================== */
  // A deliberately simple parser that understands the structure students
  // write (if/elif/else, while, for, def, return) using indentation.

  function pyToModel(code) {
    const lines = [];
    const raw = code.replace(/\t/g, '    ').split('\n');
    let pending = '';
    let pendingIndent = 0;
    let depth = 0;
    raw.forEach(line => {
      const noComment = stripPyComment(line);
      if (!noComment.trim() && !pending) return;
      if (!pending) pendingIndent = noComment.match(/^ */)[0].length;
      pending += (pending ? ' ' : '') + noComment.trim();
      depth += bracketDelta(noComment);
      if (depth <= 0) {
        lines.push({ indent: pendingIndent, text: pending });
        pending = ''; depth = 0;
      }
    });
    if (pending) lines.push({ indent: pendingIndent, text: pending });
    const pos = { i: 0 };
    const items = pyBlock(lines, pos, lines.length ? lines[0].indent : 0);
    return seq(items);
  }

  function stripPyComment(line) {
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === inStr) inStr = null;
      } else if (c === '"' || c === "'") inStr = c;
      else if (c === '#') return line.slice(0, i);
    }
    return line;
  }
  function bracketDelta(line) {
    let d = 0, inStr = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") inStr = c;
      else if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) d--;
    }
    return d;
  }

  function pyBlock(lines, pos, indent) {
    const out = [];
    while (pos.i < lines.length && lines[pos.i].indent >= indent) {
      const ln = lines[pos.i];
      if (ln.indent > indent) { // unexpected indent: treat as part of block
        out.push(...pyBlock(lines, pos, ln.indent));
        continue;
      }
      pos.i++;
      pyLine(ln.text, lines, pos, indent, out);
    }
    return out;
  }

  // Handles "if x: say('hi')" one-liners as well as indented blocks.
  function pySuite(header, lines, pos, indent) {
    const idx = findColon(header);
    const inline = header.slice(idx + 1).trim();
    if (inline) {
      const out = [];
      inline.split(';').forEach(p => p.trim() && pyLine(p.trim(), lines, pos, indent, out));
      return seq(out);
    }
    if (pos.i < lines.length && lines[pos.i].indent > indent) {
      return seq(pyBlock(lines, pos, lines[pos.i].indent));
    }
    return seq([]);
  }
  function findColon(s) {
    let d = 0, inStr = null, last = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") inStr = c;
      else if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) d--;
      else if (c === ':' && d === 0) { last = i; break; }
    }
    return last;
  }
  function headerExpr(header, keyword) {
    const idx = findColon(header);
    return header.slice(keyword.length, idx < 0 ? undefined : idx).trim();
  }

  function pyLine(text, lines, pos, indent, out) {
    let m;
    if (/^if\b/.test(text)) {
      const node = { kind: 'if', cond: pyExpr(headerExpr(text, 'if')), then: pySuite(text, lines, pos, indent), else: null };
      out.push(node);
      let cur = node;
      while (pos.i < lines.length && lines[pos.i].indent === indent) {
        const t = lines[pos.i].text;
        if (/^elif\b/.test(t)) {
          pos.i++;
          const n2 = { kind: 'if', cond: pyExpr(headerExpr(t, 'elif')), then: pySuite(t, lines, pos, indent), else: null };
          cur.else = seq([n2]);
          cur = n2;
        } else if (/^else\s*:/.test(t)) {
          pos.i++;
          cur.else = pySuite(t, lines, pos, indent);
          break;
        } else break;
      }
      return;
    }
    if (/^while\b/.test(text)) {
      out.push({ kind: 'loop', loopType: 'while', head: pyExpr(headerExpr(text, 'while')), body: pySuite(text, lines, pos, indent) });
      return;
    }
    if ((m = text.match(/^for\s+(.+?)\s+in\s+(.+?)\s*:/))) {
      const v = m[1], it = m[2];
      let head;
      const r = it.match(/^range\((.*)\)$/);
      if (r) {
        const a = splitArgs(r[1]).map(pyExpr);
        const minus1 = x => /^-?\d+$/.test(x) ? String(+x - 1) : x + ' - 1';
        if (a.length === 1) head = `${v} FROM 0 TO ${minus1(a[0])}`;
        else head = `${v} FROM ${a[0]} TO ${minus1(a[1])}${a[2] ? ' STEP ' + a[2] : ''}`;
      } else head = `EACH ${v} IN ${pyExpr(it)}`;
      out.push({ kind: 'loop', loopType: 'for', head, body: pySuite(text, lines, pos, indent) });
      return;
    }
    if ((m = text.match(/^(?:async\s+)?def\s+(\w+)\s*\((.*)\)\s*:/))) {
      out.push({ kind: 'func', name: m[1], params: splitArgs(m[2]).filter(Boolean), body: pySuite(text, lines, pos, indent) });
      return;
    }
    if (/^(else|elif)\b/.test(text)) { pySuite(text, lines, pos, indent); return; } // stray
    if (/^return\b/.test(text)) { out.push({ kind: 'return', text: pyExpr(text.slice(6).trim()) }); return; }
    if (text === 'break') { out.push({ kind: 'break' }); return; }
    if (text === 'continue') { out.push({ kind: 'continue' }); return; }
    if (text === 'pass') return;
    if (/^(import|from|global|nonlocal)\b/.test(text)) return;
    if (/^(try|except|finally|with)\b/.test(text)) {
      pySuite(text, lines, pos, indent).items.forEach(x => out.push(x));
      return;
    }
    // Augmented assignment
    if ((m = text.match(/^([\w.\[\]"']+)\s*(\+|-|\*|\/)=\s*(.+)$/))) {
      const l = m[1], r = pyExpr(m[3]);
      const t = { '+': `ADD ${r} TO ${l}`, '-': `SUBTRACT ${r} FROM ${l}`, '*': `MULTIPLY ${l} BY ${r}`, '/': `DIVIDE ${l} BY ${r}` }[m[2]];
      out.push({ kind: 'stmt', text: t });
      return;
    }
    // Assignment (but not ==)
    if ((m = text.match(/^([\w.\[\]"', ]+?)\s*=(?!=)\s*(.+)$/))) {
      const left = m[1].trim(), right = m[2].trim();
      const call = parseCall(right);
      if (call && ioFor(call.name) === 'in') {
        const args = call.args.map(pyExpr);
        const choices = args.length > 1 ? ` (choices: ${args.slice(1).join(', ')})` : '';
        out.push({ kind: 'stmt', io: 'in', text: `DISPLAY ${args[0] || '""'}${choices}\nINPUT ${left}` });
      } else {
        out.push({ kind: 'stmt', text: `SET ${left} TO ${pyExpr(right)}` });
      }
      return;
    }
    const call = parseCall(text);
    if (call) {
      out.push({ kind: 'stmt', text: callText(call.name, call.args.map(pyExpr)), io: ioFor(call.name) });
      return;
    }
    out.push({ kind: 'stmt', text: pyExpr(text) });
  }

  function parseCall(s) {
    const m = s.match(/^([A-Za-z_][\w.]*)\s*\((.*)\)$/);
    if (!m) return null;
    // make sure the final ) closes the first (
    if (bracketDelta(m[2]) !== 0) return null;
    return { name: m[1], args: splitArgs(m[2]) };
  }
  function splitArgs(s) {
    const out = [];
    let d = 0, inStr = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) { cur += c; if (c === '\\') { cur += s[++i] || ''; } else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
      if ('([{'.includes(c)) d++;
      if (')]}'.includes(c)) d--;
      if (c === ',' && d === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function pyExpr(s) {
    s = (s || '').trim();
    // f-strings -> "text " + var
    s = s.replace(/\bf(["'])(.*?)\1/g, (all, q, body) => {
      const parts = body.split(/(\{[^}]*\})/).filter(Boolean)
        .map(p => p[0] === '{' ? p.slice(1, -1) : JSON.stringify(p));
      return parts.join(' + ');
    });
    // Replace whole-call API helpers inside expressions (e.g. if has_item("key"))
    s = s.replace(/\b([A-Za-z_][\w.]*)\(([^()]*)\)/g, (all, name, args) => {
      if (API_TEXT[name]) return API_TEXT[name](splitArgs(args));
      return all;
    });
    // Only change operators/keywords outside of string literals.
    return s.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/).map((part, i) => i % 2 ? part : part
      .replace(/\s*==\s*/g, ' = ')
      .replace(/\s*!=\s*/g, ' ≠ ')
      .replace(/\s*<=\s*/g, ' ≤ ')
      .replace(/\s*>=\s*/g, ' ≥ ')
      .replace(/\band\b/g, 'AND').replace(/\bor\b/g, 'OR').replace(/\bnot\b/g, 'NOT').replace(/\bin\b/g, 'IN')
      .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'nothing')
    ).join('');
  }

  /* =========================== Pseudocode =============================== */
  function toPseudocode(model, title) {
    const lines = [];
    const pad = n => '    '.repeat(n);
    const funcs = model.items.filter(x => x.kind === 'func');
    const main = model.items.filter(x => x.kind !== 'func');

    function emit(node, d) {
      switch (node.kind) {
        case 'seq': node.items.forEach(x => emit(x, d)); break;
        case 'stmt': node.text.split('\n').forEach(t => lines.push(pad(d) + t)); break;
        case 'if': {
          lines.push(pad(d) + `IF ${node.cond} THEN`);
          emit(node.then, d + 1);
          let e = node.else;
          while (e && e.items.length === 1 && e.items[0].kind === 'if') {
            const n = e.items[0];
            lines.push(pad(d) + `ELSE IF ${n.cond} THEN`);
            emit(n.then, d + 1);
            e = n.else;
          }
          if (e && e.items.length) { lines.push(pad(d) + 'ELSE'); emit(e, d + 1); }
          lines.push(pad(d) + 'ENDIF');
          break;
        }
        case 'loop':
          if (node.doWhile) {
            lines.push(pad(d) + 'REPEAT');
            emit(node.body, d + 1);
            lines.push(pad(d) + `UNTIL NOT (${node.head})`);
          } else if (node.loopType === 'for') {
            lines.push(pad(d) + `FOR ${node.head}`);
            emit(node.body, d + 1);
            lines.push(pad(d) + 'NEXT');
          } else {
            lines.push(pad(d) + `WHILE ${node.head}`);
            emit(node.body, d + 1);
            lines.push(pad(d) + 'ENDWHILE');
          }
          break;
        case 'return': lines.push(pad(d) + `RETURN ${node.text}`.trimEnd()); break;
        case 'break': lines.push(pad(d) + 'EXIT LOOP'); break;
        case 'continue': lines.push(pad(d) + 'SKIP TO NEXT LOOP'); break;
        case 'func':
          lines.push(pad(d) + `FUNCTION ${node.name}(${node.params.join(', ')})`);
          emit(node.body, d + 1);
          lines.push(pad(d) + `ENDFUNCTION`);
          break;
      }
    }
    lines.push(`BEGIN ${title || ''}`.trimEnd());
    main.forEach(n => emit(n, 1));
    lines.push('END');
    funcs.forEach(f => { lines.push(''); emit(f, 0); });
    return lines.join('\n');
  }

  function parse(code, lang) {
    return lang === 'py' ? pyToModel(code) : jsToModel(code);
  }

  RPG.codeModel = { parse, toPseudocode, jsToModel, pyToModel };
})(window.RPG);
