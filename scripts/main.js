const MODULE_ID = "season-of-ghosts-minigames";
const HEALING_SHRINE_STATE_SETTING = "healingShrineState";
const RIVER_RACE_STATE_SETTING = "riverRaceState";
const SOCKET_NAME = `module.${MODULE_ID}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const deepClone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#039;"
})[char]);

const riverObstacleTypes = {
  rock: { label: "Rock", icon: "ROCK" },
  log: { label: "Log", icon: "LOG" },
  ghost: { label: "Ghost Hands", icon: "GRAB" },
  lantern: { label: "Broken Lantern", icon: "LAMP" }
};

const riverMoves = {
  left: "Left",
  hold: "Hold",
  right: "Right",
  brace: "Brace",
  ramp: "Ramp"
};

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

  open({ state = null, intro = true } = {}) {
    this.close();
    this.syncState(state ?? this.getStoredState());
    this.state.introActive = intro;

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

  canControl() {
    return !this.canUseFoundryDialog() || Boolean(globalThis.game?.user?.isGM);
  }

  sharedState() {
    const { soundEnabled, introActive, ...shared } = this.state;
    return JSON.parse(JSON.stringify(shared));
  }

  getStoredState() {
    if (!this.canUseFoundryDialog() || !globalThis.game?.settings) return null;

    try {
      const stored = globalThis.game.settings.get(MODULE_ID, HEALING_SHRINE_STATE_SETTING);
      return stored && typeof stored === "object" && typeof stored.round === "number" ? stored : null;
    } catch (_error) {
      return null;
    }
  }

  syncState(state) {
    if (!state) return;

    const soundEnabled = this.state.soundEnabled;
    const introActive = this.state.introActive;
    this.state = {
      ...this.defaultState(),
      ...JSON.parse(JSON.stringify(state)),
      soundEnabled,
      introActive
    };
  }

  async commitSharedState() {
    if (!this.canUseFoundryDialog() || !globalThis.game?.user?.isGM) return;

    const state = this.sharedState();
    await globalThis.game.settings.set(MODULE_ID, HEALING_SHRINE_STATE_SETTING, state);
    globalThis.game.socket?.emit(SOCKET_NAME, {
      type: "healingShrineState",
      sender: globalThis.game.user.id,
      state
    });
  }

  broadcastOpenToPlayers() {
    if (!this.canUseFoundryDialog() || !globalThis.game?.user?.isGM) return;

    globalThis.game.socket?.emit(SOCKET_NAME, {
      type: "openHealingShrine",
      sender: globalThis.game.user.id,
      state: this.sharedState()
    });

    globalThis.ui?.notifications?.info("Qi Zhong's Gecko Guardian shown to players.");
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
    if (!this.canControl()) return;
    const soundEnabled = this.state.soundEnabled;
    this.stopAudio();
    this.state = this.defaultState();
    this.state.soundEnabled = soundEnabled;
    this.state.introActive = false;
    this.update();
    void this.commitSharedState();
    if (this.state.soundEnabled) this.startStormAudio();
  }

  render() {
    const { trust, hunger, alarm, charge, round, resolved, log, uses } = this.state;
    const result = this.resultText();
    const coinObtained = this.hasBlessedCoin();
    const canControl = this.canControl();
    const actionButtons = Object.entries(shrineActions)
      .map(([key, action]) => `<button type="button" data-action="${key}" ${!canControl || resolved || uses[key] <= 0 ? "disabled" : ""}>
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
            ${this.canUseFoundryDialog() && canControl ? `<button type="button" data-control="show">Show To Players</button>` : ""}
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
            ${!canControl ? `<p class="sog-viewer-note">GM controlled shared view</p>` : ""}

            <div class="sog-actions">
              ${actionButtons}
            </div>

            <footer class="sog-footer">
              <button type="button" data-control="reset" ${!canControl ? "disabled" : ""}>Reset</button>
              <button type="button" data-control="success" ${!canControl ? "disabled" : ""}>Mark Pacified</button>
              <button type="button" data-control="chat" ${!canControl ? "disabled" : ""}>Send To Chat</button>
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
        if (!this.canControl()) return;
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
    this.element.querySelector('[data-control="show"]')?.addEventListener("click", () => {
      this.playClick();
      this.broadcastOpenToPlayers();
    });
    this.element.querySelector('[data-control="success"]').addEventListener("click", () => {
      if (!this.canControl()) return;
      this.playClick();
      this.forceSuccess();
    });
    this.element.querySelector('[data-control="chat"]').addEventListener("click", () => {
      if (!this.canControl()) return;
      this.playClick();
      this.sendResultToChat();
    });
  }

  takeAction(actionKey) {
    if (!this.canControl()) return;
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
    void this.commitSharedState();
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
    if (!this.canControl()) return;
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
    void this.commitSharedState();
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

  receiveSharedState(state) {
    const wasBlessed = this.hasBlessedCoin();
    this.syncState(state);
    if (!wasBlessed && this.hasBlessedCoin()) {
      this.playConfirm();
      this.startHeartbeat();
    }
    this.update();
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
      this.startStormAudio();
      this.retryAmbientAudio();
    }, 3300);
  }

  startStormAudio() {
    if (this.state.introActive) return;
    const audio = this.ensureAudio();
    if (!audio || audio.rainElement) return;

    audio.rainElement = this.makeAudio("mixkit-heavy-storm-rain-loop-2400.wav", 0.46, true);
    this.tryPlay(audio.rainElement);
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

    audio.heartbeatElement = this.makeAudio("heartbeat-arcade-loop.wav", 0.72, true);
    this.tryPlay(audio.heartbeatElement);
  }

  retryAmbientAudio() {
    if (!this.state.soundEnabled) return;
    if (!this.state.introActive && !this.audio?.rainElement) {
      this.startStormAudio();
    } else if (this.audio?.rainElement?.paused) {
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

class RiverRaceGame {
  constructor() {
    this.state = this.defaultState();
    this.element = null;
    this.dialog = null;
    this.tickTimer = null;
    this.keyboardAttached = false;
    this.lastSentDirection = 0;
    this.boundKeyDown = (event) => this.handleKey(event, true);
    this.boundKeyUp = (event) => this.handleKey(event, false);
  }

  defaultState() {
    const length = 120;
    const lanes = 5;

    return {
      raceId: Date.now(),
      status: "lobby",
      tick: 0,
      lanes,
      length,
      viewport: 34,
      damagePerHit: 3,
      players: [],
      hazards: this.generateCourse(length, lanes),
      finishOrder: [],
      log: [
        "Blood-rain hammers the river. Broken planks bob in the current, ready to carry the brave and the poorly advised."
      ]
    };
  }

  canUseFoundryDialog() {
    return Boolean(globalThis.game && globalThis.Dialog);
  }

  canControlRace() {
    return !this.canUseFoundryDialog() || Boolean(globalThis.game?.user?.isGM);
  }

  currentUserId() {
    return globalThis.game?.user?.id ?? "local-user";
  }

  sharedState() {
    return deepClone(this.state);
  }

  getStoredState() {
    if (!this.canUseFoundryDialog() || !globalThis.game?.settings) return null;

    try {
      const stored = globalThis.game.settings.get(MODULE_ID, RIVER_RACE_STATE_SETTING);
      return stored && typeof stored === "object" && Array.isArray(stored.players) ? stored : null;
    } catch (_error) {
      return null;
    }
  }

  syncState(state) {
    if (!state) return;
    this.state = {
      ...this.defaultState(),
      ...deepClone(state)
    };
  }

  open({ state = null } = {}) {
    this.close();
    this.syncState(state ?? this.getStoredState());

    if (this.canUseFoundryDialog()) {
      this.openFoundryDialog();
      return;
    }

    const wrapper = document.createElement("section");
    wrapper.className = "sog-minigame sog-river-race";
    wrapper.innerHTML = this.render();
    document.body.appendChild(wrapper);
    this.element = wrapper;
    this.activateListeners();
  }

  openFoundryDialog() {
    this.dialog = new Dialog(
      {
        title: "Dawnstep River Race",
        content: `<section class="sog-minigame sog-river-race sog-foundry-window">${this.render()}</section>`,
        buttons: {},
        render: (html) => {
          const root = html[0]?.querySelector(".sog-minigame");
          if (!root) return;
          this.element = root;
          this.activateListeners();
        },
        close: () => {
          this.dialog = null;
          this.element = null;
        }
      },
      {
        classes: ["sog-foundry-app", "sog-river-app"],
        width: 1040,
        height: 760,
        resizable: true
      }
    );
    this.dialog.render(true);
  }

  close() {
    this.stopLoop();
    this.detachKeyboard();
    if (this.dialog) {
      const dialog = this.dialog;
      this.dialog = null;
      dialog.close();
    }
    document.querySelectorAll(".sog-river-race").forEach((el) => el.remove());
    this.element = null;
  }

  generateCourse(length, lanes) {
    const hazards = [];
    const types = Object.keys(riverObstacleTypes);

    for (let y = 12; y < length - 4; y += 6 + Math.floor(Math.random() * 5)) {
      const rampLane = Math.floor(Math.random() * lanes);
      hazards.push({ id: `ramp-${y}-${rampLane}`, type: "ramp", lane: rampLane, y });

      const blockedLanes = new Set();
      while (blockedLanes.size < Math.min(2 + Math.floor(Math.random() * 2), lanes - 1)) {
        const lane = Math.floor(Math.random() * lanes);
        if (lane !== rampLane) blockedLanes.add(lane);
      }

      for (const lane of blockedLanes) {
        const type = types[Math.floor(Math.random() * types.length)];
        hazards.push({ id: `${type}-${y}-${lane}`, type, lane, y });
      }
    }

    return hazards;
  }

  playerForUser(userId = this.currentUserId()) {
    return this.state.players.find((player) => player.userId === userId);
  }

  getJoinData() {
    if (!this.canUseFoundryDialog()) {
      return {
        userId: "local-user",
        userName: "Local Player",
        actorUuid: null,
        tokenUuid: null,
        name: "Local Hero",
        img: ""
      };
    }

    const user = globalThis.game.user;
    const token = globalThis.canvas?.tokens?.controlled?.find((controlledToken) => controlledToken?.actor);
    const actor = user.character ?? token?.actor;

    return {
      userId: user.id,
      userName: user.name,
      actorUuid: actor?.uuid ?? null,
      tokenUuid: token?.document?.uuid ?? null,
      name: actor?.name ?? user.name,
      img: actor?.img ?? user.avatar ?? ""
    };
  }

  submitCommand(command) {
    if (this.canControlRace()) {
      void this.applyCommand(command, this.currentUserId());
      return;
    }

    globalThis.game?.socket?.emit(SOCKET_NAME, {
      type: "riverRaceCommand",
      sender: this.currentUserId(),
      command
    });
  }

  async applyCommand(command, senderId) {
    if (!this.canControlRace()) return;

    if (command.type === "join") {
      this.joinRace(command.player);
    } else if (command.type === "steer") {
      this.setPlayerInput(senderId, command.direction);
    } else if (command.type === "start") {
      this.startRace();
    } else if (command.type === "reset") {
      this.stopLoop();
      this.state = this.defaultState();
    } else if (command.type === "show") {
      this.broadcastOpenToPlayers();
      return;
    } else if (command.type === "chat") {
      await this.sendResultToChat();
      return;
    }

    await this.commitSharedState();
    this.update();
  }

  joinRace(playerData) {
    if (this.state.status !== "lobby") return;
    if (this.state.players.some((player) => player.userId === playerData.userId)) return;

    const occupiedLanes = new Set(this.state.players.map((player) => player.lane));
    let lane = this.state.players.length % this.state.lanes;
    for (let index = 0; index < this.state.lanes; index += 1) {
      if (!occupiedLanes.has(index)) {
        lane = index;
        break;
      }
    }

    this.state.players.push({
      userId: playerData.userId,
      userName: playerData.userName,
      actorUuid: playerData.actorUuid,
      tokenUuid: playerData.tokenUuid,
      name: playerData.name,
      img: playerData.img,
      lane,
      laneX: lane,
      progress: 0,
      speed: 0.92 + Math.random() * 0.12,
      input: 0,
      hits: 0,
      damage: 0,
      finished: false,
      finishPlace: null,
      invulnerableUntil: 0,
      boostedUntil: 0,
      collidedHazards: []
    });
    this.state.log.push(`${playerData.name} grabs a plank and joins the crossing.`);
  }

  startRace() {
    if (this.state.players.length <= 0) {
      this.state.log.push("No racers are on the river yet.");
      return;
    }

    this.state.status = "running";
    this.state.tick = 0;
    this.state.players.forEach((player) => {
      player.progress = 0;
      player.laneX = player.lane;
      player.input = 0;
      player.hits = 0;
      player.damage = 0;
      player.finished = false;
      player.finishPlace = null;
      player.invulnerableUntil = 0;
      player.boostedUntil = 0;
      player.collidedHazards = [];
    });
    this.state.finishOrder = [];
    this.state.log.push("The current catches every plank at once. Steer with arrows or the buttons. Miss the ramps, meet the river.");
    this.startLoop();
  }

  setPlayerInput(userId, direction) {
    if (this.state.status !== "running") return;
    const player = this.playerForUser(userId);
    if (!player || player.finished) return;
    player.input = clamp(Number(direction) || 0, -1, 1);
  }

  startLoop() {
    if (!this.canControlRace() || this.tickTimer || this.state.status !== "running") return;

    this.tickTimer = globalThis.setInterval(() => {
      void this.tickRace();
    }, 120);
  }

  stopLoop() {
    globalThis.clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  async tickRace() {
    if (!this.canControlRace() || this.state.status !== "running") {
      this.stopLoop();
      return;
    }

    this.state.tick += 1;
    const notes = [];
    for (const player of this.state.players) {
      if (player.finished) continue;
      this.tickPlayer(player, notes);
    }

    if (notes.length > 0) this.state.log.push(...notes);
    this.checkFinish();

    if (this.state.status === "finished") {
      this.stopLoop();
      await this.commitSharedState();
    } else {
      this.broadcastSharedState({ persist: this.state.tick % 10 === 0 });
    }
    this.update();
  }

  tickPlayer(player, notes) {
    const steer = clamp(Number(player.input) || 0, -1, 1);
    const steerSpeed = 0.14;
    const oldProgress = player.progress;
    player.laneX = clamp(player.laneX + steer * steerSpeed, 0, this.state.lanes - 1);
    player.lane = Math.round(player.laneX);

    const boosted = this.state.tick < player.boostedUntil;
    const speed = player.speed + (boosted ? 0.48 : 0);
    player.progress = Math.min(this.state.length, player.progress + speed);

    const nearbyHazards = this.state.hazards.filter((hazard) =>
      hazard.y > oldProgress - 0.6 &&
      hazard.y <= player.progress + 0.8 &&
      Math.abs(hazard.lane - player.laneX) < 0.48
    );

    for (const hazard of nearbyHazards) {
      if (player.collidedHazards.includes(hazard.id)) continue;
      player.collidedHazards.push(hazard.id);

      if (hazard.type === "ramp") {
        player.boostedUntil = this.state.tick + 12;
        notes.push(`${player.name} catches a ramp and skips over a snarling patch of river.`);
        continue;
      }

      if (this.state.tick < player.invulnerableUntil) continue;
      player.hits += 1;
      player.damage += this.state.damagePerHit;
      player.invulnerableUntil = this.state.tick + 10;
      player.speed = Math.max(0.72, player.speed - 0.03);
      notes.push(`${player.name} hits ${riverObstacleTypes[hazard.type].label.toLowerCase()} for ${this.state.damagePerHit} damage.`);
    }
  }

  checkFinish() {
    for (const player of this.state.players) {
      if (!player.finished && player.progress >= this.state.length) {
        player.finished = true;
        player.finishPlace = this.state.finishOrder.length + 1;
        player.input = 0;
        this.state.finishOrder.push(player.userId);
        this.state.log.push(`${player.name} reaches the far bank in place ${player.finishPlace}.`);
      }
    }

    if (this.state.players.length > 0 && this.state.players.every((player) => player.finished)) {
      this.state.status = "finished";
      this.state.log.push("Everyone crashes onto the far bank. The Eternal Lantern waits through the rain.");
    }
  }

  broadcastSharedState({ persist = false } = {}) {
    const state = this.sharedState();
    if (persist && this.canUseFoundryDialog() && globalThis.game?.user?.isGM) {
      void globalThis.game.settings.set(MODULE_ID, RIVER_RACE_STATE_SETTING, state);
    }

    if (this.canUseFoundryDialog() && globalThis.game?.user?.isGM) {
      globalThis.game.socket?.emit(SOCKET_NAME, {
        type: "riverRaceState",
        sender: globalThis.game.user.id,
        state
      });
    }
  }

  async commitSharedState() {
    if (!this.canUseFoundryDialog() || !globalThis.game?.user?.isGM) return;

    const state = this.sharedState();
    await globalThis.game.settings.set(MODULE_ID, RIVER_RACE_STATE_SETTING, state);
    globalThis.game.socket?.emit(SOCKET_NAME, {
      type: "riverRaceState",
      sender: globalThis.game.user.id,
      state
    });
  }

  broadcastOpenToPlayers() {
    if (!this.canUseFoundryDialog() || !globalThis.game?.user?.isGM) return;

    globalThis.game.socket?.emit(SOCKET_NAME, {
      type: "openRiverRace",
      sender: globalThis.game.user.id,
      state: this.sharedState()
    });

    globalThis.ui?.notifications?.info("Dawnstep River Race shown to players.");
  }

  receiveSharedState(state) {
    this.syncState(state);
    if (this.canControlRace() && this.state.status === "running") this.startLoop();
    if (this.state.status !== "running") this.stopLoop();
    this.update();
  }

  update() {
    if (!this.element) return;
    this.element.innerHTML = this.render();
    this.activateListeners();
  }

  render() {
    const canControl = this.canControlRace();
    const currentPlayer = this.playerForUser();
    const isJoined = Boolean(currentPlayer);
    const canJoin = this.state.status === "lobby" && !isJoined;
    const statusLabel = this.state.status === "lobby"
      ? "Waiting for racers"
      : this.state.status === "running"
        ? "Live current"
        : "Finished";

    return `
      <div class="sog-window sog-river-window">
        <header class="sog-header">
          <div>
            <p class="sog-kicker">Dawnstep River</p>
            <h2>Blood-Rain River Race</h2>
          </div>
          <div class="sog-header-controls">
            ${canControl && this.canUseFoundryDialog() ? `<button type="button" data-river-control="show">Show To Players</button>` : ""}
            <button type="button" class="sog-icon-button" data-river-control="close" aria-label="Close">x</button>
          </div>
        </header>

        <div class="sog-river-layout">
          <section class="sog-river-board-wrap">
            <div class="sog-river-meta">
              <strong>${escapeHtml(statusLabel)}</strong>
              <span>${this.state.damagePerHit} damage per obstacle hit</span>
            </div>
            ${this.renderBoard()}
          </section>

          <aside class="sog-river-panel">
            <section class="sog-river-join">
              ${canJoin ? `<button type="button" data-river-control="join">Join Crossing</button>` : ""}
              ${isJoined ? `<p class="sog-viewer-note">You are riding as ${escapeHtml(currentPlayer.name)}</p>` : ""}
              ${!isJoined && !canJoin ? `<p class="sog-viewer-note">Watching the crossing</p>` : ""}
            </section>

            ${this.renderPlayerControls(currentPlayer)}
            ${this.renderGmControls(canControl)}
            ${this.renderStandings()}

            <section class="sog-log sog-river-log" aria-live="polite">
              ${this.state.log.slice(-5).map((entry) => `<p>${escapeHtml(entry)}</p>`).join("")}
            </section>
          </aside>
        </div>
      </div>
    `;
  }

  renderBoard() {
    const lead = Math.max(0, ...this.state.players.map((player) => player.progress));
    const camera = clamp(lead - 8, 0, Math.max(0, this.state.length - this.state.viewport));
    const visibleHazards = this.state.hazards.filter((hazard) => hazard.y >= camera && hazard.y <= camera + this.state.viewport);
    const finishTop = this.percentFromProgress(this.state.length, camera);

    return `
      <div class="sog-river-board sog-river-live" style="--lane-count: ${this.state.lanes};">
        <div class="sog-river-current" aria-hidden="true"></div>
        <div class="sog-river-bank left" aria-hidden="true"></div>
        <div class="sog-river-bank right" aria-hidden="true"></div>
        ${finishTop >= -8 && finishTop <= 108 ? `<div class="sog-river-finish" style="top: ${finishTop}%;">FAR BANK</div>` : ""}
        ${visibleHazards.map((hazard) => this.renderHazard(hazard, camera)).join("")}
        ${this.state.players.map((player) => this.renderRacer(player, camera)).join("")}
      </div>
    `;
  }

  percentFromProgress(progress, camera) {
    return 96 - ((progress - camera) / this.state.viewport) * 92;
  }

  lanePercent(laneX) {
    const width = 100 / this.state.lanes;
    return width * laneX + width / 2;
  }

  renderHazard(hazard, camera) {
    const top = this.percentFromProgress(hazard.y, camera);
    const left = this.lanePercent(hazard.lane);
    const label = hazard.type === "ramp" ? "RAMP" : riverObstacleTypes[hazard.type].icon;

    return `
      <span class="sog-river-hazard is-${hazard.type}" style="left: ${left}%; top: ${top}%;">
        ${label}
      </span>
    `;
  }

  renderRacer(player, camera) {
    const initials = player.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const left = this.lanePercent(player.laneX ?? player.lane);
    const top = player.finished ? 3 + (player.finishPlace ?? 1) * 4 : this.percentFromProgress(player.progress, camera);
    const classes = ["sog-river-racer"];
    if (this.state.tick < player.invulnerableUntil) classes.push("is-hit");
    if (this.state.tick < player.boostedUntil) classes.push("is-boosted");
    if (player.finished) classes.push("is-finished");

    return `
      <span class="${classes.join(" ")}" title="${escapeHtml(player.name)}" style="left: ${left}%; top: ${top}%;">
        ${player.img ? `<img src="${escapeHtml(player.img)}" alt="">` : `<b>${escapeHtml(initials)}</b>`}
        <i>${escapeHtml(player.name.split(/\s+/)[0])}</i>
      </span>
    `;
  }

  renderPlayerControls(player) {
    const disabled = !player || this.state.status !== "running" || player.finished;

    return `
      <section class="sog-river-controls">
        <h3>Steer</h3>
        <div class="sog-river-move-grid">
          <button type="button" data-river-steer="-1" ${disabled ? "disabled" : ""}>Steer Left</button>
          <button type="button" data-river-steer="1" ${disabled ? "disabled" : ""}>Steer Right</button>
          <button type="button" data-river-steer="0" ${disabled ? "disabled" : ""}>Straight</button>
        </div>
        <p class="sog-viewer-note">Arrow keys also steer while this window is open.</p>
      </section>
    `;
  }

  renderGmControls(canControl) {
    if (!canControl) return "";

    const startDisabled = this.state.status !== "lobby" || this.state.players.length <= 0;

    return `
      <section class="sog-river-gm">
        <h3>GM</h3>
        <div class="sog-river-move-grid">
          <button type="button" data-river-control="start" ${startDisabled ? "disabled" : ""}>Start</button>
          <button type="button" data-river-control="chat">Chat Results</button>
          <button type="button" data-river-control="reset">Reset</button>
        </div>
      </section>
    `;
  }

  renderStandings() {
    const players = [...this.state.players].sort((a, b) => {
      if (a.finished && b.finished) return a.finishPlace - b.finishPlace;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });

    if (players.length <= 0) {
      return `<section class="sog-river-standings"><h3>Racers</h3><p>No one has joined yet.</p></section>`;
    }

    return `
      <section class="sog-river-standings">
        <h3>Racers</h3>
        ${players.map((player) => `
          <div class="sog-river-standing">
            <span>${player.finishPlace ? `${player.finishPlace}. ` : ""}${escapeHtml(player.name)}</span>
            <strong>${Math.floor(player.progress)}/${this.state.length}</strong>
            <small>${player.hits} hits, ${player.damage} dmg${player.input < 0 ? ", left" : player.input > 0 ? ", right" : ""}</small>
          </div>
        `).join("")}
      </section>
    `;
  }

  activateListeners() {
    this.attachKeyboard();
    this.element.querySelector('[data-river-control="close"]')?.addEventListener("click", () => this.close());
    this.element.querySelector('[data-river-control="join"]')?.addEventListener("click", () => {
      this.submitCommand({ type: "join", player: this.getJoinData() });
    });
    this.element.querySelector('[data-river-control="show"]')?.addEventListener("click", () => {
      this.submitCommand({ type: "show" });
    });
    this.element.querySelector('[data-river-control="start"]')?.addEventListener("click", () => {
      this.submitCommand({ type: "start" });
    });
    this.element.querySelector('[data-river-control="reset"]')?.addEventListener("click", () => {
      this.submitCommand({ type: "reset" });
    });
    this.element.querySelector('[data-river-control="chat"]')?.addEventListener("click", () => {
      this.submitCommand({ type: "chat" });
    });
    this.element.querySelectorAll("[data-river-steer]").forEach((button) => {
      const direction = Number(button.dataset.riverSteer);
      button.addEventListener("click", () => {
        this.sendSteer(direction);
      });
    });
  }

  attachKeyboard() {
    if (this.keyboardAttached) return;
    globalThis.addEventListener?.("keydown", this.boundKeyDown);
    globalThis.addEventListener?.("keyup", this.boundKeyUp);
    this.keyboardAttached = true;
  }

  detachKeyboard() {
    if (!this.keyboardAttached) return;
    globalThis.removeEventListener?.("keydown", this.boundKeyDown);
    globalThis.removeEventListener?.("keyup", this.boundKeyUp);
    this.keyboardAttached = false;
  }

  handleKey(event, pressed) {
    if (!this.element || this.state.status !== "running") return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "a" && event.key !== "d") return;

    event.preventDefault();
    if (!pressed) {
      this.sendSteer(0);
      return;
    }

    this.sendSteer(event.key === "ArrowLeft" || event.key === "a" ? -1 : 1);
  }

  sendSteer(direction) {
    const normalized = clamp(Number(direction) || 0, -1, 1);
    if (normalized === this.lastSentDirection && this.state.status === "running") return;
    this.lastSentDirection = normalized;
    this.submitCommand({ type: "steer", direction: normalized });
  }

  async sendResultToChat() {
    const rows = [...this.state.players]
      .sort((a, b) => (a.finishPlace ?? 999) - (b.finishPlace ?? 999) || b.progress - a.progress)
      .map((player) => `<li>${escapeHtml(player.finishPlace ? `${player.finishPlace}. ` : "")}${escapeHtml(player.name)}: ${player.hits} hits, ${player.damage} damage</li>`)
      .join("");

    const content = `
      <h2>Blood-Rain River Race</h2>
      <p>Obstacle hits deal ${this.state.damagePerHit} damage each unless braced.</p>
      <ol>${rows}</ol>
    `;

    if (globalThis.ChatMessage) {
      await ChatMessage.create({ content });
    } else {
      console.log(content);
    }
  }
}

let healingShrineGame;
let riverRaceGame;

function openHealingShrine(options = {}) {
  healingShrineGame ??= new HealingShrineGame();
  healingShrineGame.open(options);
}

function openRiverRace(options = {}) {
  riverRaceGame ??= new RiverRaceGame();
  riverRaceGame.open(options);
}

function closeMinigames() {
  healingShrineGame?.close();
  riverRaceGame?.close();
}

function registerSettings() {
  globalThis.game?.settings?.register(MODULE_ID, HEALING_SHRINE_STATE_SETTING, {
    name: "Qi Zhong Gecko Guardian shared state",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  globalThis.game?.settings?.register(MODULE_ID, RIVER_RACE_STATE_SETTING, {
    name: "Dawnstep River Race shared state",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

function registerSocket() {
  globalThis.game?.socket?.on(SOCKET_NAME, (message) => {
    if (!message || message.sender === globalThis.game?.user?.id) return;

    if (message.type === "openHealingShrine") {
      openHealingShrine({ state: message.state, intro: true });
      return;
    }

    if (message.type === "healingShrineState") {
      healingShrineGame ??= new HealingShrineGame();
      healingShrineGame.receiveSharedState(message.state);
      return;
    }

    if (message.type === "openRiverRace") {
      openRiverRace({ state: message.state });
      return;
    }

    if (message.type === "riverRaceState") {
      riverRaceGame ??= new RiverRaceGame();
      riverRaceGame.receiveSharedState(message.state);
      return;
    }

    if (message.type === "riverRaceCommand" && globalThis.game?.user?.isGM) {
      if (!riverRaceGame) {
        riverRaceGame = new RiverRaceGame();
        riverRaceGame.syncState(riverRaceGame.getStoredState());
      }
      void riverRaceGame.applyCommand(message.command, message.sender);
    }
  });
}

function registerApi() {
  const api = {
    openHealingShrine,
    openRiverRace,
    closeMinigames
  };

  globalThis.SeasonGhostsMinigames = api;
  const module = globalThis.game?.modules?.get(MODULE_ID);
  if (module) module.api = api;
}

if (globalThis.Hooks) {
  Hooks.once("init", () => {
    registerSettings();
  });

  Hooks.once("ready", () => {
    registerApi();
    registerSocket();
    console.log(`${MODULE_ID} | Ready. Run SeasonGhostsMinigames.openHealingShrine() or SeasonGhostsMinigames.openRiverRace() from a macro.`);
  });
} else {
  registerApi();
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-sog-open='healing-shrine']").forEach((button) => {
      button.addEventListener("click", () => openHealingShrine());
    });
    document.querySelectorAll("[data-sog-open='river-race']").forEach((button) => {
      button.addEventListener("click", () => openRiverRace());
    });
  });
}
