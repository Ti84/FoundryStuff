const MODULE_ID = "season-of-ghosts-minigames";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const shrineActions = {
  offerInsect: {
    label: "Offer Insect",
    pp: 3,
    delta: { trust: 1, hunger: 2, alarm: 1, charge: 0 },
    text: "The gecko snaps up the insect with ghostly speed, then stares at your fingers as if considering seconds."
  },
  bow: {
    label: "Bow Respectfully",
    pp: 3,
    delta: { trust: 1, hunger: 0, alarm: -1, charge: 0 },
    text: "The gecko lowers its head by the smallest possible amount. Dami exhales like this was the correct answer all along."
  },
  soothe: {
    label: "Speak Softly",
    pp: 3,
    delta: { trust: 1, hunger: 0, alarm: -2, charge: 0 },
    text: "Your voice steadies the room. The gecko's tail stops lashing against the floorboards."
  },
  treat: {
    label: "Treat Wound",
    pp: 2,
    delta: { trust: 2, hunger: -1, alarm: -1, charge: 1 },
    text: "You tend a place where spirit-light leaks through its scales. The gecko watches you with ancient, offended gratitude."
  },
  focusCoin: {
    label: "Focus Coin",
    pp: 3,
    delta: { trust: 0, hunger: -1, alarm: 1, charge: 2 },
    text: "The copper coin twitches in your palm. Dark red veins rise under the metal like something alive beneath skin."
  },
  recorder: {
    label: "Play Recorder",
    pp: 2,
    delta: { trust: 0, hunger: 0, alarm: 0, charge: 0 },
    text: "The first note hangs in the air. The shrine considers whether music can be a crime."
  },
  grab: {
    label: "Grab Gecko",
    pp: 1,
    delta: { trust: -2, hunger: 0, alarm: 3, charge: 0 },
    text: "Dami shouts, \"Do not manhandle the clinic spirit!\" The gecko becomes mostly teeth and judgment."
  }
};

class HealingShrineGame {
  constructor() {
    this.state = this.defaultState();
    this.element = null;
    this.dialog = null;
    this.audio = null;
    this.introTimer = null;
  }

  defaultState() {
    return {
      trust: 1,
      hunger: 1,
      alarm: 2,
      charge: 0,
      round: 1,
      lastAction: null,
      resolved: false,
      result: null,
      introActive: false,
      soundEnabled: true,
      uses: Object.fromEntries(Object.entries(shrineActions).map(([key, action]) => [key, action.pp])),
      log: [
        "The phantom gecko coils around the clinic shrine. Its golden eye fixes on the unblessed copper coin."
      ]
    };
  }

  open() {
    this.close();
    this.state.introActive = true;

    if (this.canUseFoundryDialog()) {
      this.openFoundryDialog();
      return;
    }

    const wrapper = document.createElement("section");
    wrapper.className = "sog-minigame sog-healing-shrine";
    wrapper.innerHTML = this.render();
    document.body.appendChild(wrapper);
    this.element = wrapper;
    this.activateListeners();
    this.startStormAudio();
    this.startIntroSequence();
  }

  close() {
    globalThis.clearTimeout(this.introTimer);
    this.introTimer = null;
    this.stopAudio();
    if (this.dialog) {
      const dialog = this.dialog;
      this.dialog = null;
      dialog.close();
    }
    document.querySelectorAll(".sog-minigame").forEach((el) => el.remove());
    this.element = null;
  }

  canUseFoundryDialog() {
    return Boolean(globalThis.game && globalThis.Dialog);
  }

  openFoundryDialog() {
    this.dialog = new Dialog(
      {
        title: "Qi Zhong's Gecko Guardian",
        content: `<section class="sog-minigame sog-healing-shrine sog-foundry-window">${this.render()}</section>`,
        buttons: {},
        render: (html) => {
          const root = html[0]?.querySelector(".sog-minigame");
          if (!root) return;
          this.element = root;
          this.activateListeners();
          this.startStormAudio();
          this.startIntroSequence();
        },
        close: () => {
          globalThis.clearTimeout(this.introTimer);
          this.introTimer = null;
          this.stopAudio();
          this.dialog = null;
          this.element = null;
        }
      },
      {
        classes: ["sog-foundry-app"],
        width: 980,
        height: 720,
        resizable: true
      }
    );
    this.dialog.render(true);
  }

  reset() {
    const soundEnabled = this.state.soundEnabled;
    this.stopAudio();
    this.state = this.defaultState();
    this.state.soundEnabled = soundEnabled;
    this.state.introActive = false;
    this.update();
    if (this.state.soundEnabled) this.startStormAudio();
  }

