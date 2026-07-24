# Next Session Notes

This is the portable handoff memory for continuing the Season of Ghosts Foundry minigames module on another computer or in a fresh Codex session.

## Project

- Repo/module path on this machine: `C:\Users\sc897\OneDrive\Documents\Shane Remote\Personal\PF2E\foundry-modules\season-of-ghosts-minigames`
- Foundry module id: `season-of-ghosts-minigames`
- Current module version: `0.2.0`
- Foundry compatibility: v13 minimum / verified
- Main logic: `scripts/main.js`
- Main styles: `styles/minigames.css`
- Local browser test harness: `dev-test.html`

Foundry macro API:

```js
SeasonGhostsMinigames.openHealingShrine();
SeasonGhostsMinigames.openRiverRace();
SeasonGhostsMinigames.closeMinigames();
```

## Current Implemented Minigames

### Qi Zhong's Gecko Guardian

Used for W19 Hand of Spring / Doctor Dami / final blessed coin scene.

Behavior:

- Opens as a Foundry Dialog.
- GM can click **Show To Players**.
- Players see a read-only shared view.
- GM controls the action buttons.
- Shared state is stored in a hidden Foundry world setting: `healingShrineState`.
- Live updates are sent over the module socket: `module.season-of-ghosts-minigames`.
- **Send To Chat** posts the current result and meter totals.

Important assets:

- `assets/clinic-room-pixel.png`
- `assets/phantom-gecko-pixel.png`
- `assets/blessed-coin-veiny-crawl.png`
- `assets/battle-start-jingle.wav`
- `assets/arcade-click.wav`
- `assets/arcade-confirm.wav`
- `assets/heartbeat-arcade-loop.wav`
- `assets/mixkit-heavy-storm-rain-loop-2400.wav`

Audio notes:

- Intro jingle plays first.
- Storm audio starts after the intro.
- Heartbeat starts when the coin becomes blessed.
- If Foundry audio sounds static/clicky, consider converting the storm WAV to OGG/MP3 later.

### Blood-Rain River Race

The newer river crossing game. It is inspired by the feel of Club Penguin Sled Racing, but themed as a haunted river crossing back toward Dawnstep Bridge / the Eternal Lantern.

Behavior:

- GM opens with `SeasonGhostsMinigames.openRiverRace()`.
- GM clicks **Show To Players**.
- Players click **Join Crossing**.
- Join uses the player's assigned Foundry character first, then selected token if available, otherwise the user name.
- GM clicks **Start**.
- Race becomes a live animated river run:
  - Sprites continuously move downriver.
  - Hazards and ramps scroll through the viewport.
  - Players steer with arrow keys or the **Steer Left / Steer Right / Straight** buttons.
  - Ramps give a temporary speed boost.
  - Obstacles deal `3` damage per hit.
  - Finish order is tracked automatically.
  - **Chat Results** posts placement, hit count, and damage totals.
- GM client is authoritative for the live race loop.
- Player clients send steering commands over sockets.
- Shared state is stored in a hidden Foundry world setting: `riverRaceState`.

Design intent:

- This should feel more like active sledding than a turn board.
- It is not currently applying PF2E HP damage automatically. It tracks damage totals so the GM can apply them after the race.
- This is safer than touching actor HP directly until the exact PF2E system data path is verified in Foundry.

Known limitation:

- Local `dev-test.html` can only simulate one local player. True multiplayer behavior needs a Foundry test with GM + player clients.

## Local Preview

Direct `file://` browser previews are blocked/cached in some contexts. Use a local HTTP server from the module folder:

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

Preview URL:

```text
http://127.0.0.1:8787/dev-test.html
```

The dev harness has cache-busting query strings:

```html
<link rel="stylesheet" href="./styles/minigames.css?v=0.2.0">
<script src="./scripts/main.js?v=0.2.0"></script>
```

Update those when making visible CSS/JS changes.

## Verification Commands

Syntax check:

```powershell
node --check "C:\Users\sc897\OneDrive\Documents\Shane Remote\Personal\PF2E\foundry-modules\season-of-ghosts-minigames\scripts\main.js"
```

Manual browser smoke test:

1. Start the local server.
2. Open `http://127.0.0.1:8787/dev-test.html`.
3. Open Blood-Rain River Race.
4. Click Join Crossing.
5. Click Start.
6. Confirm the live board appears, sprite moves, steering shifts lanes, hits add damage, and standings update.

## Forge / Transfer Notes

To transfer to another computer through Git:

1. Commit `NEXT_SESSION_NOTES.md` with the module changes.
2. Pull/clone the repo on the other computer.
3. Put the module folder in the Foundry `Data/modules/season-of-ghosts-minigames` location or upload a zip to Forge.

Before building a Forge zip:

1. Bump `module.json` version if behavior changed.
2. Update `dev-test.html` cache-bust query strings.
3. Run `node --check`.
4. Build a fresh zip with the version in the filename.
5. Confirm the zip includes `module.json`, `scripts/`, `styles/`, `assets/`, and this memory file.
6. Upload through Forge's Import Wizard.
7. Restart the Forge Foundry server.
8. Enable/re-enable **Season of Ghosts Minigames**.
9. Hard refresh browser clients.

