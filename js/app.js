/* Projectile Motion Simulator: user interface and real-time canvas animation. */
(() => {
  const $ = (id) => document.getElementById(id);

  const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10];
  const MAX_PINNED = 8;
  const PIN_STORAGE_KEY = "projectile-sim:pinned";

  const state = {
    speed: 25,
    angle: 45,
    height: 0,
    g: Physics.G,
    planet: "Earth",
    playback: 1,
    showVectors: true,
    pinned: loadPinned(),
    traj: null,
    simTime: 0, // seconds since launch
    playing: false,
    lastFrame: null,
  };

  // --- Helpers ------------------------------------------------------------

  const fmt = (v, digits = 2) => (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
  const trim = (v) => String(+(+v).toFixed(3)); // 2.50 → "2.5"
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function loadPinned() {
    try {
      const saved = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY));
      return Array.isArray(saved) ? saved.slice(0, MAX_PINNED) : [];
    } catch {
      return [];
    }
  }

  function savePinned() {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(state.pinned));
    } catch {
      /* storage unavailable (private mode, file://); pins just won't persist */
    }
  }

  // --- Controls -----------------------------------------------------------

  /** Keep a range slider and its number box in sync, calling onChange with the value. */
  function bindNumber(key, onChange) {
    const slider = $(key);
    const box = $(`${key}-num`);
    const set = (raw, source) => {
      const v = clamp(parseFloat(raw), +slider.min, +slider.max);
      if (Number.isNaN(v)) return;
      if (source !== slider) slider.value = v;
      if (source !== box) box.value = trim(v);
      onChange(v);
    };
    slider.addEventListener("input", () => set(slider.value, slider));
    box.addEventListener("input", () => box.value !== "" && set(box.value, box));
    box.addEventListener("change", () => set(box.value === "" ? slider.value : box.value, null));
    return (v) => set(v, null);
  }

  /** Build a segmented radio control from a list of options. */
  function segmented(container, options, label, initial, onChange) {
    const buttons = options.map((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.textContent = label(opt);
      b.addEventListener("click", () => select(opt));
      container.append(b);
      return b;
    });
    function select(opt, silent = false) {
      buttons.forEach((b, i) => b.setAttribute("aria-checked", String(options[i] === opt)));
      if (!silent) onChange(opt);
    }
    select(initial, true);
    return select;
  }

  const setSpeed = bindNumber("speed", (v) => { state.speed = v; update(); });
  const setAngle = bindNumber("angle", (v) => { state.angle = v; update(); });
  const setHeight = bindNumber("height", (v) => { state.height = v; update(); });
  const setCustomG = bindNumber("gravity", (v) => { if (state.planet === "Custom") { state.g = v; update(); } });

  const planets = [...Object.keys(Physics.GRAVITY_PRESETS), "Custom"];
  const selectPlanet = segmented($("planet"), planets, (p) => p, state.planet, (p) => {
    state.planet = p;
    state.g = p === "Custom" ? +$("gravity").value : Physics.GRAVITY_PRESETS[p];
    if (p !== "Custom") setCustomG(state.g);
    $("custom-g-field").hidden = p !== "Custom";
    update();
  });
  $("custom-g-field").hidden = true;

  segmented($("playback"), PLAYBACK_SPEEDS, (s) => `${s}×`, state.playback, (s) => { state.playback = s; });

  $("show-vectors").addEventListener("change", (e) => {
    state.showVectors = e.target.checked;
    document.querySelectorAll(".vec-legend").forEach((el) => (el.hidden = !state.showVectors));
    draw();
  });

  $("pin").addEventListener("click", () => {
    const { speed, angle, height, g } = state;
    const exists = state.pinned.some((p) => p.speed === speed && p.angle === angle && p.height === height && p.g === g);
    if (!exists) {
      if (state.pinned.length >= MAX_PINNED) state.pinned.shift();
      state.pinned.push({ speed, angle, height, g });
      savePinned();
      update();
    }
  });

  $("clear-pins").addEventListener("click", () => {
    state.pinned = [];
    savePinned();
    update();
  });

  $("share").addEventListener("click", async () => {
    const button = $("share");
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(location.href);
      button.textContent = "✓ Link copied";
    } catch {
      window.prompt("Copy this link:", location.href);
    }
    setTimeout(() => (button.textContent = original), 1600);
  });

  // --- Playback -----------------------------------------------------------

  function play() {
    if (state.traj.flightTime <= 0) return;
    if (state.simTime >= state.traj.flightTime) state.simTime = 0;
    state.playing = true;
    state.lastFrame = null;
    requestAnimationFrame(tick);
    updatePlaybar();
  }

  function pause() {
    state.playing = false;
    updatePlaybar();
  }

  function tick(timestamp) {
    if (!state.playing) return;
    if (state.lastFrame !== null) {
      // Advance simulated time by real elapsed time × playback speed
      state.simTime += ((timestamp - state.lastFrame) / 1000) * state.playback;
    }
    state.lastFrame = timestamp;
    if (state.simTime >= state.traj.flightTime) {
      state.simTime = state.traj.flightTime;
      state.playing = false;
    }
    draw();
    updatePlaybar();
    if (state.playing) requestAnimationFrame(tick);
  }

  $("play").addEventListener("click", () => (state.playing ? pause() : play()));
  $("reset").addEventListener("click", () => {
    pause();
    state.simTime = 0;
    draw();
    updatePlaybar();
  });
  $("scrub").addEventListener("input", (e) => {
    pause();
    state.simTime = (e.target.value / 1000) * state.traj.flightTime;
    draw();
    updatePlaybar();
  });

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.target.closest("input, button, textarea, select, summary, a")) return;
    e.preventDefault();
    state.playing ? pause() : play();
  });

  function updatePlaybar() {
    const { simTime, traj, playing } = state;
    const done = traj.flightTime > 0 && simTime >= traj.flightTime;
    $("play").textContent = playing ? "⏸ Pause" : done ? "↻ Relaunch" : simTime > 0 ? "▶ Resume" : "▶ Launch";
    $("play").disabled = traj.flightTime <= 0;
    $("scrub").value = traj.flightTime > 0 ? Math.round((simTime / traj.flightTime) * 1000) : 0;
    $("time-label").textContent = `${fmt(simTime)} / ${fmt(traj.flightTime)} s`;
  }

  // --- Canvas drawing -----------------------------------------------------

  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  let colors = readColors();

  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const get = (name) => css.getPropertyValue(name).trim();
    return {
      grid: get("--c-grid"), axis: get("--c-axis"), ground: get("--c-ground"), text: get("--muted"),
      path: get("--c-path"), ball: get("--c-ball"), vx: get("--c-vx"), vy: get("--c-vy"),
      surface: get("--surface"),
      pinned: get("--c-pinned").split(",").map((c) => c.trim()),
    };
  }

  /** A round tick spacing (1, 2 or 5 × 10ⁿ) giving roughly `count` ticks over `span`. */
  function niceStep(span, count) {
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  }

  /** Map world metres to canvas pixels, with equal scale on both axes. */
  function computeView(width, height, trajectories) {
    const pad = { left: 48, right: 16, top: 14, bottom: 34 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const xNeed = Math.max(...trajectories.map((t) => t.range)) * 1.08 + 1;
    const yNeed = Math.max(...trajectories.map((t) => t.maxHeight)) * 1.2 + 1;
    const scale = Math.min(plotW / xNeed, plotH / yNeed);
    return {
      pad, plotW, plotH, scale,
      xSpan: plotW / scale,
      ySpan: plotH / scale,
      px: (x) => pad.left + x * scale,
      py: (y) => pad.top + plotH - y * scale,
    };
  }

  function drawGrid(view) {
    const { pad, plotW, plotH, px, py, xSpan, ySpan } = view;
    const step = niceStep(Math.max(xSpan, ySpan), 9);
    ctx.lineWidth = 1;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = colors.text;

    ctx.strokeStyle = colors.grid;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = 0; x <= xSpan + 1e-9; x += step) {
      const X = Math.round(px(x)) + 0.5;
      ctx.beginPath(); ctx.moveTo(X, pad.top); ctx.lineTo(X, pad.top + plotH); ctx.stroke();
      ctx.fillText(trim(x), X, pad.top + plotH + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = 0; y <= ySpan + 1e-9; y += step) {
      const Y = Math.round(py(y)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.left, Y); ctx.lineTo(pad.left + plotW, Y); ctx.stroke();
      ctx.fillText(trim(y), pad.left - 6, Y);
    }

    // Ground and vertical axis
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, py(0));
    ctx.lineTo(pad.left + plotW, py(0));
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("x (m)", pad.left + plotW, py(0) - 4);
    ctx.save();
    ctx.translate(pad.left + 12, pad.top + 4);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("y (m)", 0, 0);
    ctx.restore();
  }

  function strokePath(points, view, color, width, dash = []) {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(view.px(p.x), view.py(p.y)) : ctx.moveTo(view.px(p.x), view.py(p.y))));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function arrow(x0, y0, dx, dy, color) {
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const head = Math.min(10, len * 0.5);
    const ang = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + dx - head * 0.6 * Math.cos(ang), y0 + dy - head * 0.6 * Math.sin(ang));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + dx, y0 + dy);
    ctx.lineTo(x0 + dx - head * Math.cos(ang - 0.45), y0 + dy - head * Math.sin(ang - 0.45));
    ctx.lineTo(x0 + dx - head * Math.cos(ang + 0.45), y0 + dy - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  function label(text, x, y, align, color) {
    ctx.font = "600 11.5px system-ui, sans-serif";
    ctx.textAlign = align;
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 4;
    ctx.strokeStyle = colors.surface;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function draw() {
    const { traj, simTime } = state;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pinned = state.pinned.map((p) => Physics.solve(p.speed, p.angle, p.height, p.g));
    const view = computeView(width, height, [traj, ...pinned]);
    drawGrid(view);

    // Launch platform
    if (traj.height > 0) {
      ctx.fillStyle = colors.ground;
      ctx.fillRect(view.px(0) - 8, view.py(traj.height), 8, traj.height * view.scale);
    }

    pinned.forEach((t, i) => strokePath(t.sample(), view, colors.pinned[i % colors.pinned.length], 1.75));

    // Predicted path, peak and landing
    strokePath(traj.sample(), view, colors.path, 1.5, [2, 5]);
    if (traj.flightTime > 0) {
      const peak = traj.position(traj.timeToPeak);
      ctx.fillStyle = colors.path;
      const Px = view.px(peak.x), Py = view.py(traj.maxHeight);
      ctx.beginPath(); ctx.moveTo(Px, Py - 5); ctx.lineTo(Px - 5, Py + 4); ctx.lineTo(Px + 5, Py + 4); ctx.closePath(); ctx.fill();
      label(`peak ${fmt(traj.maxHeight, 1)} m`, Px, Py - 8, "center", colors.path);

      const Lx = view.px(traj.range), Ly = view.py(0);
      ctx.strokeStyle = colors.path;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(Lx - 5, Ly - 5); ctx.lineTo(Lx + 5, Ly + 5); ctx.moveTo(Lx + 5, Ly - 5); ctx.lineTo(Lx - 5, Ly + 5); ctx.stroke();
      if (traj.range > 0.5) label(`lands ${fmt(traj.range, 1)} m`, Lx - 8, Ly - 8, "right", colors.path);
    }

    // Path traced so far
    const n = Math.max(2, Math.ceil(150 * (traj.flightTime > 0 ? simTime / traj.flightTime : 0)));
    const trail = [];
    for (let i = 0; i < n; i++) {
      const p = traj.position((simTime * i) / (n - 1));
      trail.push({ x: p.x, y: Math.max(p.y, 0) });
    }
    strokePath(trail, view, colors.path, 3);

    // Projectile and velocity vectors
    const pos = traj.position(simTime);
    const vel = traj.velocity(simTime);
    const bx = view.px(pos.x), by = view.py(Math.max(pos.y, 0));
    if (state.showVectors && traj.speed > 0) {
      const k = (0.16 * Math.min(view.plotW, view.plotH)) / traj.speed; // pixels per m/s
      arrow(bx, by, vel.vx * k, 0, colors.vx);
      arrow(bx, by, 0, -vel.vy * k, colors.vy);
    }
    ctx.fillStyle = colors.ball;
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();

    $("readout").textContent =
      `t   = ${fmt(simTime).padStart(7)} s\n` +
      `x   = ${fmt(pos.x).padStart(7)} m\n` +
      `y   = ${fmt(Math.max(pos.y, 0)).padStart(7)} m\n` +
      `vx  = ${fmt(vel.vx).padStart(7)} m/s\n` +
      `vy  = ${fmt(vel.vy).padStart(7)} m/s`;
  }

  new ResizeObserver(() => draw()).observe(canvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    colors = readColors();
    draw();
  });

  // --- Results, tables and worked example --------------------------------

  function renderMetrics() {
    const { traj } = state;
    $("m-range").textContent = `${fmt(traj.range)} m`;
    $("m-height").textContent = `${fmt(traj.maxHeight)} m`;
    $("m-time").textContent = `${fmt(traj.flightTime)} s`;
    $("m-impact").textContent = `${fmt(traj.impactSpeed)} m/s`;
  }

  function renderPinned() {
    $("pinned-panel").hidden = state.pinned.length === 0;
    $("clear-pins").disabled = state.pinned.length === 0;
    const body = $("pinned-body");
    body.replaceChildren();
    state.pinned.forEach((p, i) => {
      const t = Physics.solve(p.speed, p.angle, p.height, p.g);
      const row = document.createElement("tr");
      const cells = [`${trim(p.speed)} m/s`, `${trim(p.angle)}°`, `${trim(p.height)} m`, `${trim(p.g)} m/s²`,
        `${fmt(t.range)} m`, `${fmt(t.maxHeight)} m`, `${fmt(t.flightTime)} s`];
      const dot = document.createElement("td");
      dot.innerHTML = `<span class="dot" style="background:${colors.pinned[i % colors.pinned.length]}"></span>`;
      row.append(dot, ...cells.map((c) => Object.assign(document.createElement("td"), { textContent: c })));
      const actions = document.createElement("td");
      const remove = Object.assign(document.createElement("button"), { type: "button", className: "secondary remove", textContent: "✕" });
      remove.setAttribute("aria-label", "Remove pinned trajectory");
      remove.addEventListener("click", () => { state.pinned.splice(i, 1); savePinned(); update(); });
      actions.append(remove);
      row.append(actions);
      body.append(row);
    });
  }

  function renderData() {
    const { traj } = state;
    const rows = [];
    for (let i = 0; i <= 20; i++) {
      const t = (traj.flightTime * i) / 20;
      const p = traj.position(t);
      const v = traj.velocity(t);
      rows.push(`<tr><td>${fmt(t, 3)}</td><td>${fmt(p.x, 3)}</td><td>${fmt(Math.max(p.y, 0), 3)}</td>` +
        `<td>${fmt(v.vx, 3)}</td><td>${fmt(v.vy, 3)}</td></tr>`);
    }
    $("data-body").innerHTML = rows.join("");
  }

  function tex(source, displayMode = true) {
    const el = document.createElement("div");
    if (window.katex) katex.render(source, el, { displayMode, throwOnError: false });
    else el.textContent = source;
    return el;
  }

  function renderExample() {
    const { speed, angle, height, g, traj } = state;
    const [v, a, h, gg] = [speed, angle, height, g].map(trim);
    const n = (x) => fmt(x, 3);
    $("example-intro").textContent = `With v₀ = ${v} m/s, θ = ${a}°, h = ${h} m and g = ${gg} m/s²:`;
    $("example").replaceChildren(
      tex(String.raw`v_{0x} = ${v}\cos ${a}^\circ = ${n(traj.v0x)}\ \text{m/s} \qquad v_{0y} = ${v}\sin ${a}^\circ = ${n(traj.v0y)}\ \text{m/s}`),
      tex(String.raw`y_{max} = ${h} + \frac{${n(traj.v0y)}^2}{2(${gg})} = ${n(traj.maxHeight)}\ \text{m} \qquad t_{peak} = \frac{${n(traj.v0y)}}{${gg}} = ${n(traj.timeToPeak)}\ \text{s}`),
      tex(String.raw`t_{flight} = \frac{${n(traj.v0y)} + \sqrt{${n(traj.v0y)}^2 + 2(${gg})(${h})}}{${gg}} = ${n(traj.flightTime)}\ \text{s}`),
      tex(String.raw`R = ${n(traj.v0x)} \times ${n(traj.flightTime)} = ${n(traj.range)}\ \text{m}`),
    );
  }

  // --- URL parameters (shareable links) ----------------------------------

  function readUrl() {
    const q = new URLSearchParams(location.search);
    if (q.has("v")) setSpeed(q.get("v"));
    if (q.has("a")) setAngle(q.get("a"));
    if (q.has("h")) setHeight(q.get("h"));
    if (q.has("g")) {
      const g = parseFloat(q.get("g"));
      const preset = Object.keys(Physics.GRAVITY_PRESETS).find((p) => Physics.GRAVITY_PRESETS[p] === g);
      setCustomG(g);
      selectPlanet(preset || "Custom");
    }
  }

  function writeUrl() {
    const q = new URLSearchParams({ v: trim(state.speed), a: trim(state.angle), h: trim(state.height), g: trim(state.g) });
    try {
      history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
    } catch {
      /* some browsers block replaceState on file:// */
    }
  }

  // --- Main update --------------------------------------------------------

  function update() {
    state.traj = Physics.solve(state.speed, state.angle, state.height, state.g);
    state.simTime = Math.min(state.simTime, state.traj.flightTime);
    renderMetrics();
    renderPinned();
    renderData();
    renderExample();
    updatePlaybar();
    draw();
    writeUrl();
  }

  if (window.renderMathInElement) {
    renderMathInElement($("math"), { throwOnError: false });
  }
  state.traj = Physics.solve(state.speed, state.angle, state.height, state.g);
  readUrl();
  update();
})();
