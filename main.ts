// =====================================================================
//  GAME DESIGN LAB
//  A playable lesson about the basic ideas behind game design.
//
//  Six short experiments. In each one you play a tiny game, change
//  one design setting with the B button, and see how that one change
//  alters the whole experience.
//
//    1. The Core Loop       - the action you repeat again and again
//    2. Game Feel           - how controls feel (speed, acceleration, friction)
//    3. Challenge & Flow    - difficulty that is not too easy or too hard
//    4. Feedback & Juice    - telling the player what just happened
//    5. Risk & Reward       - interesting choices
//    6. Rules: Win & Lose   - goals and endings turn a toy into a game
//
//  Students: read the code! Each lesson is its own function below.
//  Look for the comments marked  >>> TRY THIS  for easy things to change.
// =====================================================================

namespace SpriteKind {
    export const Gem = SpriteKind.create()
    export const BigGem = SpriteKind.create()
}

// ---------------------------------------------------------------------
//  Shared state used by every lesson
// ---------------------------------------------------------------------
let roundOver = false      // set to true to finish the current round
let score = 0
let lives = 0              // 0 = this lesson does not use lives
let timeLeft = 0           // seconds left. 0 = no timer
let elapsed = 0            // seconds since the round started
let settingLabel = ""      // shown at the bottom of the screen
let showScore = true       // lesson 4 can hide the score
let scorePopUntil = 0      // lesson 4 makes the score "pop" when it changes
let invincibleUntil = 0    // short safe time after being hit
let player: Sprite = null
let onTimeUp: () => void = null
let completed: boolean[] = [false, false, false, false, false, false]

// Pictures. These all come from the built-in MakeCode gallery.
const PLAYER_IMG = sprites.castle.heroWalkFront1
const GEM_IMG = sprites.dungeon.collectibleBlueCrystal
const BIG_GEM_IMG = sprites.dungeon.collectibleRedCrystal
const COIN_IMG = sprites.builtin.coin0
const ROCK_IMG = sprites.space.spaceSmallAsteroid0
const BAT_IMG = sprites.builtin.forestBat0

// HUD layout: a bar at the top and a bar at the bottom of the screen
const TOP = 11
const BOTTOM = 108

// ---------------------------------------------------------------------
//  Helpers: text, menus and cards
// ---------------------------------------------------------------------

function printCentered(target: Image, text: string, y: number, color: number) {
    const x = Math.idiv(screen.width - text.length * 6, 2)
    target.print(text, x, y, color, image.font8)
}

function anyButtonDown(): boolean {
    return controller.A.isPressed() || controller.B.isPressed() ||
        controller.up.isPressed() || controller.down.isPressed()
}

// Show a list and let the player choose with UP / DOWN and A.
// Returns the number (index) of the chosen option.
function pickOption(title: string, hint: string, options: string[]): number {
    let choice = 0
    let chosen = false
    game.pushScene()
    scene.setBackgroundColor(12)
    scene.createRenderable(100, function (target: Image, camera: scene.Camera) {
        target.fillRect(0, 0, screen.width, 16, 15)
        printCentered(target, title, 4, 5)
        const top = Math.max(22, Math.idiv(BOTTOM - options.length * 12, 2) + 8)
        for (let i = 0; i < options.length; i++) {
            const y = top + i * 12
            if (i == choice) {
                target.fillRect(4, y - 2, screen.width - 8, 11, 5)
                target.print(">" + options[i], 8, y, 15, image.font8)
            } else {
                target.print(" " + options[i], 8, y, 1, image.font8)
            }
        }
        printCentered(target, hint, screen.height - 10, 11)
    })

    pauseUntil(() => !anyButtonDown())
    while (!chosen) {
        if (controller.up.isPressed()) {
            choice = (choice + options.length - 1) % options.length
            music.playTone(523, 30)
            pauseUntil(() => !controller.up.isPressed())
        } else if (controller.down.isPressed()) {
            choice = (choice + 1) % options.length
            music.playTone(523, 30)
            pauseUntil(() => !controller.down.isPressed())
        } else if (controller.A.isPressed()) {
            music.playTone(784, 60)
            pauseUntil(() => !controller.A.isPressed())
            chosen = true
        }
        pause(20)
    }
    game.popScene()
    return choice
}