  render() {
    const { trust, hunger, alarm, charge, round, resolved, log, uses } = this.state;
    const result = this.resultText();
    const coinObtained = this.hasBlessedCoin();
    const actionButtons = Object.entries(shrineActions)
      .map(([key, action]) => `<button type="button" data-action="${key}" ${resolved || uses[key] <= 0 ? "disabled" : ""}>
        <span>${action.label}</span>
        <small>PP ${uses[key]}/${action.pp}</small>
      </button>`)
      .join("");

    return `
      <div class="sog-window">
        <header class="sog-header">
          <div>
            <p class="sog-kicker">W19 Hand of Spring</p>
            <h2>Qi Zhong's Gecko Guardian</h2>
          </div>
          <div class="sog-header-controls">
            <button type="button" data-control="sound">${this.state.soundEnabled ? "Sound On" : "Sound Off"}</button>
            <button type="button" class="sog-icon-button" data-control="close" aria-label="Close">x</button>
          </div>
        </header>

        <div class="sog-stage">
          <div class="sog-clinic-room" aria-hidden="true">
            <div class="sog-back-wall"></div>
            <div class="sog-window-rain left"></div>
            <div class="sog-window-rain right"></div>
            <div class="sog-sliding-door left"></div>
            <div class="sog-sliding-door right"></div>
            <div class="sog-clinic-shelf"></div>
            <div class="sog-floor-mats"></div>
          </div>
          <div class="sog-rain" aria-hidden="true"></div>
          <div class="sog-lightning" aria-hidden="true"></div>
          <div class="sog-pixel-shrine" aria-hidden="true">
            <div class="sog-shrine-roof"></div>
            <div class="sog-shrine-body"></div>
            <div class="sog-shrine-bowl"></div>
          </div>
          <div class="sog-gecko ${resolved ? "is-resolved" : ""}" aria-hidden="true">
            <div class="sog-spirit-flame flame-a"></div>
            <div class="sog-spirit-flame flame-b"></div>
          </div>
          <div class="sog-reward ${coinObtained ? "show" : ""}" aria-hidden="${coinObtained ? "false" : "true"}">
            <div class="sog-throbbing-coin" role="img" aria-label="A veiny blessed copper coin pulsing like a heart"></div>
            <p>BLESSED COIN</p>
          </div>
        </div>

        <div class="sog-command-deck">
          <section class="sog-log" aria-live="polite">
            <p><strong>Round ${round}</strong></p>
            ${log.slice(-3).map((entry) => `<p>${entry}</p>`).join("")}
          </section>

          <aside class="sog-side-panel">
            <div class="sog-meters">
              ${this.meter("Trust", trust, 8)}
              ${this.meter("Fed", hunger, 6)}
              ${this.meter("Alarm", alarm, 7, true)}
              ${this.meter("Coin", charge, 6)}
            </div>

            <p class="sog-status">${result}</p>

            <div class="sog-actions">
              ${actionButtons}
            </div>

            <footer class="sog-footer">
              <button type="button" data-control="reset">Reset</button>
              <button type="button" data-control="success">Mark Pacified</button>
              <button type="button" data-control="chat">Send To Chat</button>
            </footer>
          </aside>
        </div>

        ${this.state.introActive ? `
          <div class="sog-intro-overlay" aria-live="polite">
            <div class="sog-intro-swirl" aria-hidden="true"></div>
            <div class="sog-intro-gecko" aria-hidden="true"></div>
          </div>
        ` : ""}
      </div>
    `;
  }

  meter(label, value, max, danger = false) {
    const pct = (value / max) * 100;
    const className = danger ? "danger" : "safe";
    return `
      <div class="sog-meter ${className}">
        <div class="sog-meter-label"><span>${label}</span><strong>${value}/${max}</strong></div>
        <div class="sog-meter-track"><span style="width: ${pct}%"></span></div>
      </div>
    `;
  }

