import { engine } from './audio/engine.js';
import { SCENES, WAVES, WAVE_TITLES, TRACKS, fromScene, initialState } from './state/model.js';
import { startDisplay } from './display.js';

let state = initialState();
let currentStep = -1;
let playing = false;
let recording = false;
let saving = false;
let hasTake = false;
let elapsed = 0;
const DW = 1490;
const DH = 608;
const root = document.getElementById('root');
const el = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
};
const append = (parent, ...children) => { children.forEach(child => parent.append(child)); return parent; };
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const patch = (group, key, value) => {
  state = { ...state, scene: group === 'mix' || group === 'pan' ? state.scene : null, [group]: { ...state[group], [key]: value } };
  engine.apply(state);
  updateScenes();
};
const updateSteps = callback => {
  state = { ...state, scene: null, steps: callback(state.steps) };
  engine.apply(state);
  updateScenes();
  updateGrid();
};
const panel = (title, color, extra = '') => {
  const section = el('section', `panel ${extra}`.trim());
  const heading = el('h2', 'panel__title');
  if (color) heading.append(el('i', `dot dot--${color}`));
  heading.append(document.createTextNode(title));
  const body = el('div', 'panel__body');
  append(section, heading, body);
  return { section, body };
};

const knobUpdates = [];
function knob({ value, onChange, label, hint, color = 'light', size = 56, def = 0.5, format }) {
  const wrap = el('div', `knob knob--${color}`);
  wrap.style.setProperty('--s', `${size}px`);
  const dial = el('div', 'knob__dial');
  dial.tabIndex = 0;
  dial.setAttribute('role', 'slider');
  dial.setAttribute('aria-label', hint || label || 'Регулятор');
  dial.setAttribute('aria-valuemin', '0');
  dial.setAttribute('aria-valuemax', '100');
  dial.title = hint || label || '';
  const cap = el('div', 'knob__cap');
  const tick = el('div', 'knob__tick');
  const bubble = el('span', 'knob__bubble');
  bubble.hidden = true;
  append(dial, cap, tick, bubble);
  wrap.append(dial);
  if (label) wrap.append(el('span', 'knob__label', label));
  let latest = value;
  let dragging = false;
  const render = v => {
    latest = v;
    tick.style.transform = `rotate(${-135 + 270 * v}deg)`;
    dial.setAttribute('aria-valuenow', Math.round(v * 100));
    bubble.textContent = format ? format(v) : `${Math.round(v * 100)}%`;
  };
  const change = v => { v = clamp(v); render(v); onChange(v); };
  const point = (event, first) => {
    const r = dial.getBoundingClientRect();
    const dx = event.clientX - r.left - r.width / 2;
    const dy = event.clientY - r.top - r.height / 2;
    if (Math.hypot(dx, dy) < r.width * 0.08) return;
    const a = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (a >= -135 && a <= 135) change((a + 135) / 270);
    else if (!first) change(latest >= 0.5 ? 1 : 0);
  };
  dial.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; dial.setPointerCapture(e.pointerId); bubble.hidden = false; point(e, true); });
  dial.addEventListener('pointermove', e => { if (dragging) point(e, false); });
  for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture']) dial.addEventListener(evt, () => { dragging = false; bubble.hidden = true; });
  dial.addEventListener('wheel', e => { e.preventDefault(); change(latest - Math.sign(e.deltaY) * 0.03); }, { passive: false });
  dial.addEventListener('dblclick', () => change(def));
  dial.addEventListener('keydown', e => {
    const steps = { ArrowUp: .02, ArrowRight: .02, ArrowDown: -.02, ArrowLeft: -.02 };
    if (Object.hasOwn(steps, e.key)) { e.preventDefault(); change(latest + steps[e.key]); }
    else if (e.key === 'Home') change(0);
    else if (e.key === 'End') change(1);
  });
  render(value);
  knobUpdates.push({ render });
  return { element: wrap, render };
}

const faderUpdates = [];
function fader(value, onChange, label, hint) {
  const wrap = el('div', 'fader');
  const track = el('div', 'fader__track');
  track.tabIndex = 0;
  track.setAttribute('role', 'slider');
  track.setAttribute('aria-orientation', 'vertical');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-label', hint || label);
  track.title = hint || label;
  const ticks = el('div', 'fader__ticks');
  for (let i = 0; i < 5; i++) ticks.append(el('i'));
  const thumb = el('div', 'fader__thumb');
  append(track, ticks, thumb);
  append(wrap, track, el('span', 'fader__label', label));
  let latest = value, dragging = false;
  const render = v => { latest = v; thumb.style.top = `${(1 - v) * 100}%`; track.setAttribute('aria-valuenow', Math.round(v * 100)); };
  const change = v => { v = clamp(v); render(v); onChange(v); };
  const fromY = e => { const r = track.getBoundingClientRect(); change(1 - (e.clientY - r.top) / r.height); };
  track.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; track.setPointerCapture(e.pointerId); fromY(e); });
  track.addEventListener('pointermove', e => { if (dragging) fromY(e); });
  for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture']) track.addEventListener(evt, () => { dragging = false; });
  track.addEventListener('wheel', e => { e.preventDefault(); change(latest - Math.sign(e.deltaY) * .04); }, { passive: false });
  track.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); change(latest + (e.key === 'ArrowUp' ? .04 : -.04)); } });
  render(value);
  faderUpdates.push({ render });
  return { element: wrap, render };
}