// A full-screen page of text. A / DOWN scrolls, the last page closes it.
function card(heading: string, body: string) {
    game.showLongText(heading + "\n\n" + body, DialogLayout.Full)
}

// ---------------------------------------------------------------------
//  Helpers: running a round
// ---------------------------------------------------------------------

// Call at the start of every lesson round (after game.pushScene()).
function startRound(seconds: number, startLives: number) {
    roundOver = false
    score = 0
    lives = startLives
    timeLeft = seconds
    elapsed = 0
    settingLabel = ""
    showScore = true
    scorePopUntil = 0
    invincibleUntil = 0
    onTimeUp = null
    scene.setBackgroundColor(6)

    // The HUD (heads-up display) is drawn on top of everything.
    scene.createRenderable(200, function (target: Image, camera: scene.Camera) {
        target.fillRect(0, 0, screen.width, TOP, 15)
        if (showScore) {
            if (game.runtime() < scorePopUntil) {
                target.print("SCORE " + score, 2, 0, 5, image.scaledFont(image.font8, 2))
            } else {
                target.print("SCORE " + score, 2, 2, 1, image.font8)
            }
        }
        let right = ""
        if (timeLeft > 0) right = "TIME " + timeLeft
        if (lives > 0) right = right + "  LIVES " + lives
        target.print(right, screen.width - right.length * 6 - 2, 2, 1, image.font8)

        if (settingLabel != "") {
            target.fillRect(0, BOTTOM, screen.width, screen.height - BOTTOM, 15)
            printCentered(target, settingLabel, BOTTOM + 3, 5)
        }
    })

    // A clock that ticks once per second.
    game.onUpdateInterval(1000, function () {
        if (roundOver) return
        elapsed += 1
        if (timeLeft > 0) {
            timeLeft -= 1
            if (timeLeft == 0) {
                if (onTimeUp) onTimeUp()
                else roundOver = true
            }
        }
    })
}

function makePlayer(): Sprite {
    player = sprites.create(PLAYER_IMG, SpriteKind.Player)
    player.setPosition(80, 60)
    player.setStayInScreen(true)
    player.z = 10
    // Keep the player between the top and bottom HUD bars.
    game.onUpdate(function () {
        if (player.top < TOP) { player.top = TOP; player.vy = Math.max(0, player.vy) }
        if (player.bottom > BOTTOM) { player.bottom = BOTTOM; player.vy = Math.min(0, player.vy) }
    })
    return player
}

// Put a sprite somewhere random in the play area (between the HUD bars).
function placeRandomly(s: Sprite) {
    s.setPosition(randint(12, screen.width - 12), randint(TOP + 10, BOTTOM - 10))
}

function spawnGem(): Sprite {
    const g = sprites.create(GEM_IMG, SpriteKind.Gem)
    placeRandomly(g)
    return g
}

// Wait for the round to finish, then clean up the lesson's scene.
function waitForRoundEnd() {
    pauseUntil(() => roundOver)
    pause(300)
}

function isInvincible(): boolean {
    return game.runtime() < invincibleUntil
}

function hurtPlayer() {
    invincibleUntil = game.runtime() + 1500
    scene.cameraShake(3, 200)
    music.playTone(196, 150)
    player.startEffect(effects.ashes, 300)
}

// Make the player blink while invincible.
function blinkWhileInvincible() {
    game.onUpdate(function () {
        if (player) player.setFlag(SpriteFlag.Invisible,
            isInvincible() && Math.idiv(game.runtime(), 100) % 2 == 0)
    })
}

// Cycle a "B button" setting. Returns the new index.
function nextSetting(current: number, count: number): number {
    music.playTone(659, 50)
    return (current + 1) % count
}

