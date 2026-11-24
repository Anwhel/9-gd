# Quest Studio

A browser-based top-down RPG maker for students. Draw your own tiles and characters, build maps, and program events in **JavaScript or Python**. Every script is turned into **pseudocode** and a **flowchart** automatically.

Open `index.html` through any web server (for example GitHub Pages at `https://anwhel.github.io/9-gd/rpg-maker/`). Everything runs in the browser and there is no server-side code. All libraries are in `vendor/`, so it works without CDN access.

## Features

| Area | What students can do |
| --- | --- |
| 🗺️ **Map** | Paint tiles on a Ground layer and a Top layer (trees, furniture), fill, draw boxes, undo/redo, have more than one map, resize maps, set the player start, and place characters and objects. |
| 🎨 **Art** | Use a 16×16 pixel editor with pencil, eraser, fill, line, rectangle and colour picker. It also has mirror drawing, flip/shift, a custom palette, animation frames with onion skin, PNG import/export, and a *solid* setting for tiles. |
| 📜 **Scripts** | Each character has *When talked to* and *When touched* events. Each map has *When entered*, and the game has *When the game starts*. Students can choose JavaScript or Python for each script. A command reference inserts snippets. |
| 🧠 **Pseudocode / flowchart** | These update live as students type, using standard flowchart symbols (terminator, process, input/output, decision). They can be copied, or saved as `.txt` / `.png` for assessment portfolios. |
| ▶ **Play** | Movement uses arrow keys / WASD and Space talks. The game has dialogue, choices, typed answers, hearts, score, an inventory, sounds, and win/lose screens. Script errors are shown with line numbers. |
| 💾 **Saving** | Projects autosave to the browser (localStorage). **Export** downloads a `.quest.json` file, and **Import** opens it on another device. |

## Script commands

Both naming styles work in both languages (`giveItem` / `give_item`).

```
say(text)                      ask(question, choice1, choice2, ...)   ask(question)
askNumber(question)            wait(seconds)                          print(...)
giveItem(name)  takeItem(name) hasItem(name)  itemCount(name)
setVar(name, value)            getVar(name)
changeHealth(n) getHealth()    addScore(n)    getScore()
goToMap(map, x, y)             teleport(x, y) movePlayer(dx, dy)
moveSelf(dx, dy)               moveEntity(name, dx, dy)
hide() show()                  hideEntity(name) showEntity(name)
setTile(x, y, tile)            getTile(x, y)
playSound(name)  # coin, open, hit, hurt, win, lose, talk, magic, step
random(a, b)     win(message)  lose(message)
```

Commands like `say` and `ask` wait for the player. Students don't need `async` or `await`, because the engine adds them to JavaScript automatically. Python runs in [Skulpt](https://skulpt.org). Runaway loops are stopped after a few seconds with a friendly message.

Variables reset each time a script runs. To remember something between events, use `setVar` / `getVar`.

## Files

```
index.html        app layout
css/style.css     styles
js/defaults.js    starter art + example quest
js/storage.js     browser saving, export/import
js/art.js         pixel → canvas cache
js/mapEditor.js   map editor
js/artEditor.js   pixel editor
js/scriptEditor.js code editor + live views
js/codeModel.js   JS/Python → program model → pseudocode
js/flowchart.js   program model → SVG flowchart
js/runtime.js     game engine and script runner
vendor/           CodeMirror 5, Acorn, Skulpt (with licences)
```
