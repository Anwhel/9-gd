# Game Design Lab

A MakeCode Arcade game that teaches the basic ideas of game design by letting
students **play, change one thing, and feel the difference**.

There are six short experiments. Each one is a tiny game with a single design
setting that the player changes with the **B** button while they play. Each
round finishes with a "Think about it" question and an "In MakeCode" tip that
links the idea to the blocks students will use in their own games.

| # | Experiment | Design idea | What B changes |
|---|-----------|-------------|----------------|
| 1 | Core Loop | The main action players repeat (move > grab > score) | – (an on-screen diagram lights up each step of the loop) |
| 2 | Game Feel | How controls feel: acceleration, friction, max speed | Sluggish / Snappy / Ice rink / Too fast |
| 3 | Challenge & Flow | Difficulty that matches skill; difficulty curves | Too easy / Too hard / Ramping up |
| 4 | Feedback & Juice | Telling the player what happened, and making it feel good | No feedback / Basic / Juicy |
| 5 | Risk & Reward | Interesting choices and balance | How much the guarded gem is worth (2 / 5 / 20) |
| 6 | Rules: Win & Lose | Goals and conflict turn a toy into a game | Students pick a win rule and a lose rule before playing |

**Controls:** arrow keys (or WASD) to move · **A** (space) to confirm · **B** (enter) to change the setting.

## Play it

* open [https://arcade.makecode.com/](https://arcade.makecode.com/)
* click **Import** then **Import URL**
* paste **https://github.com/anwhel/9-gd** and click import

The project opens in JavaScript view (it uses a few features that blocks can't show), but
every lesson is one clearly commented function, so students can read it.

## Using it in class (suggested)

1. **Play (20–30 min).** Students work through the six experiments, trying every
   B setting. A `*` appears in the menu beside each finished experiment.
2. **Discuss.** Each experiment ends with a question, for example:
   * What is the core loop of your favourite game, in 3 steps?
   * Which control setting suits a horror game? A racing game?
   * Think of a game that got too hard too fast. What would you change?
   * Think of a game where collecting something feels great. What feedback does it use?
   * Where does a game you play make you choose between safe and risky?
   * Write down the win and lose conditions of 3 games you know.
3. **Modify (extension).** Students open the code and find the `>>> TRY THIS`
   comments, e.g. invent a new control "feel", change the difficulty ramp,
   switch off one piece of juice at a time, or change what the gem is worth.
4. **Apply.** Students write one sentence for each idea about how *their own*
   game will use it, before they start building.

## Files

* `main.ts` – the whole game (one function per experiment)
* `pxt.json` – MakeCode project settings
* `tilemap.g.*` – an unused tilemap from the original starter project

#### Metadata (used for search, rendering)

* for PXT/arcade
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