// =====================================================================
//  LESSON 1: THE CORE LOOP
// =====================================================================
function lessonCoreLoop() {
    card("1. THE CORE LOOP",
        "Every game has a CORE LOOP: the main thing you do over and over.\n\n" +
        "In a racing game: steer, overtake, finish.\n" +
        "In Minecraft: gather, build, survive.\n\n" +
        "This game has a very small loop. Watch the bar at the bottom of the screen as you play.\n\n" +
        "Use the arrows to move. Grab as many gems as you can in 20 seconds.")

    game.pushScene()
    startRound(20, 0)
    makePlayer()
    controller.moveSprite(player, 100, 100)
    spawnGem()

    // The loop has 3 steps. We light up whichever step is happening now.
    const steps = ["MOVE", "GRAB", "SCORE"]
    let stepStart = 0
    let step = 0

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Gem, function (p, gem) {
        gem.destroy()
        music.playTone(988, 60)
        step = 1
        stepStart = game.runtime()
        // >>> TRY THIS: change how many points a gem is worth
        score += 1
        spawnGem()
    })

    game.onUpdate(function () {
        if (step == 1 && game.runtime() - stepStart > 250) step = 2
        if (step == 2 && game.runtime() - stepStart > 600) step = 0
    })

    // Draw the loop diagram:  MOVE > GRAB > SCORE > (repeat)
    scene.createRenderable(210, function (target: Image, camera: scene.Camera) {
        target.fillRect(0, BOTTOM, screen.width, screen.height - BOTTOM, 15)
        let x = 4
        for (let i = 0; i < steps.length; i++) {
            const w = steps[i].length * 6 + 2
            if (i == step) target.fillRect(x - 2, BOTTOM + 1, w + 2, 10, 5)
            target.print(steps[i], x, BOTTOM + 3, i == step ? 15 : 1, image.font8)
            x += w + 1
            target.print(">", x, BOTTOM + 3, 11, image.font8)
            x += 8
        }
        target.print("REPEAT", x, BOTTOM + 3, 11, image.font8)
    })

    waitForRoundEnd()
    game.splash("Time's up!", "You looped " + score + " times")
    game.popScene()

    card("THINK ABOUT IT",
        "You did the same three steps " + score + " times, and it was still (a bit) fun.\n\n" +
        "A good core loop is quick, easy to understand and satisfying to repeat.\n\n" +
        "Most games then ADD things on top of the loop: enemies, upgrades, a timer, a story.\n\n" +
        "QUESTION: What is the core loop of your favourite game? Can you describe it in 3 steps?")
    card("IN MAKECODE",
        "This loop is three blocks:\n\n" +
        "1. 'move mySprite with buttons'\n" +
        "2. 'on sprite of kind Player overlaps otherSprite of kind Food'\n" +
        "3. inside it: 'change score by 1' and move the food somewhere new.\n\n" +
        "Build this first. If your core loop is fun, the rest of your game will be easier.")
}

// =====================================================================
//  LESSON 2: GAME FEEL
// =====================================================================
// Each "feel" is just three numbers. That's all game feel is made of!
//   accel    - how quickly you speed up       (bigger = snappier)
//   friction - how quickly you slow down      (smaller = slidier)
//   maxSpeed - the fastest you can go
class Feel {
    constructor(public name: string, public accel: number,
        public friction: number, public maxSpeed: number) { }
}