const icons = { sine: 'M3 13 C 9 -1, 15 -1, 20 13 S 31 27, 37 13', triangle: 'M4 20 L14 6 L26 20 L36 6', square: 'M4 19V7h14v12h14V7', noise: 'M3 13l3-5 3 10 3-13 3 17 3-15 3 13 3-11 3 12 3-8 3 6' };
const voiceRenders = [];
function voicePanel(id, title, color, labels) {
  const { section, body } = panel(title, color);
  const waves = el('div', 'waves');
  waves.setAttribute('role', 'radiogroup');
  waves.setAttribute('aria-label', 'Форма волны');
  const buttons = WAVES.map(w => {
    const button = el('button', 'key');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.title = WAVE_TITLES[w];
    button.innerHTML = `<svg viewBox="0 0 40 26" aria-hidden="true"><path d="${icons[w]}" /></svg>`;
    button.addEventListener('click', () => { patch(id, 'wave', w); renderWaves(); });
    waves.append(button);
    return button;
  });
  const renderWaves = () => buttons.forEach((button, i) => {
    const active = state[id].wave === WAVES[i];
    button.className = `key${active ? ` is-on key--${color}` : ''}`;
    button.setAttribute('aria-checked', String(active));
  });
  const knobs = el('div', 'knobs');
  const fields = ['tune', id === 'a' ? 'shape' : 'texture', 'mod', 'level'];
  const controls = fields.map((field, i) => knob({
    label: labels[i], value: state[id][field], color: i === 0 || i === 3 ? color : 'light',
    def: i === 3 ? .7 : .4, format: i === 0 && id === 'a' ? v => `${Math.round(40 * Math.pow(32, v))} Гц` : undefined,
    onChange: v => patch(id, field, v)
  }));
  controls.forEach(control => knobs.append(control.element));
  append(body, waves, knobs);
  renderWaves();
  voiceRenders.push(() => { renderWaves(); fields.forEach((field, i) => controls[i].render(state[id][field])); });
  return section;
}

const fxRenders = [];
function fxPanel() {
  const { section, body } = panel('ЭФФЕКТЫ · ПРОСТРАНСТВО', 'gray');
  const knobs = el('div', 'knobs knobs--fx');
  const cfg = [['delay', 'ЭХО', 'gray'], ['reverb', 'РЕВЕРБ', 'light'], ['drive', 'ДРАЙВ', 'dark'], ['mod', 'МОДУЛЯЦИЯ', 'light']];
  const controls = cfg.map(([key, label, color]) => knob({ label, color, value: state.fx[key], def: 0, onChange: v => patch('fx', key, v) }));
  controls.forEach(control => knobs.append(control.element));
  body.append(knobs);
  fxRenders.push(() => cfg.forEach(([key], i) => controls[i].render(state.fx[key])));
  return section;
}

