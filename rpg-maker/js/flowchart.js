/* Draws the program model from codeModel.js as an SVG flowchart using
 * standard symbols: terminator (start/end), process (rectangle),
 * input/output (parallelogram) and decision (diamond). */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';

  const LH = 15;          // line height
  const CW = 6.9;         // approx char width at 12px
  const VGAP = 22;        // vertical gap between shapes
  const WRAP = 28;        // characters per line
  const COLORS = {
    stroke: '#334155', text: '#0f172a', line: '#475569',
    term: '#fde68a', proc: '#dbeafe', io: '#dcfce7', dec: '#fce7f3', func: '#ede9fe'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function wrap(text) {
    const out = [];
    String(text).split('\n').forEach(para => {
      const words = para.split(' ');
      let cur = '';
      words.forEach(w => {
        while (w.length > WRAP) { // hard-break very long words
          if (cur) { out.push(cur); cur = ''; }
          out.push(w.slice(0, WRAP)); w = w.slice(WRAP);
        }
        if ((cur + ' ' + w).trim().length > WRAP) { out.push(cur); cur = w; }
        else cur = (cur ? cur + ' ' : '') + w;
      });
      out.push(cur);
    });
    return out;
  }
  function textBlock(lines, cx, cy) {
    const top = cy - (lines.length - 1) * LH / 2;
    return lines.map((l, i) =>
      `<text x="${cx}" y="${top + i * LH}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-family="ui-monospace,Menlo,Consolas,monospace" fill="${COLORS.text}">${esc(l)}</text>`
    ).join('');
  }
  function line(pts, arrow) {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    return `<path d="${d}" fill="none" stroke="${COLORS.line}" stroke-width="1.5"${arrow ? ' marker-end="url(#fc-arrow)"' : ''}/>`;
  }
  function label(x, y, t, anchor) {
    return `<text x="${x}" y="${y}" font-size="11" font-weight="600" font-family="system-ui,sans-serif" fill="#64748b" text-anchor="${anchor || 'start'}">${t}</text>`;
  }
  function textWidth(lines) { return Math.max(...lines.map(l => l.length)) * CW; }

  /* Every layout returns {w, h, cx, draw(x, y) -> svg string}.
     Entry point is (x+cx, y), exit point is (x+cx, y+h). */

  function shape(kind, text) {
    const lines = wrap(text);
    const tw = textWidth(lines);
    let w = Math.max(110, tw + 28), h = lines.length * LH + 18;
    if (kind === 'io') w += 24;
    if (kind === 'term') h = Math.max(h, 34);
    return {
      w, h, cx: w / 2,
      draw(x, y) {
        let s;
        const fill = COLORS[kind] || COLORS.proc;
        if (kind === 'term') s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${COLORS.stroke}" stroke-width="1.5"/>`;
        else if (kind === 'io') {
          const k = 12;
          s = `<polygon points="${x + k},${y} ${x + w},${y} ${x + w - k},${y + h} ${x},${y + h}" fill="${fill}" stroke="${COLORS.stroke}" stroke-width="1.5"/>`;
        } else if (kind === 'func') s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${COLORS.stroke}" stroke-width="1.5"/><line x1="${x + 7}" y1="${y}" x2="${x + 7}" y2="${y + h}" stroke="${COLORS.stroke}"/><line x1="${x + w - 7}" y1="${y}" x2="${x + w - 7}" y2="${y + h}" stroke="${COLORS.stroke}"/>`;
        else s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${COLORS.stroke}" stroke-width="1.5"/>`;
        return s + textBlock(lines, x + w / 2, y + h / 2);
      }
    };
  }

  function diamond(text) {
    const lines = wrap(text);
    const tw = textWidth(lines);
    const w = Math.max(120, tw * 1.35 + 36), h = Math.max(54, lines.length * LH * 1.5 + 26);
    return {
      w, h, cx: w / 2,
      draw(x, y) {
        const c = x + w / 2, m = y + h / 2;
        return `<polygon points="${c},${y} ${x + w},${m} ${c},${y + h} ${x},${m}" fill="${COLORS.dec}" stroke="${COLORS.stroke}" stroke-width="1.5"/>` +
          textBlock(lines, c, m);
      }
    };
  }

  function empty() { return { w: 40, h: 0, cx: 20, draw: () => '' }; }

  function layoutSeq(items) {
    const parts = items.map(layoutNode).filter(Boolean);
    if (!parts.length) return empty();
    const cx = Math.max(...parts.map(p => p.cx));
    const right = Math.max(...parts.map(p => p.w - p.cx));
    let h = 0;
    parts.forEach((p, i) => { h += p.h + (i ? VGAP : 0); });
    return {
      w: cx + right, h, cx,
      draw(x, y) {
        let s = '', yy = y;
        parts.forEach((p, i) => {
          if (i) { s += line([[x + cx, yy], [x + cx, yy + VGAP]], true); yy += VGAP; }
          s += p.draw(x + cx - p.cx, yy);
          yy += p.h;
        });
        return s;
      }
    };
  }

  function layoutIf(node) {
    const d = diamond(node.cond + '?');
    const T = layoutSeq(node.then.items);
    const E = node.else ? layoutSeq(node.else.items) : empty();
    let gap = 30;
    const need = d.w + 24;
    const between = (T.w - T.cx) + gap + E.cx;
    if (between < need) gap += need - between;
    const tcol = T.cx, ecol = T.w + gap + E.cx;
    const cx0 = (tcol + ecol) / 2;
    // make sure the diamond fits on the left
    const shift = Math.max(0, d.w / 2 - cx0 + 4);
    const w = Math.max(T.w + gap + E.w, cx0 + d.w / 2) + shift;
    const branchTop = d.h / 2 + 26;
    const bh = Math.max(T.h, E.h);
    const h = branchTop + bh + 18;
    const cx = cx0 + shift;
    return {
      w, h, cx,
      draw(x, y) {
        const ox = x + shift;
        let s = d.draw(x + cx - d.w / 2, y);
        const my = y + d.h / 2;
        const tx = ox + tcol, ex = ox + ecol;
        s += line([[x + cx - d.w / 2, my], [tx, my], [tx, y + branchTop]], T.h > 0);
        s += line([[x + cx + d.w / 2, my], [ex, my], [ex, y + branchTop]], E.h > 0);
        s += label(x + cx - d.w / 2 - 4, my - 6, 'Yes', 'end');
        s += label(x + cx + d.w / 2 + 4, my - 6, 'No');
        s += T.draw(ox, y + branchTop);
        s += E.draw(ox + T.w + gap, y + branchTop);
        const mergeY = y + h;
        s += line([[tx, y + branchTop + T.h], [tx, mergeY - 8], [x + cx, mergeY - 8]]);
        s += line([[ex, y + branchTop + E.h], [ex, mergeY - 8], [x + cx, mergeY - 8]]);
        s += line([[x + cx, mergeY - 8], [x + cx, mergeY]]);
        s += `<circle cx="${x + cx}" cy="${mergeY - 8}" r="3" fill="${COLORS.line}"/>`;
        return s;
      }
    };
  }

  function layoutLoop(node) {
    const text = node.loopType === 'for' ? `FOR ${node.head}` : `${node.head}?`;
    const d = diamond(text);
    const B = layoutSeq(node.body.items);
    const side = 26;
    const innerW = Math.max(B.w, d.w);
    const cxIn = Math.max(B.cx, d.w / 2);
    const rightIn = Math.max(B.w - B.cx, d.w / 2);
    const w = cxIn + rightIn + side * 2;
    const cx = side + cxIn;
    const bodyTop = d.h + VGAP;
    const h = bodyTop + B.h + 30;
    return {
      w, h, cx,
      draw(x, y) {
        const c = x + cx;
        let s = d.draw(c - d.w / 2, y);
        const my = y + d.h / 2;
        s += line([[c, y + d.h], [c, y + bodyTop]], B.h > 0);
        s += label(c + 5, y + d.h + 13, node.loopType === 'for' ? 'Next' : 'Yes');
        s += B.draw(c - B.cx, y + bodyTop);
        // loop back on the left
        const by = y + bodyTop + B.h;
        const lx = x + 6;
        s += line([[c, by], [c, by + 10], [lx, by + 10], [lx, my], [c - d.w / 2, my]], true);
        // exit on the right
        const rx = x + w - 6;
        s += line([[c + d.w / 2, my], [rx, my], [rx, y + h - 6], [c, y + h - 6], [c, y + h]]);
        s += label(c + d.w / 2 + 4, my - 6, node.loopType === 'for' ? 'Done' : 'No');
        return s;
      }
    };
  }

  function layoutNode(n) {
    switch (n.kind) {
      case 'stmt': return shape(n.io ? 'io' : 'proc', n.text);
      case 'if': return layoutIf(n);
      case 'loop': return layoutLoop(n);
      case 'return': return shape('term', ('RETURN ' + n.text).trim());
      case 'break': return shape('proc', 'EXIT LOOP');
      case 'continue': return shape('proc', 'SKIP TO NEXT LOOP');
      case 'func': return shape('func', `CALL ${n.name}(${n.params.join(', ')})`);
      case 'seq': return layoutSeq(n.items);
      case '__shape': return n.layout;
    }
    return null;
  }

  // Calls to user functions become "predefined process" boxes.
  function markCalls(items, names) {
    return items.map(n => {
      if (n.kind === 'stmt') {
        const m = n.text.match(/^CALL (\w+)\(/);
        if (m && names.includes(m[1])) return { kind: 'func', name: m[1], params: [n.text.slice(m[0].length, -1)] };
        return n;
      }
      if (n.kind === 'if') return Object.assign({}, n, { then: { kind: 'seq', items: markCalls(n.then.items, names) }, else: n.else ? { kind: 'seq', items: markCalls(n.else.items, names) } : null });
      if (n.kind === 'loop') return Object.assign({}, n, { body: { kind: 'seq', items: markCalls(n.body.items, names) } });
      return n;
    });
  }

  function render(model, title) {
    const funcs = model.items.filter(x => x.kind === 'func');
    const names = funcs.map(f => f.name);
    const charts = [];
    const build = (start, items, end) => {
      const all = [shapeNode('term', start), ...markCalls(items, names), shapeNode('term', end)];
      return layoutSeq(all);
    };
    charts.push(build(`START ${title || ''}`.trim(), model.items.filter(x => x.kind !== 'func'), 'END'));
    funcs.forEach(f => charts.push(build(`FUNCTION ${f.name}(${f.params.join(', ')})`, f.body.items, 'RETURN')));

    const pad = 20, hgap = 50;
    let W = pad, H = 0;
    charts.forEach(c => { W += c.w + hgap; H = Math.max(H, c.h); });
    W = W - hgap + pad; H += pad * 2;
    let body = '', x = pad;
    charts.forEach(c => { body += c.draw(x, pad); x += c.w + hgap; });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(W)}" height="${Math.ceil(H)}" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(H)}">` +
      `<defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${COLORS.line}"/></marker></defs>` +
      `<rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`;
  }

  function shapeNode(kind, text) { return { kind: '__shape', layout: shape(kind, text) }; }

  RPG.flowchart = { render };
})(window.RPG);