function lessonGameFeel() {
    // >>> TRY THIS: invent your own feel by adding a line here
    const feels = [
        new Feel("SLUGGISH", 60, 40, 45),
        new Feel("SNAPPY", 900, 900, 90),
        new Feel("ICE RINK", 90, 12, 110),
        new Feel("TOO FAST", 3000, 3000, 220)
    ]
    let current = 0

    card("2. GAME FEEL",
        "GAME FEEL is how it feels to control your character. Is it heavy? Floaty? Slippery? Tight?\n\n" +
        "Players notice game feel in the first few seconds, before anything else.\n\n" +
        "Grab gems for 40 seconds. Press B at any time to switch between 4 different control settings.\n\n" +
        "Which one feels best? Which is the worst? Why?")

    game.pushScene()
    startRound(40, 0)
    makePlayer()
    spawnGem()

    const updateLabel = function () {
        const f = feels[current]
        settingLabel = "B:" + f.name + " " + f.accel + "/" + f.friction + "/" + f.maxSpeed
    }
    updateLabel()

    controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
        current = nextSetting(current, feels.length)
        updateLabel()
        player.sayText(feels[current].name, 800, false)
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Gem, function (p, gem) {
        gem.destroy()
        music.playTone(988, 60)
        score += 1
        spawnGem()
    })

    // Our own movement code instead of 'move sprite with buttons',
    // so we can control acceleration and friction.
    game.onUpdate(function () {
        const f = feels[current]
        let dx = 0
        let dy = 0
        if (controller.left.isPressed()) dx -= 1
        if (controller.right.isPressed()) dx += 1
        if (controller.up.isPressed()) dy -= 1
        if (controller.down.isPressed()) dy += 1
        player.ax = dx * f.accel
        player.ay = dy * f.accel
        // Friction only slows the sprite when it is not accelerating.
        player.fx = f.friction
        player.fy = f.friction
        player.vx = Math.constrain(player.vx, -f.maxSpeed, f.maxSpeed)
        player.vy = Math.constrain(player.vy, -f.maxSpeed, f.maxSpeed)
    })

    waitForRoundEnd()
    game.splash("Time's up!", "Gems: " + score)
    game.popScene()

    card("THINK ABOUT IT",
        "Every setting used the SAME game, the SAME gems and the SAME character. Only three numbers changed:\n\n" +
        "acceleration / friction / max speed\n\n" +
        "SLUGGISH felt unresponsive. TOO FAST was hard to control. ICE RINK can be fun in an ice level, but annoying everywhere else.\n\n" +
        "Designers spend a LOT of time tuning these numbers.\n\n" +
        "QUESTION: Which setting would suit a horror game? A racing game? A puzzle game?")
    card("IN MAKECODE",
        "'move mySprite with buttons vx 100 vy 100'\n\n" +
        "Those two 100s are your game feel! Try 50, then 200.\n\n" +
        "For slippery or heavy movement, use the sprite's 'ax' and 'ay' (acceleration) and 'fx' and 'fy' (friction) in the Sprites > Physics blocks.\n\n" +
        "Test your controls with a friend. If they say 'it feels weird', listen!")
}

// =====================================================================
//  LESSON 3: CHALLENGE & FLOW
// =====================================================================
function lessonFlow() {
    const names = ["TOO EASY", "TOO HARD", "RAMPING UP"]
    let current = 0
    let nextRock = 0

    card("3. CHALLENGE & FLOW",
        "FLOW is when a game is so absorbing you lose track of time.\n\n" +
        "It happens when the CHALLENGE matches your SKILL.\n" +
        "- Too easy = BORED\n" +
        "- Too hard = FRUSTRATED\n\n" +
        "Dodge the falling rocks for 30 seconds. You have 3 lives.\n\n" +
        "Press B to change the difficulty. RAMPING UP starts easy and gets harder the longer you survive.")

    game.pushScene()
    startRound(30, 3)
    scene.setBackgroundColor(15)
    effects.starField.startScreenEffect()
    makePlayer()
    controller.moveSprite(player, 90, 90)
    blinkWhileInvincible()

    const updateLabel = function () {
        settingLabel = "B: Difficulty = " + names[current]
    }
    updateLabel()

    controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
        current = nextSetting(current, names.length)
        updateLabel()
    })

    // How often a rock falls (ms) and how fast it moves.
    // >>> TRY THIS: change these numbers to make your own difficulty
    const rockDelay = function (): number {
        if (current == 0) return 1500
        if (current == 1) return 130
        return Math.max(180, 1100 - elapsed * 32)   // ramp: shorter delay over time
    }
    const rockSpeed = function (): number {
        if (current == 0) return 30
        if (current == 1) return 120
        return 35 + elapsed * 3                     // ramp: faster over time
    }

    game.onUpdate(function () {
        if (game.runtime() < nextRock) return
        nextRock = game.runtime() + rockDelay()
        const rock = sprites.create(ROCK_IMG, SpriteKind.Enemy)
        rock.setPosition(randint(4, screen.width - 4), TOP)
        rock.vy = rockSpeed()
        rock.vx = randint(-15, 15)
        rock.setFlag(SpriteFlag.AutoDestroy, true)
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (p, rock) {
        if (isInvincible()) return
        rock.destroy(effects.fire, 200)
        lives -= 1
        hurtPlayer()
        if (lives <= 0) roundOver = true
    })

    // Score = seconds survived
    game.onUpdateInterval(1000, function () {
        if (!roundOver) score += 1
    })

    waitForRoundEnd()
    if (lives <= 0) game.splash("Out of lives!", "Survived " + score + " seconds")
    else game.splash("You survived!", "Lives left: " + lives)
    game.popScene()

    card("THINK ABOUT IT",
        "TOO EASY: you could win without trying. Boring.\n" +
        "TOO HARD: you could not win however hard you tried. Frustrating.\n" +
        "RAMPING UP: easy at first while you learn, then harder as you get better.\n\n" +
        "Ramping difficulty keeps players in the FLOW zone. This is called the DIFFICULTY CURVE.\n\n" +
        "But players have different skill levels. That is why many games have Easy / Normal / Hard.\n\n" +
        "QUESTION: Think of a game that got too hard too fast. What would you change?")
    card("IN MAKECODE",
        "Spawn enemies with 'on game update every 500 ms'.\n\n" +
        "To make difficulty ramp up, use a variable for the speed (or delay) and change it over time. For example:\n\n" +
        "'set rock speed to 30 + (score x 3)'\n\n" +
        "Playtest your game with someone who has NEVER played it. Watch where they get stuck.")
}

