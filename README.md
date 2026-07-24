# Season of Ghosts Minigames

Private Foundry VTT module for small table minigames in a Season of Ghosts campaign.

## Install Locally

Copy this folder into your Foundry user data modules folder:

```text
C:\Users\<you>\AppData\Local\FoundryVTT\Data\modules\season-of-ghosts-minigames
```

Then restart Foundry, enable **Season of Ghosts Minigames** in your world, and create a script macro:

```js
SeasonGhostsMinigames.openHealingShrine();
```

## Current Games

- **Qi Zhong's Gecko Guardian**: a W19 Hand of Spring healing shrine interaction.
- In Foundry, the game opens as a native movable Dialog window.
- Opening the game plays a short dark retro battle-intro animation and chiptune sting.

## Table Result

- Clean success: Trust reaches 7, Fed reaches 4, Coin Charge reaches 6, and Alarm is 4 or lower. Give `+2 circumstance bonus` to the Qi Zhong shrine check.
- Messy success: Trust reaches 7 and Coin Charge reaches 6 with Alarm 6 or lower. Bless the coin, but keep the scene a little unsettling.
- Messy result: Alarm reaches 7 or the party runs out of actions. The party can still bless the coin, but use a small complication or `-1`.

## Quick Local Feedback

Open `dev-test.html` in a browser to test the game UI without Foundry:

```text
dev-test.html
```

This is only a visual and button-behavior test. Use Forge for the real module test.

## Audio

The game uses packaged `.wav` files for the intro sting, arcade button clicks, a storm loop, and the blessed coin heartbeat. Browsers may block ambient audio until the first click. Use the in-game **Sound On/Off** button to retry or mute.