let gridCells = [], gridNums = [];
function stepGrid() {
  const rhythm = el('div', 'rhythm');
  const grid = el('div', 'rhythm__grid');
  const numRow = el('div', 'rhythm__row rhythm__row--nums');
  numRow.append(el('span'));
  gridNums = Array.from({ length: 16 }, (_, i) => { const s = el('span', '', String(i + 1)); numRow.append(s); return s; });
  grid.append(numRow);
  gridCells = TRACKS.map((track, r) => {
    const row = el('div', 'rhythm__row');
    const label = el('span', 'rhythm__name');
    append(label, el('i', `dot dot--${track.color}`), document.createTextNode(track.name));
    row.append(label);
    const cells = Array.from({ length: 16 }, (_, i) => {
      const button = el('button', 'cell');
      button.type = 'button';
      button.setAttribute('aria-label', `${track.name}, шаг ${i + 1}`);
      button.addEventListener('click', () => updateSteps(rows => rows.map((data, ri) => ri === r ? data.map((v, ci) => ci === i ? !v : v) : data)));
      row.append(button);
      return button;
    });
    grid.append(row);
    return cells;
  });
  const side = el('div', 'rhythm__side');
  const sideButton = (text, title, handler) => { const btn = el('button', 'key key--small', text); btn.type = 'button'; btn.title = title; btn.addEventListener('click', handler); side.append(btn); };
  sideButton('•••', 'Случайный узор', () => updateSteps(() => [.32, .3, .26, .1].map(p => Array.from({ length: 16 }, () => Math.random() < p))));
  const shift = delta => updateSteps(rows => rows.map(row => row.map((_, i) => row[(i - delta + 16) % 16])));
  sideButton('‹', 'Сдвинуть влево', () => shift(-1));
  sideButton('›', 'Сдвинуть вправо', () => shift(1));
  sideButton('СБРОС', 'Очистить сетку', () => updateSteps(rows => rows.map(row => row.map(() => false))));
  append(rhythm, grid, side);
  return rhythm;
}
function updateGrid() {
  gridNums.forEach((el, i) => el.className = currentStep === i ? 'is-now' : '');
  gridCells.forEach((cells, r) => cells.forEach((button, i) => {
    const on = state.steps[r][i];
    button.className = `cell${on ? ` is-on cell--${TRACKS[r].color}` : ''}${i % 4 === 0 ? ' is-beat' : ''}${currentStep === i ? ' is-now' : ''}`;
    button.setAttribute('aria-pressed', String(on));
  }));
}

const mixerRenders = [];
function mixerPanel() {
  const { section, body } = panel('МИКШЕР', 'gray', 'panel--mixer');
  const channels = el('div', 'channels');
  const configs = [
    ['a', 'A', 'orange', 'Панорама синта A'], ['b', 'B', 'blue', 'Панорама синта B'],
    ['drums', 'ЧАСТИЦЫ', 'yellow', 'Панорама частиц'], ['fx', 'ЭФФЕКТЫ', 'gray', 'Время эхо']
  ];
  configs.forEach(([id, label, color, hint]) => {
    const channel = el('div', 'channel');
    const panControl = knob({ size: 34, color, value: state.pan[id], def: .5, hint, onChange: v => patch('pan', id, v) });
    const mixControl = fader(state.mix[id], v => patch('mix', id, v), label, `Громкость: ${label}`);
    append(channel, panControl.element, mixControl.element);
    channels.append(channel);
    mixerRenders.push(() => { panControl.render(state.pan[id]); mixControl.render(state.mix[id]); });
  });
  body.append(channels);
  return section;
}