// =====================================================================
//  LESSON 4: FEEDBACK & JUICE
// =====================================================================
function lessonJuice() {
    const names = ["NO FEEDBACK", "BASIC", "JUICY"]
    let current = 0

    card("4. FEEDBACK & JUICE",
        "FEEDBACK tells the player what just happened: you scored, you got hit, you levelled up.\n\n" +
        "JUICE is extra feedback that makes actions feel GOOD: sounds, sparkles, screen shake, pop-ups.\n\n" +
        "Grab gems for 30 seconds. Press B to switch between NO FEEDBACK, BASIC and JUICY.\n\n" +
        "Same game every time. Notice how different it feels.")

    game.pushScene()
    startRound(30, 0)
    makePlayer()
    controller.moveSprite(player, 100, 100)
    for (let i = 0; i < 3; i++) spawnGem()

    const updateLabel = function () {
        settingLabel = "B: Feedback = " + names[current]
        showScore = current > 0
    }
    updateLabel()

    controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
        current = nextSetting(current, names.length)
        updateLabel()
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Gem, function (p, gem) {
        score += 1
        if (current == 2) {
            // JUICY: lots of feedback, all at once!
            // >>> TRY THIS: turn some of these off. Which one matters most?
            gem.destroy(effects.disintegrate, 300)                    // sparkles
            music.play(music.melodyPlayable(music.baDing),
                music.PlaybackMode.InBackground)                      // sound
            scene.cameraShake(2, 150)                                 // screen shake
            player.sayText("+1", 400, false)                          // pop-up text
            scorePopUntil = game.runtime() + 250                      // big score
        } else {
            gem.destroy()                                             // just vanish
        }
        spawnGem()
    })

    waitForRoundEnd()
    game.splash("Time's up!", "Gems: " + score)
    game.popScene()

    card("THINK ABOUT IT",
        "NO FEEDBACK: did you even know you were scoring? It felt broken.\n\n" +
        "BASIC: you could see your score. It worked, but felt flat.\n\n" +
        "JUICY: sparkles, a sound, a tiny shake and a pop-up. The game is exactly the same, but it feels much better!\n\n" +
        "Careful: too much juice can be distracting or tiring.\n\n" +
        "QUESTION: Think of a game where collecting something feels great. What feedback does it use?")
    card("IN MAKECODE",
        "Each piece of juice is one block. Put them inside your 'on overlap' event:\n\n" +
        "- 'play sound ba ding'\n" +
        "- 'destroy otherSprite with disintegrate effect'\n" +
        "- 'camera shake by 2 pixels for 150 ms'\n" +
        "- 'mySprite say +1 for 400 ms'\n\n" +
        "Add juice to every important action: scoring, getting hurt, winning.")
}