  activateListeners() {
    this.element.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        this.playClick();
        this.takeAction(button.dataset.action);
      });
    });

    this.element.querySelector('[data-control="close"]').addEventListener("click", () => {
      this.playClick();
      this.close();
    });
    this.element.querySelector('[data-control="reset"]').addEventListener("click", () => {
      this.playClick();
      this.reset();
    });
    this.element.querySelector('[data-control="sound"]').addEventListener("click", () => {
      this.playClick();
      this.toggleSound();
    });
    this.element.querySelector('[data-control="success"]').addEventListener("click", () => {
      this.playClick();
      this.forceSuccess();
    });
    this.element.querySelector('[data-control="chat"]').addEventListener("click", () => {
      this.playClick();
      this.sendResultToChat();
    });
  }

  takeAction(actionKey) {
    const action = shrineActions[actionKey];
    if (!action || this.state.resolved || this.state.uses[actionKey] <= 0) return;

    const wasBlessed = this.hasBlessedCoin();
    let delta = { ...action.delta };
    let text = action.text;
    this.state.uses[actionKey] -= 1;

    if (actionKey === "recorder") {
      const roll = Math.random();
      if (roll < 0.35) {
        delta = { trust: 1, hunger: 0, alarm: -1, charge: 1 };
        text = "The recorder squeaks out something almost gentle. The gecko blinks in reluctant approval.";
      } else if (roll < 0.7) {
        delta = { trust: 0, hunger: 0, alarm: 2, charge: 0 };
        text = "The recorder remembers the Lady of Souls incident. The gecko does too.";
      } else {
        delta = { trust: 2, hunger: -1, alarm: 2, charge: 2 };
        text = "The note is terrible, but brave. The gecko is alarmed by your confidence and impressed despite itself.";
      }
    }

    if (this.state.lastAction === actionKey && actionKey !== "grab") {
      delta.alarm += 1;
      text += " Repeating the same tactic makes the guardian restless.";
    }

    this.state.trust = clamp(this.state.trust + delta.trust, 0, 8);
    this.state.hunger = clamp(this.state.hunger + delta.hunger, 0, 6);
    this.state.alarm = clamp(this.state.alarm + delta.alarm + this.guardianReaction(), 0, 7);
    this.state.charge = clamp(this.state.charge + delta.charge, 0, 6);
    this.state.round += 1;
    this.state.lastAction = actionKey;
    this.state.log.push(text);
    this.checkResolution();
    if (!wasBlessed && this.hasBlessedCoin()) {
      this.playConfirm();
      this.startHeartbeat();
    }
    this.update();
  }

  guardianReaction() {
    if (this.state.hunger <= 0) {
      this.state.log.push("The gecko's belly glows hollow. Hunger sharpens its suspicion.");
      return 1;
    }

    if (this.state.hunger >= 4 && this.state.alarm > 0) {
      return -1;
    }

    return 0;
  }

  forceSuccess() {
    this.state.trust = Math.max(this.state.trust, 7);
    this.state.hunger = Math.max(this.state.hunger, 4);
    this.state.alarm = Math.min(this.state.alarm, 2);
    this.state.charge = Math.max(this.state.charge, 6);
    this.state.resolved = true;
    this.state.result = "clean";
    this.state.log.push("Dami nods once. The gecko settles into the shrine light. The coin bulges, veins, and begins to throb with healing power.");
    this.playConfirm();
    this.startHeartbeat();
    this.update();
  }

  checkResolution() {
    if (this.state.trust >= 7 && this.state.hunger >= 4 && this.state.charge >= 6 && this.state.alarm <= 4) {
      this.state.resolved = true;
      this.state.result = "clean";
      this.state.log.push("The gecko curls around the shrine bowl. The copper coin grows warm, veined, and horribly alive with blessing.");
      return;
    }

    if (this.state.trust >= 7 && this.state.charge >= 6 && this.state.alarm <= 6) {
      this.state.resolved = true;
      this.state.result = "messy";
      this.state.log.push("The shrine accepts the effort, but the gecko snaps once before vanishing. The coin throbs unevenly.");
      return;
    }

    if (this.state.alarm >= 7) {
      this.state.resolved = true;
      this.state.result = "alarm";
      this.state.log.push("The gecko vanishes into the clinic wall. Dami can coax it back, but the shrine will remember the panic.");
      return;
    }

    if (Object.values(this.state.uses).every((uses) => uses <= 0)) {
      this.state.resolved = true;
      this.state.result = "spent";
      this.state.log.push("The party runs out of gentle ideas. Dami clears his throat and begins damage control.");
    }
  }

  resultText() {
    if (this.state.result === "clean") {
      return "Clean success: +2 circumstance bonus to the final Qi Zhong shrine check.";
    }

    if (this.state.result === "messy") {
      return "Messy success: normal Qi Zhong shrine check, and the coin throbs in an unsettling rhythm.";
    }

    if (this.state.result === "alarm" || this.state.result === "spent") {
      return "Messy result: the party can still bless the coin, but take -1 or add a small complication.";
    }

    return "Goal: Trust 7, Fed 4, Coin Charge 6, with Alarm below 7. Repeated moves raise Alarm.";
  }

  hasBlessedCoin() {
    return this.state.result === "clean" || this.state.result === "messy";
  }

  update() {
    if (!this.element) return;
    this.element.innerHTML = this.render();
    this.activateListeners();
  }

  toggleSound() {
    this.state.soundEnabled = !this.state.soundEnabled;
    if (this.state.soundEnabled) {
      this.startStormAudio();
      if (this.hasBlessedCoin()) this.startHeartbeat();
    } else {
      this.stopAudio();
    }
    this.update();
  }

  assetUrl(fileName) {
    return this.canUseFoundryDialog()
      ? `modules/${MODULE_ID}/assets/${fileName}`
      : `./assets/${fileName}`;
  }

  ensureAudio() {
    if (!this.state.soundEnabled) return null;
    this.audio ??= {
      rainElement: null,
      heartbeatElement: null,
      thunderTimer: null
    };
    return this.audio;
  }

  makeAudio(fileName, volume = 0.5, loop = false) {
    const audio = new Audio(this.assetUrl(fileName));
    audio.volume = volume;
    audio.loop = loop;
    audio.preload = "auto";
    return audio;
  }

  playAudioFile(fileName, volume = 0.5) {
    if (!this.state.soundEnabled) return;
    const audio = this.makeAudio(fileName, volume);
    this.tryPlay(audio);
  }

  playClick() {
    this.playAudioFile("arcade-click.wav", 0.34);
    this.retryAmbientAudio();
  }

  playConfirm() {
    this.playAudioFile("arcade-confirm.wav", 0.42);
    this.retryAmbientAudio();
  }

  playBattleStart() {
    this.playAudioFile("battle-start-jingle.wav", 0.42);
  }

  startIntroSequence() {
    if (!this.state.introActive) return;
    globalThis.clearTimeout(this.introTimer);
    this.playBattleStart();
    this.introTimer = globalThis.setTimeout(() => {
      this.state.introActive = false;
      this.update();
      this.retryAmbientAudio();
    }, 2600);
  }

  startStormAudio() {
    const audio = this.ensureAudio();
    if (!audio || audio.rainElement) return;

    audio.rainElement = this.makeAudio("rain-soft-patter-loop.wav", 0.34, true);
    this.tryPlay(audio.rainElement);
    this.scheduleThunder(true);
  }

  scheduleThunder(first = false) {
    if (!this.audio || !this.state.soundEnabled) return;
    globalThis.clearTimeout(this.audio.thunderTimer);
    this.audio.thunderTimer = globalThis.setTimeout(() => {
      this.playThunder();
      this.scheduleThunder();
    }, first ? 1800 : 6500 + Math.random() * 8500);
  }

  playThunder() {
    this.playAudioFile("thunder-soft-rumble.wav", 0.38);
  }

  startHeartbeat() {
    const audio = this.ensureAudio();
    if (!audio || audio.heartbeatElement || !this.hasBlessedCoin()) return;

    audio.heartbeatElement = this.makeAudio("heartbeat-arcade-loop.wav", 0.5, true);
    this.tryPlay(audio.heartbeatElement);
  }

  retryAmbientAudio() {
    if (!this.state.soundEnabled) return;
    if (!this.audio?.rainElement) {
      this.startStormAudio();
    } else if (this.audio.rainElement.paused) {
      this.tryPlay(this.audio.rainElement);
    }

    if (this.hasBlessedCoin()) {
      if (!this.audio?.heartbeatElement) {
        this.startHeartbeat();
      } else if (this.audio.heartbeatElement.paused) {
        this.tryPlay(this.audio.heartbeatElement);
      }
    }
  }

  tryPlay(audioElement) {
    audioElement.play().catch(() => {});
  }

  stopAudio() {
    if (!this.audio) return;
    globalThis.clearTimeout(this.audio.thunderTimer);
    this.audio.rainElement?.pause();
    this.audio.heartbeatElement?.pause();
    this.audio = null;
  }

  async sendResultToChat() {
    const content = `
      <h2>Qi Zhong's Gecko Guardian</h2>
      <p>${this.resultText()}</p>
      <p><strong>Trust:</strong> ${this.state.trust}/8, <strong>Fed:</strong> ${this.state.hunger}/6, <strong>Alarm:</strong> ${this.state.alarm}/7, <strong>Coin Charge:</strong> ${this.state.charge}/6</p>
    `;

    if (globalThis.ChatMessage) {
      await ChatMessage.create({ content });
    } else {
      console.log(content);
    }
  }
}

let healingShrineGame;

function openHealingShrine() {
  healingShrineGame ??= new HealingShrineGame();
  healingShrineGame.open();
}

function closeMinigames() {
  healingShrineGame?.close();
}

function registerApi() {
  const api = {
    openHealingShrine,
    closeMinigames
  };

  globalThis.SeasonGhostsMinigames = api;
  const module = globalThis.game?.modules?.get(MODULE_ID);
  if (module) module.api = api;
}

if (globalThis.Hooks) {
  Hooks.once("ready", () => {
    registerApi();
    console.log(`${MODULE_ID} | Ready. Run SeasonGhostsMinigames.openHealingShrine() from a macro.`);
  });
} else {
  registerApi();
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-sog-open='healing-shrine']").forEach((button) => {
      button.addEventListener("click", () => openHealingShrine());
    });
  });
}
