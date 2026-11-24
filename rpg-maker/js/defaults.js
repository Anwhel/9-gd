/* Starter palette, art and example project. */
window.RPG = window.RPG || {};
(function (RPG) {
  'use strict';

  const N = 16; // sprite size in pixels

  const PAL = {
    k: '#1a1c2c', n: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75',
    l: '#a7f070', g: '#38b764', G: '#257179', b: '#3b5dc9', B: '#41a6f6',
    c: '#73eff7', w: '#f4f4f4', s: '#94b0c2', S: '#566c86', d: '#333c57',
    m: '#8b5a2b', M: '#5c3a1a', p: '#f2c69b'
  };
  RPG.DEFAULT_PALETTE = Object.values(PAL);

  function fromRows(rows) {
    const px = [];
    for (let y = 0; y < N; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < N; x++) {
        const ch = row[x] || '.';
        px.push(ch === '.' ? '' : (PAL[ch] || ''));
      }
    }
    return px;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function gen(fn, seed) {
    const r = rng(seed || 1);
    const px = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) px.push(fn(x, y, r) || '');
    return px;
  }

  const grass = gen((x, y, r) => { const v = r(); return v < 0.08 ? PAL.l : v < 0.16 ? PAL.G : PAL.g; }, 7);
  const flowers = gen((x, y, r) => {
    const spots = [[3, 4], [10, 2], [12, 10], [5, 12], [8, 7]];
    for (const [fx, fy] of spots) {
      if (x === fx && y === fy) return PAL.y;
      if (Math.abs(x - fx) + Math.abs(y - fy) === 1) return (fx + fy) % 2 ? PAL.r : PAL.w;
    }
    const v = r(); return v < 0.08 ? PAL.l : PAL.g;
  }, 9);
  const path = gen((x, y, r) => { const v = r(); return v < 0.1 ? PAL.m : v < 0.18 ? PAL.s : PAL.y; }, 3);
  const water1 = gen((x, y) => ((x + y * 2) % 9 === 0 || (x * 3 + y) % 13 === 0) ? PAL.B : ((y % 6 === 2 && x % 7 < 3) ? PAL.c : PAL.b), 1);
  const water2 = gen((x, y) => ((x + 3 + y * 2) % 9 === 0 || (x * 3 + y + 5) % 13 === 0) ? PAL.B : ((y % 6 === 2 && (x + 3) % 7 < 3) ? PAL.c : PAL.b), 1);
  const wall = gen((x, y) => {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) return PAL.d;
    return y % 4 === 0 ? PAL.s : PAL.S;
  }, 1);
  const floor = gen((x, y) => (y % 4 === 3) ? PAL.M : ((x + (Math.floor(y / 4) * 5)) % 12 === 0 ? PAL.M : PAL.m), 1);

  const tree = fromRows([
    '................',
    '.....GGGGGG.....',
    '...GGggggggGG...',
    '..GggglggggggG..',
    '..GgglllgggggG..',
    '.GgggllggggglgG.',
    '.GggggggggglllG.',
    '.GgggggggggglgG.',
    '..GggggglggggG..',
    '..GGgggllgggGG..',
    '....GGGgggGG....',
    '......MMMM......',
    '......MmmM......',
    '......MmmM......',
    '.....MMmmMM.....',
    '................'
  ]);

  const heroTop = [
    '................',
    '.....MMMMMM.....',
    '....MMMMMMMM....',
    '....MppppppM....',
    '....pkppppkp....',
    '....pppppppp....',
    '.....pprrpp.....',
    '....bbbbbbbb....',
    '...pbbbbbbbbp...',
    '...pbbbyybbbp...',
    '...pbbbbbbbbp...',
    '....bbbbbbbb....'
  ];
  const hero1 = fromRows(heroTop.concat(['....dd....dd....', '....dd....dd....', '...MMM....MMM...', '................']));
  const hero2 = fromRows(heroTop.concat(['.....dd..dd.....', '.....dd..dd.....', '....MMM..MMM....', '................']));

  const sage = fromRows([
    '................',
    '......nnnn......',
    '.....nnnnnn.....',
    '....nnnnnnnn....',
    '.....pppppp.....',
    '.....kppppk.....',
    '.....pwwwwp.....',
    '.....wwwwww.....',
    '....nnwwwwnn....',
    '...pnnnwwnnnp...',
    '...pnnnnnnnnp...',
    '....nnnnnnnn....',
    '....nnnnnnnn....',
    '....nnnnnnnn....',
    '....MM....MM....',
    '................'
  ]);
  const sage2 = sage.slice();
  // blink: close the eyes on frame two
  sage2[5 * N + 5] = PAL.p; sage2[5 * N + 10] = PAL.p;

  const chest = fromRows([
    '................',
    '................',
    '................',
    '..MMMMMMMMMMMM..',
    '.MmmmmmmmmmmmmM.',
    '.MmmmmmmmmmmmmM.',
    '.MyyyyyyyyyyyyM.',
    '.MmmmmmyymmmmmM.',
    '.MmmmmykkymmmmM.',
    '.MmmmmmyymmmmmM.',
    '.MmmmmmmmmmmmmM.',
    '.MmmmmmmmmmmmmM.',
    '.MyyyyyyyyyyyyM.',
    '.MMMMMMMMMMMMMM.',
    '................',
    '................'
  ]);
  const key = fromRows([
    '................',
    '................',
    '................',
    '................',
    '................',
    '....yyy.........',
    '...yo.oy........',
    '...y...yyyyyyyy.',
    '...yo.oy...y.y..',
    '....yyy....y.y..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
  ]);
  const key2 = key.map((c, i) => (c && (i % N) % 4 === 1) ? PAL.w : c);
  const door = gen((x, y) => {
    if (x === 0 || x === 15 || y === 0) return PAL.S;
    if (x === 1 || x === 14 || y === 1) return PAL.M;
    if (x === 11 && (y === 8 || y === 9)) return PAL.y;
    return x % 4 === 1 ? PAL.M : PAL.m;
  }, 1);
  const slimeRows = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......gggg......',
    '....gglllggg....',
    '...gglwlgggggg..',
    '..ggglllggggggg.',
    '..gggkggggkgggg.',
    '..gggkggggkgggg.',
    '..gggggggggggg..',
    '..ggggrrrrgggg..',
    '...GGGGGGGGGG...',
    '................',
    '................'
  ];
  const slime1 = fromRows(slimeRows);
  const slime2 = fromRows(['................'].concat(slimeRows.slice(0, 13).map((r, i) => i === 12 ? '..gggggggggggg..' : r)).concat(['...GGGGGGGGGG...', '................']));

  function asset(id, name, kind, frames, extra) {
    return Object.assign({ id, name, kind, frames, fps: 3, solid: false }, extra || {});
  }

  const S = (lang, code) => ({ lang, code: code.replace(/^\n/, '') });

  function makeStarterProject() {
    const assets = {};
    [
      asset('grass', 'Grass', 'tile', [grass]),
      asset('flowers', 'Flowers', 'tile', [flowers]),
      asset('path', 'Path', 'tile', [path]),
      asset('water', 'Water', 'tile', [water1, water2], { solid: true, fps: 2 }),
      asset('wall', 'Stone Wall', 'tile', [wall], { solid: true }),
      asset('floor', 'Wood Floor', 'tile', [floor]),
      asset('tree', 'Tree', 'tile', [tree], { solid: true }),
      asset('hero', 'Hero', 'sprite', [hero1, hero2], { fps: 6 }),
      asset('sage', 'Sage', 'sprite', [sage, sage, sage, sage2], { fps: 2 }),
      asset('chest', 'Chest', 'sprite', [chest]),
      asset('key', 'Key', 'sprite', [key, key2], { fps: 2 }),
      asset('door', 'Door', 'sprite', [door]),
      asset('slime', 'Slime', 'sprite', [slime1, slime2], { fps: 3 })
    ].forEach(a => { assets[a.id] = a; });

    const layout = [
      'TTTTTTTTTTTTTTTTTTTT',
      'T.......f........TTT',
      'T..~~~......PPPP...T',
      'T.~~~~~.....P..P...T',
      'T..~~~......P..P...T',
      'T...........P..P...T',
      'TPPPPPPPPPPPP..PPPPT',
      'T.....f.......WWWWWT',
      'T.............W===WT',
      'T....f........W===WT',
      'T.............WW=WWT',
      'T..T..........P....T',
      'T.......f.....P....T',
      'T.............P....T',
      'TTTTTTTTTTTTTTTTTTTT'
    ];
    const W = 20, H = 15;
    const ground = [], detail = [];
    const gmap = { '.': 'grass', T: 'grass', f: 'flowers', '~': 'water', P: 'path', W: 'wall', '=': 'floor' };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = layout[y][x];
      ground.push(gmap[ch] || 'grass');
      detail.push(ch === 'T' ? 'tree' : null);
    }

    const entities = [
      {
        id: 'e1', name: 'Sage', sprite: 'sage', x: 9, y: 7, solid: true, visible: true,
        scripts: {
          interact: S('js', `
// The Sage gives the player a quest.
if (hasItem("Key")) {
  say("You found my key! Use it on the door of my house.");
} else {
  let answer = ask("Will you help me find my lost key?", "Yes", "No");
  if (answer == "Yes") {
    say("Thank you! I think I dropped it near the pond.");
    setVar("quest", "started");
  } else {
    say("Oh... maybe another time.");
  }
}
`),
          touch: S('js', '')
        }
      },
      {
        id: 'e2', name: 'Key', sprite: 'key', x: 7, y: 3, solid: false, visible: true,
        scripts: {
          interact: S('py', ''),
          touch: S('py', `
# Runs when the player walks onto the key.
give_item("Key")
play_sound("coin")
say("You picked up a shiny key!")
hide()
`)
        }
      },
      {
        id: 'e3', name: 'Door', sprite: 'door', x: 16, y: 10, solid: true, visible: true,
        scripts: {
          interact: S('js', `
if (hasItem("Key")) {
  say("The door unlocks with a click!");
  takeItem("Key");
  playSound("open");
  hide();
} else {
  say("It's locked. Maybe the Sage knows where the key is.");
}
`),
          touch: S('js', '')
        }
      },
      {
        id: 'e4', name: 'Chest', sprite: 'chest', x: 16, y: 8, solid: true, visible: true,
        scripts: {
          interact: S('py', `
if get_var("chest_open"):
    say("The chest is empty.")
else:
    gold = random(5, 20)
    say(f"You found {gold} gold coins!")
    add_score(gold)
    set_var("chest_open", True)
    win("You found the Sage's treasure!")
`),
          touch: S('py', '')
        }
      },
      {
        id: 'e5', name: 'Slime', sprite: 'slime', x: 14, y: 12, solid: true, visible: true,
        scripts: {
          interact: S('py', `
slime_hp = 3
while slime_hp > 0:
    choice = ask("A slime blocks the way!", "Attack", "Run")
    if choice == "Attack":
        hit = random(1, 2)
        slime_hp -= hit
        say(f"You hit the slime for {hit} damage!")
    else:
        say("You ran away and the slime nibbles you!")
        change_health(-1)
        break

if slime_hp <= 0:
    say("The slime is defeated!")
    add_score(10)
    hide()
`),
          touch: S('py', '')
        }
      }
    ];

    return {
      format: 'quest-studio', version: 1,
      id: 'p' + Date.now().toString(36),
      name: 'My First Quest',
      palette: RPG.DEFAULT_PALETTE.slice(),
      assets,
      maps: [{
        id: 'm1', name: 'Village', width: W, height: H, ground, detail, entities,
        scripts: { enter: S('js', '') }
      }],
      player: { sprite: 'hero', map: 'm1', x: 2, y: 7, health: 5 },
      scripts: {
        start: S('js', `
say("Welcome to the village! Arrow keys / WASD to move, SPACE to talk.");
`)
      },
      updated: Date.now()
    };
  }

  function blankPixels() { return new Array(N * N).fill(''); }

  RPG.TILE = N;
  RPG.makeStarterProject = makeStarterProject;
  RPG.blankPixels = blankPixels;
})(window.RPG);