// =====================================================================
//  LESSON 5: RISK & REWARD
// =====================================================================
function lessonRiskReward() {
    // >>> TRY THIS: change how much the big gem is worth
    const gemValues = [2, 5, 20]
    let current = 1
    const PENALTY = 3

    card("5. RISK & REWARD",
        "Good games give players INTERESTING CHOICES.\n\n" +
        "Coins are safe but only worth 1 point.\n\n" +
        "The red gem is worth more, but a bat guards it. If the bat catches you, you lose " + PENALTY + " points.\n\n" +
        "Get the best score you can in 40 seconds.\n\n" +
        "Press B to change what the red gem is worth. When is the risk worth it?")

    game.pushScene()
    startRound(40, 0)
    scene.setBackgroundColor(7)
    makePlayer()
    player.setPosition(20, 60)
    controller.moveSprite(player, 90, 90)
    blinkWhileInvincible()

    const spawnCoin = function () {
        const c = sprites.create(COIN_IMG, SpriteKind.Food)
        c.setPosition(randint(10, 70), randint(TOP + 10, BOTTOM - 10))
    }
    for (let i = 0; i < 4; i++) spawnCoin()

    // The big gem and its guard live on the right side of the screen.
    const bigGem = sprites.create(BIG_GEM_IMG, SpriteKind.BigGem)
    const moveBigGem = function () {
        bigGem.setPosition(randint(110, 148), randint(TOP + 14, BOTTOM - 14))
    }
    moveBigGem()
    const bat = sprites.create(BAT_IMG, SpriteKind.Enemy)
    bat.setPosition(bigGem.x, bigGem.y - 12)

    const updateLabel = function () {
        settingLabel = "B: Red gem worth " + gemValues[current] + " pts"
    }
    updateLabel()

    controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
        current = nextSetting(current, gemValues.length)
        updateLabel()
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Food, function (p, coin) {
        coin.destroy()
        music.playTone(880, 50)
        score += 1
        spawnCoin()
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.BigGem, function (p, gem) {
        music.play(music.melodyPlayable(music.powerUp), music.PlaybackMode.InBackground)
        score += gemValues[current]
        player.sayText("+" + gemValues[current], 600, false)
        moveBigGem()
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (p, b) {
        if (isInvincible()) return
        score -= PENALTY
        player.sayText("-" + PENALTY, 600, false)
        hurtPlayer()
        player.setPosition(20, 60)
    })

    // The bat chases you when you come near its gem, otherwise it goes home.
    game.onUpdate(function () {
        const nearGem = Math.abs(player.x - bigGem.x) < 45 && Math.abs(player.y - bigGem.y) < 45
        let tx = bigGem.x
        let ty = bigGem.y - 12
        let speed = 40
        if (nearGem && !isInvincible()) {
            tx = player.x
            ty = player.y
            speed = 75     // >>> TRY THIS: a faster bat means more risk
        }
        const dx = tx - bat.x
        const dy = ty - bat.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 2) {
            bat.vx = dx / dist * speed
            bat.vy = dy / dist * speed
        } else {
            bat.vx = 0
            bat.vy = 0
        }
    })

    waitForRoundEnd()
    game.splash("Time's up!", "Score: " + score)
    game.popScene()

    card("THINK ABOUT IT",
        "When the red gem was worth 2, it was not worth the danger. Everyone just collected coins. No real choice.\n\n" +
        "When it was worth 20, everyone went for it every time. Again, no real choice.\n\n" +
        "At 5 points you had to THINK: is it worth it right now?\n\n" +
        "That is BALANCE. A choice is only interesting when every option has a good side and a bad side.\n\n" +
        "QUESTION: Where does a game you play make you choose between safe and risky?")
    card("IN MAKECODE",
        "Use a different sprite KIND for each kind of reward, then give each one its own 'on overlap' event:\n\n" +
        "- Food overlap: change score by 1\n" +
        "- BigGem overlap: change score by 5\n" +
        "- Enemy overlap: change score by -3\n\n" +
        "To make an enemy chase the player, use 'set myEnemy follow mySprite'.")
}