## Campaign Context

Party:

- Sick: male ratfolk alchemist, very stinky. Home/burrow near W24 Mushroom House. Good spotlight for missing grandchildren / Mushroom House hooks.
- Captain Ladle: male swashbuckler with a ladle, piratey. Locals keep calling him "Spoon Man." Home near W22 Fisheries.
- Pepski: female leshy cleric. Coffee/matcha rituals instead of normal prayer. Recorder / Hot Cross Buns incident angered spirits at the Lady of Souls.
- Strega Nona: female human druid. Weed-based, stoned Ms. Frizzle energy. Home near W25 Cerulean Teahouse.
- Grashka: female orc barbarian with giant sword. Home near W28 Bones of the Forgotten.

Tone:

- The table likes silly supernatural weirdness.
- They prefer roleplay, creative problem-solving, and minigame-style challenges over straight combat.
- Running jokes become canon.
- The campaign is sillier than written, but the horror should stay sincere underneath.

Recurring bits:

- Captain Ladle is often called "Spoon Man."
- The blessed copper coins are warm, throbbing, and unsettling.
- Spirits were angered by Pepski's recorder/matcha ritual.
- The Abicus Sisters were socially defeated by correcting their word mistake.
- There is an emerging thread that some hostile supernatural force may be misogynistic.

Story so far:

- Party woke in the forest after the Reenactment Festival.
- Fought centipedes.
- Crossed the first bridge; only male PCs remembered the nursery rhyme, feeding the misogynist-haunt thread.
- Met Hai-er Ha at the tower; Strega gave her LSD tea.
- Saw Ugly Cute's statue missing.
- Saw/moved past Dawnstep Bridge.
- Lit the small Ugly Cute lantern, not the big Eternal Lantern.
- Went to W6 Matsuki Estate.
- Old Matsuki fed them, gave copper coins/blessing ritual, and warned about Gurglegut and jinkins at W11 Dawnstep Bridge.
- Went to W10 Lady of Souls; Pepski did a matcha/recorder ritual and angered spirits, but the first coin was blessed.
- Saved Sumika from the Abicus Sisters by correcting "abicus/abactor."
- Blessed another coin at an improvised living-room-style shrine.
- Grashka had a test-of-strength / Test Your Might slab-breaking trial.
- Crossed water by canoe using a Frogger-style body-dodging minigame. Ghostly grasps trapped failed PCs for a turn. Captain Ladle reached the far side and freed others.
- A cat NPC told Ladle some things were left for him, but the fishery has troubles to discuss later.
- Session ended around Granny Hu / W21 Trade Office.

Current likely route:

1. Granny Hu conversation at W21 Trade Office / Ceiba-Duyue Exchange.
2. Optional Captain Ladle fishery event at W22.
3. W19 Hand of Spring / Doctor Dami / Qi Zhong shrine.
4. Use Qi Zhong's Gecko Guardian for the final blessed coin.
5. River crossing back toward W11 Dawnstep Bridge.
6. Use Blood-Rain River Race for the return crossing.
7. Defeat/trick Gurglegut, possibly using dreamtime tea from Doctor Dami.
8. Insert three blessed coins into the Eternal Lantern.
9. Relight the lantern to end the mirage mist / crimson moon / blood rain effects.

Important NPCs:

- Old Matsuki: warm, cranky disaster-response elder and southbank leader. Wants the Eternal Lantern lit. Gruff but sincere.
- Granny Hu: Northridge leader. Suspicious, political, sharp. Wants Doctor Dami checked and missing grandchildren found near W24, but can accept lantern first. Does not want Matsuki getting all the credit.
- Sumika: Silvermist hunter saved by the party. Can track Ugly Cute once fog clears.
- Doctor Dami: at W19 Hand of Spring. Can help with healing, open Qi Zhong shrine, provide dreamtime tea for Gurglegut. Has phantom gecko guardian at clinic.

Deferred hooks:

- W24 Mushroom House / missing grandchildren / "Worst Puzzle": good Sick spotlight.
- W22 Fisheries: Captain Ladle fishery trouble and chance to be respected as Captain Ladle, not Spoon Man.
- W25 Cerulean Teahouse: future Strega haunted tea/spirit hook.
- W27 Leshy's Saloon: Pepski coffee/tea theology hook.
- W28 Bones of the Forgotten: Grashka and misogynist-haunt/justice thread.
- Ugly Cute: Sumika can pursue once the lantern is lit.
- Young dragon from Beginner Box: saved for later, possibly glimpsed outside the Wall of Ghosts or tied to the real world.

## Design Guidelines For This Module

- Minigames should be fail-forward, not hard blockers.
- Use simple obvious controls.
- Let players be funny, but keep Willowshore scared and haunted underneath.
- Track consequences in a GM-friendly way: hit count, damage totals, complications, bonuses.
- Avoid automatically changing PF2E actor data unless the exact system path is tested.
- Prefer shared state via world settings plus sockets for multiplayer displays.
- Keep player-facing effects visible and tactile: sprites, meters, logs, chat results.
- Do not overdo a minigame if the table needs a clean chapter end.
