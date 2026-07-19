class TadiranRemoteCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) throw new Error("Tadiran Remote Card requires an entity");
    this.config = config;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return 9;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 4, max_columns: 12, rows: 9, min_rows: 7 };
  }

  static getStubConfig() {
    return { entity: "climate.tadiran_ac" };
  }

  _call(service, data = {}) {
    this._hass.callService("climate", service, {
      entity_id: this.config.entity,
      ...data,
    });
  }

  _state() {
    return this._hass?.states?.[this.config.entity];
  }

  _changeTemperature(delta) {
    const state = this._state();
    const current = Number(state.attributes.temperature ?? 24);
    const min = Number(state.attributes.min_temp ?? 16);
    const max = Number(state.attributes.max_temp ?? 32);
    this._call("set_temperature", {
      temperature: Math.max(min, Math.min(max, current + delta)),
    });
  }

  _changeFan(delta) {
    const state = this._state();
    const modes = state.attributes.fan_modes ?? ["auto", "low", "medium", "high"];
    const current = Math.max(0, modes.indexOf(state.attributes.fan_mode));
    this._call("set_fan_mode", {
      fan_mode: modes[(current + delta + modes.length) % modes.length],
    });
  }

  _bind() {
    this.shadowRoot.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (action === "power") {
          this._call(this._state().state === "off" ? "turn_on" : "turn_off");
        } else if (action === "mode") {
          const modes = ["cool", "dry", "fan_only", "heat"];
          const current = Math.max(0, modes.indexOf(this._state().state));
          this._call("set_hvac_mode", { hvac_mode: modes[(current + 1) % modes.length] });
        } else if (["heat", "cool", "dry", "fan_only"].includes(action)) {
          this._call("set_hvac_mode", { hvac_mode: action });
        } else if (action === "temp-up") {
          this._changeTemperature(1);
        } else if (action === "temp-down") {
          this._changeTemperature(-1);
        } else if (action === "fan-up") {
          this._changeFan(1);
        } else if (action === "fan-down") {
          this._changeFan(-1);
        } else if (action.startsWith("fan:")) {
          this._call("set_fan_mode", { fan_mode: action.slice(4) });
        } else if (action === "swing") {
          this._call("set_swing_mode", {
            swing_mode: this._state().attributes.swing_mode === "on" ? "off" : "on",
          });
        }
      });
    });
  }

  render() {
    if (!this.shadowRoot || !this._hass || !this.config) return;
    const state = this._state();
    if (!state) {
      this.shadowRoot.innerHTML = `<ha-card><div class="missing">Entity ${this.config.entity} not found</div></ha-card>`;
      return;
    }

    const mode = state.state;
    const powered = mode !== "off";
    const temperature = Math.round(Number(state.attributes.temperature ?? 24));
    const fan = state.attributes.fan_mode ?? "auto";
    const rememberedMode = mode === "off" ? "—" : mode.toUpperCase();
    const fanGlyphs = { auto: "AUTO", low: "▰", medium: "▰▰", high: "▰▰▰" };

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; --remote-red: #e4473f; --remote-blue: #2979c7; }
        ha-card { padding: 14px; background: transparent; box-shadow: none; }
        .remote {
          width: min(100%, 320px); margin: auto; box-sizing: border-box;
          padding: 22px 25px 25px; border-radius: 52px 52px 70px 70px;
          color: #252525; background: linear-gradient(145deg, #fafafa, #e7e7e7);
          border: 1px solid #d2d2d2;
          box-shadow: 0 12px 28px rgba(0,0,0,.22), inset 2px 2px 3px #fff;
          font-family: Arial, sans-serif;
        }
        button { font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; }
        .top { display: flex; justify-content: space-between; align-items: center; padding: 0 10px 13px; }
        .round {
          width: 50px; height: 50px; border-radius: 50%; border: 1px solid #bcbcbc;
          background: linear-gradient(#fff, #e8e8e8); font-weight: 700;
          box-shadow: 0 2px 4px rgba(0,0,0,.18); transition: transform .08s;
        }
        .round:active, .key:active, .pill:active { transform: translateY(1px); }
        .power { color: var(--remote-red); font-size: 27px; }
        .lcd {
          min-height: 150px; padding: 13px 16px; border-radius: 15px;
          background: linear-gradient(145deg, #aebbb0, #87958b);
          border: 5px solid #d6d6d6; box-shadow: inset 0 2px 7px rgba(0,0,0,.35);
          color: #26332c; text-shadow: 0 1px rgba(255,255,255,.2);
        }
        .lcd-top { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; }
        .temperature { text-align: center; font: 72px/1.05 "Courier New", monospace; letter-spacing: -8px; }
        .degree { font-size: 22px; vertical-align: top; letter-spacing: 0; }
        .lcd-bottom { display: flex; justify-content: space-between; align-items: end; min-height: 28px; font-size: 13px; }
        .fan-bars { letter-spacing: 2px; font-size: 12px; }
        .control-row { display: grid; grid-template-columns: 1fr 78px 1fr; gap: 10px; margin-top: 17px; }
        .rocker { display: grid; grid-template-rows: 44px 44px; overflow: hidden; border-radius: 24px; box-shadow: 0 2px 4px #aaa; }
        .key { border: 1px solid #bbb; background: linear-gradient(#fff, #e8e8e8); font-size: 25px; font-weight: 700; }
        .key:first-child { border-radius: 24px 24px 4px 4px; }
        .key:last-child { border-radius: 4px 4px 24px 24px; }
        .center-label { display: flex; flex-direction: column; justify-content: center; text-align: center; font-size: 12px; font-weight: 700; }
        .center-label strong { font-size: 25px; margin-top: 4px; }
        .mode-row { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 15px; }
        .pill { height: 48px; border-radius: 25px; border: 1px solid #bbb; background: linear-gradient(#fff, #e8e8e8); font-weight: 700; box-shadow: 0 2px 4px #bbb; }
        .pill.active.heat { color: var(--remote-red); box-shadow: inset 0 0 0 2px #efaaa5; }
        .pill.active.cool { color: var(--remote-blue); box-shadow: inset 0 0 0 2px #9bc4e9; }
        .pill.active.experimental { color: #765a16; box-shadow: inset 0 0 0 2px #d8bd70; }
        .fan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }
        .fan-key { height: 38px; border-radius: 20px; border: 1px solid #bbb; background: #f5f5f5; font-size: 12px; }
        .fan-key.active { background: #d9e2dc; box-shadow: inset 0 0 0 2px #89988e; font-weight: 700; }
        .brand { display: flex; justify-content: center; margin-top: 18px; }
        .brand img { width: 54px; height: 54px; object-fit: contain; }
        .offline { opacity: .5; }
        .missing { padding: 20px; color: var(--error-color); }
      </style>
      <ha-card>
        <div class="remote">
          <div class="top">
            <button class="round" data-action="mode">MODE</button>
            <button class="round power" data-action="power">⏻</button>
          </div>
          <div class="lcd ${powered ? "" : "offline"}">
            <div class="lcd-top"><span>${rememberedMode}</span><span>${powered ? "ON" : "OFF"}</span></div>
            <div class="temperature">${temperature}<span class="degree">°C</span></div>
            <div class="lcd-bottom"><span>FAN</span><span class="fan-bars">${fanGlyphs[fan] ?? fan}</span></div>
          </div>
          <div class="control-row">
            <div class="rocker">
              <button class="key" data-action="temp-up">+</button>
              <button class="key" data-action="temp-down">−</button>
            </div>
            <div class="center-label">TEMPERATURE<strong>°C</strong></div>
            <div class="rocker">
              <button class="key" data-action="fan-up">+</button>
              <button class="key" data-action="fan-down">−</button>
            </div>
          </div>
          <div class="mode-row">
            <button class="pill heat ${mode === "heat" ? "active" : ""}" data-action="heat">☀ HEAT</button>
            <button class="pill cool ${mode === "cool" ? "active" : ""}" data-action="cool">❄ COOL</button>
            <button class="pill experimental ${mode === "dry" ? "active" : ""}" data-action="dry">◆ DRY*</button>
            <button class="pill experimental ${mode === "fan_only" ? "active" : ""}" data-action="fan_only">◉ FAN*</button>
          </div>
          <div class="fan-grid">
            ${["auto", "low", "medium", "high"].map((value) => `
              <button class="fan-key ${fan === value ? "active" : ""}" data-action="fan:${value}">${value.toUpperCase()}</button>
            `).join("")}
          </div>
          <div class="fan-grid">
            <button class="fan-key ${state.attributes.swing_mode === "on" ? "active" : ""}" data-action="swing">SWING*</button>
            <div class="fan-key" style="display:flex;align-items:center;justify-content:center;border-style:dashed">* EXPERIMENTAL</div>
          </div>
          <div class="brand">
            <img src="/tadiran_dynamic/tadiran-icon.webp?v=0.2.1" alt="Smart air conditioner">
          </div>
        </div>
      </ha-card>`;
    this._bind();
  }
}

customElements.define("tadiran-remote-card", TadiranRemoteCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tadiran-remote-card",
  name: "Tadiran TAC-297H Remote",
  description: "Remote-style control for Tadiran Dynamic IR climate entities",
  preview: true,
  getEntitySuggestion: (_hass, entityId) => entityId.startsWith("climate.")
    ? { config: { type: "custom:tadiran-remote-card", entity: entityId } }
    : null,
});