// =====================================================================
//  LESSON 6: RULES - WIN & LOSE
// =====================================================================
function lessonRules() {
    card("6. RULES: WIN & LOSE",
        "A TOY is something you play with, like a ball.\n" +
        "A GAME has RULES, a GOAL and an ENDING.\n\n" +
        "In this lesson YOU are the designer. Choose a way to WIN and a way to LOSE, then play your game.\n\n" +
        "Try a few different combinations. Then try choosing NONE for both...")

    const winRule = pickOption("HOW DO YOU WIN?", "UP/DOWN then A",
        ["Collect 10 gems", "Survive 20 seconds", "No way to win"])
    const loseRule = pickOption("HOW DO YOU LOSE?", "UP/DOWN then A",
        ["Lose 3 lives", "Run out of time", "No way to lose"])

    let result = ""   // "win", "lose" or "stopped"

    game.pushScene()
    // Only use the timer and lives if the rules need them.
    let seconds = 0
    if (loseRule == 1) seconds = 15
    if (winRule == 1) seconds = 20
    startRound(seconds, loseRule == 0 ? 3 : 0)
    scene.setBackgroundColor(9)
    makePlayer()
    controller.moveSprite(player, 90, 90)
    blinkWhileInvincible()
    spawnGem()
    spawnGem()

    const goals = ["10 gems", "survive", "no goal"]
    const dangers = ["3 lives", seconds + "s timer", "no danger"]
    settingLabel = "WIN:" + goals[winRule] + " LOSE:" + dangers[loseRule]
    if (winRule == 2 && loseRule == 2) settingLabel = "No rules! Press B to stop"

    const finish = function (r: string) {
        if (roundOver) return
        result = r
        roundOver = true
    }

    onTimeUp = function () {
        if (winRule == 1) finish("win")        // survived until the timer ran out
        else if (loseRule == 1) finish("lose") // ran out of time before winning
    }

    controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
        finish("stopped")
    })

    const spawnBat = function () {
        const b = sprites.create(BAT_IMG, SpriteKind.Enemy)
        b.setPosition(randint(0, 1) == 0 ? 8 : 152, randint(TOP + 10, BOTTOM - 10))
        b.follow(player, 25)
    }
    spawnBat()
    // A new bat every 5 seconds, up to 4.
    game.onUpdateInterval(5000, function () {
        if (sprites.allOfKind(SpriteKind.Enemy).length < 4) spawnBat()
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Gem, function (p, gem) {
        gem.destroy()
        music.playTone(988, 60)
        score += 1
        spawnGem()
        if (winRule == 0 && score >= 10) finish("win")
    })

    sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (p, b) {
        if (isInvincible()) return
        hurtPlayer()
        b.setPosition(b.x < 80 ? 8 : 152, b.y)
        if (loseRule == 0) {
            lives -= 1
            if (lives <= 0) finish("lose")
        }
    })

    waitForRoundEnd()
    if (result == "win") {
        effects.confetti.startScreenEffect(1500)
        music.play(music.melodyPlayable(music.powerUp), music.PlaybackMode.InBackground)
        game.splash("YOU WIN!", "Gems: " + score)
    } else if (result == "lose") {
        game.splash("YOU LOSE!", "Gems: " + score)
    } else {
        game.splash("You stopped.", "Gems: " + score)
    }
    game.popScene()

    if (winRule == 2 && loseRule == 2) {
        card("A TOY, NOT A GAME",
            "With no way to win and no way to lose, there was nothing to aim for and nothing to worry about.\n\n" +
            "The bats didn't matter. The gems didn't matter. You probably got bored quickly.\n\n" +
            "That is a TOY. Toys can be fun, but a GOAL plus some DANGER (conflict) is what makes it a GAME.")
    } else if (winRule == 2 || loseRule == 2) {
        card("HALF A GAME",
            "You only had " + (winRule == 2 ? "a way to LOSE." : "a way to WIN.") + "\n\n" +
            (winRule == 2
                ? "With no way to win, all you could do was lose. Some games work like this (endless runners), but they need a high score to chase instead!"
                : "With no way to lose, winning didn't feel like much of an achievement. There was no tension.") +
            "\n\nTry it again with a different combination.")
    }
    card("THINK ABOUT IT",
        "The game was the same every time: same player, same gems, same bats. Only the RULES changed.\n\n" +
        "Collect 10 gems + 3 lives felt different from Survive 20 seconds + Run out of time.\n\n" +
        "Rules give players a GOAL (what to do) and CONFLICT (what stops them).\n\n" +
        "QUESTION: Write down the win AND lose conditions of 3 games you know.")
    card("IN MAKECODE",
        "Rule blocks you can use:\n\n" +
        "- 'set life to 3' and 'on life zero'\n" +
        "- 'start countdown 20 s' and 'on countdown end'\n" +
        "- 'if score > 9 then game over WIN'\n\n" +
        "Decide your win and lose conditions BEFORE you start building. Write them at the top of your design document.")
}