let timer, recordButton, playButton, saveButton, recordDot, status;
function recordPanel() {
  const { section, body } = panel('ЗАПИСЬ', 'red', 'panel--record');
  recordButton = el('button', 'rec-pad');
  recordButton.type = 'button'; recordButton.title = 'Начать / закончить запись'; recordButton.setAttribute('aria-label', 'Запись');
  recordButton.append(el('span', 'rec-pad__btn'));
  recordButton.addEventListener('click', toggleRecording);
  const lcd = el('div', 'lcd');
  recordDot = el('i', 'lcd__dot');
  timer = el('b', '', '00:00');
  status = el('small', '', 'ГОТОВ К ЗАПИСИ');
  append(lcd, recordDot, timer, status);
  const transport = el('div', 'transport');
  const button = (sign, title, handler) => {
    const btn = el('button', 'key key--small', sign);
    btn.type = 'button'; btn.title = title;
    btn.addEventListener('click', handler);
    transport.append(btn);
    return btn;
  };
  playButton = button('▶', 'Запустить', play);
  button('■', 'Остановить', stop);
  saveButton = button('⭳', 'Скачать запись (WAV)', save);
  append(body, recordButton, lcd, transport);
  updateRecord();
  return section;
}
function updateRecord() {
  recordButton.classList.toggle('is-on', recording);
  recordDot.classList.toggle('is-on', recording);
  playButton.className = `key key--small${playing ? ' is-on key--orange' : ''}`;
  saveButton.disabled = !hasTake;
  timer.textContent = mmss(elapsed);
  status.textContent = recording ? 'ИДЁТ ЗАПИСЬ' : saving ? 'СОХРАНЕНИЕ…' : hasTake ? 'ЗАПИСЬ ГОТОВА' : 'ГОТОВ К ЗАПИСИ';
}
async function play() {
  try { await engine.play(); playing = true; updateRecord(); }
  catch (error) { console.error(error); alert(`Не удалось запустить звук: ${error.message}`); }
}
async function finishRec() {
  saving = true; recording = false; updateRecord();
  try { await engine.stopRec(); hasTake = Boolean(engine.take); }
  catch (error) { console.error(error); alert(`Ошибка записи: ${error.message}`); }
  finally { saving = false; updateRecord(); }
}
async function stop() {
  if (recording) await finishRec();
  engine.stop(); playing = false; currentStep = -1; updateRecord(); updateGrid();
}
async function toggleRecording() {
  if (recording) { await finishRec(); return; }
  if (saving) return;
  await play();
  if (!playing) return;
  try {
    if (engine.startRec()) { hasTake = false; elapsed = 0; recording = true; updateRecord(); }
  } catch (error) { console.error(error); alert(`Ошибка записи: ${error.message}`); }
}
function save() {
  if (!engine.take) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(engine.take);
  a.download = `ess-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
let sceneButtons = [];
function updateScenes() { sceneButtons.forEach(([s, btn]) => btn.classList.toggle('is-on', state.scene === s.id)); }
function loadScene(scene) {
  state = fromScene(scene);
  engine.apply(state);
  updateScenes(); updateGrid();
  voiceRenders.forEach(fn => fn());
  fxRenders.forEach(fn => fn());
  mixerRenders.forEach(fn => fn());
  bpmDisplay.textContent = state.bpm;
}
let bpmDisplay;
function main() {
  const stage = el('div', 'stage');
  const fit = el('div', 'fit');
  const device = el('main', 'device');
  const fitWindow = () => {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const scale = Math.min(1, (width - 32) / DW, (height - 32) / DH);
    const k = Math.max(0.65, scale);
    fit.style.width = `${DW * k}px`;
    fit.style.height = `${DH * k}px`;
    device.style.transform = `scale(${k})`;
  };
  fitWindow();
  window.addEventListener('resize', fitWindow);
  window.visualViewport?.addEventListener('resize', fitWindow);
  const head = el('header', 'head');
  const heading = el('h1', 'head__title', 'EXPERIMENTAL SOUND SYNTHESIZER');
  const scenes = el('nav', 'scenes');
  scenes.setAttribute('aria-label', 'Звуковые сцены');
  scenes.append(el('span', '', 'СЦЕНЫ'));
  sceneButtons = SCENES.map(s => {
    const btn = el('button', 'chip', s.name.toUpperCase());
    btn.type = 'button';
    btn.addEventListener('click', () => loadScene(s));
    scenes.append(btn);
    return [s, btn];
  });
  append(head, heading, scenes, el('p', 'head__sub', 'ГЕНЕРАТОР ИСКУССТВЕННЫХ ПРИРОДНЫХ СРЕД'));
  const row1 = el('div', 'row1');
  const displayPanel = el('section', 'panel panel--display');
  const display = el('div', 'display');
  const screen = el('div', 'display__screen');
  const tempo = el('div', 'display__tempo');
  const slower = el('button', '', '−'); slower.type = 'button'; slower.setAttribute('aria-label', 'Медленнее');
  const faster = el('button', '', '+'); faster.type = 'button'; faster.setAttribute('aria-label', 'Быстрее');
  bpmDisplay = el('b', '', String(state.bpm));
  function changeBpm(delta) { state = { ...state, bpm: clamp(state.bpm + delta, 40, 200) }; bpmDisplay.textContent = state.bpm; engine.apply(state); }
  slower.addEventListener('click', () => changeBpm(-2));
  faster.addEventListener('click', () => changeBpm(2));
  append(tempo, el('span', '', 'ТЕМП'), slower, bpmDisplay, faster);
  append(display, screen, tempo); displayPanel.append(display);
  append(row1,
    voicePanel('a', 'АТМОСФЕРА', 'orange', ['ТОН', 'ФОРМА', 'ДРЕЙФ', 'УРОВЕНЬ']),
    displayPanel,
    voicePanel('b', 'ЭЛЕМЕНТЫ', 'blue', ['ТОН', 'ФАКТУРА', 'ВИБРО', 'УРОВЕНЬ']),
    fxPanel()
  );
  const row2 = el('div', 'row2');
  const rhythm = panel('РИТМ · ЧАСТИЦЫ', 'yellow');
  rhythm.body.append(stepGrid());
  append(row2, rhythm.section, mixerPanel(), recordPanel());
  const foot = el('footer', 'foot');
  append(foot, el('span', '', 'ESS — 01'), el('span', '', 'ВЕБ-АУДИО ИНСТРУМЕНТ'));
  append(device, head, row1, row2, foot);
  append(fit, device); stage.append(fit); root.append(stage);
  engine.apply(state);
  updateScenes(); updateGrid();
  engine.onStep(i => { currentStep = i; updateGrid(); });
  startDisplay(screen, () => ({ state, step: currentStep, playing, recording }));
  setInterval(() => { if (recording) { elapsed = engine.recElapsed(); updateRecord(); } }, 200);
}
main();