// =====================================================================
//  ABOUT / TEACHER NOTES
// =====================================================================
function aboutPage() {
    card("ABOUT GAME DESIGN LAB",
        "Six experiments. Each one is a tiny game with ONE design setting you can change with the B button.\n\n" +
        "Play each round, try every setting, and answer the question at the end.\n\n" +
        "CONTROLS\n" +
        "Arrows: move / choose\n" +
        "A: confirm / next page\n" +
        "B: change the setting\n\n" +
        "FOR DESIGNERS\n" +
        "Open this project in MakeCode and switch to JavaScript to read the code. Each lesson is one function. Look for '>>> TRY THIS' comments.\n\n" +
        "A * in the menu means you have finished that lesson.")
}

// =====================================================================
//  MAIN MENU
// =====================================================================
const lessonNames = [
    "Core Loop",
    "Game Feel",
    "Challenge & Flow",
    "Feedback & Juice",
    "Risk & Reward",
    "Rules: Win & Lose"
]

function titleScreen() {
    game.pushScene()
    scene.setBackgroundColor(12)
    effects.starField.startScreenEffect()
    const big = image.scaledFont(image.font8, 2)
    scene.createRenderable(100, function (target: Image, camera: scene.Camera) {
        target.print("GAME DESIGN", Math.idiv(screen.width - 11 * 12, 2), 14, 5, big)
        target.print("LAB", Math.idiv(screen.width - 3 * 12, 2), 34, 5, big)
        printCentered(target, "6 experiments in", 58, 1)
        printCentered(target, "making games fun", 68, 1)
        if (Math.idiv(game.runtime(), 500) % 2 == 0) printCentered(target, "Press A to start", 104, 9)
    })
    const hero = sprites.create(PLAYER_IMG, SpriteKind.Player)
    hero.setPosition(40, 90)
    const gem = sprites.create(GEM_IMG, SpriteKind.Gem)
    gem.setPosition(80, 90)
    const bat = sprites.create(BAT_IMG, SpriteKind.Enemy)
    bat.setPosition(120, 90)
    game.onUpdate(function () {
        bat.y = 90 + Math.sin(game.runtime() / 250) * 4
        gem.y = 90 + Math.sin(game.runtime() / 300 + 1) * 2
    })
    pauseUntil(() => !controller.A.isPressed())
    pauseUntil(() => controller.A.isPressed())
    music.play(music.melodyPlayable(music.powerUp), music.PlaybackMode.InBackground)
    pauseUntil(() => !controller.A.isPressed())
    game.popScene()
}

titleScreen()

while (true) {
    const options: string[] = []
    for (let i = 0; i < lessonNames.length; i++) {
        options.push((i + 1) + "." + lessonNames[i] + (completed[i] ? " *" : ""))
    }
    options.push("About / Help")

    const choice = pickOption("GAME DESIGN LAB", "UP/DOWN then A", options)
    if (choice == 0) lessonCoreLoop()
    else if (choice == 1) lessonGameFeel()
    else if (choice == 2) lessonFlow()
    else if (choice == 3) lessonJuice()
    else if (choice == 4) lessonRiskReward()
    else if (choice == 5) lessonRules()
    else aboutPage()

    if (choice < lessonNames.length) completed[choice] = true
    if (completed.every(c => c) && choice < lessonNames.length) {
        card("LAB COMPLETE!",
            "You have tried all six experiments:\n\n" +
            "1. Core loop\n2. Game feel\n3. Challenge & flow\n4. Feedback & juice\n5. Risk & reward\n6. Rules: win & lose\n\n" +
            "Now design your own game! For each idea above, write one sentence about how YOUR game will use it.")
    }
}
