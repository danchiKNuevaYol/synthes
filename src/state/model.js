


export const WAVES = ['sine', 'triangle', 'square', 'noise'];
export const WAVE_TITLES = { sine: 'Синус', triangle: 'Треугольник', square: 'Прямоугольник', noise: 'Шум' };

export const NAMES_A = { sine: 'ГУЛ', triangle: 'ШЕЛЕСТ', square: 'ДРОЖЬ', noise: 'ВЕТЕР' };
export const NAMES_B = { sine: 'СВИСТ', triangle: 'ВОЛНА', square: 'ВИБРАЦИЯ', noise: 'РАСКАТ' };

export const TRACKS = [
  { id: 'drop',    name: 'Капля',   color: 'drop' },
  { id: 'click',   name: 'Щелчок',  color: 'click' },
  { id: 'crackle', name: 'Треск',   color: 'crackle' },
  { id: 'boom',    name: 'Раскат',  color: 'boom' },
];

const row = (...on) => Array.from({ length: 16 }, (_, i) => on.includes(i + 1));
const PAN = { a: 0.35, b: 0.65, drums: 0.5, fx: 0.4 };

export const SCENES = [
  {
    id: 'wind', name: 'Ветер', bpm: 78,
    a: { wave: 'noise', tune: 0.38, shape: 0.55, mod: 0.6, level: 0.8 },
    b: { wave: 'noise', tune: 0.23, texture: 0.25, mod: 0.2, level: 0.18 },
    fx: { delay: 0.25, reverb: 0.55, drive: 0, mod: 0.25 },
    mix: { a: 0.75, b: 0.5, drums: 0.3, fx: 0.6 },
    steps: [row(3, 12), row(), row(7, 15), row()],
  },
  {
    id: 'rain', name: 'Дождь', bpm: 110,
    a: { wave: 'noise', tune: 0.78, shape: 0.25, mod: 0.2, level: 0.7 },
    b: { wave: 'noise', tune: 0.65, texture: 0.15, mod: 0.25, level: 0.12 },
    fx: { delay: 0.15, reverb: 0.5, drive: 0, mod: 0.1 },
    mix: { a: 0.7, b: 0.3, drums: 0.65, fx: 0.55 },
    steps: [row(1, 4, 7, 10, 12, 15), row(3, 6, 9, 13, 16), row(2, 5, 8, 11, 14), row()],
  },
  {
    id: 'storm', name: 'Гроза', bpm: 70,
    a: { wave: 'noise', tune: 0.16, shape: 0.22, mod: 0.46, level: 0.76 },
    b: { wave: 'noise', tune: 0.08, texture: 0.8, mod: 0.5, level: 0.7 },
    fx: { delay: 0.2, reverb: 0.8, drive: 0.25, mod: 0.1 },
    mix: { a: 0.8, b: 0.65, drums: 0.5, fx: 0.8 },
    steps: [row(6, 14), row(), row(3, 4, 11), row(1, 9)],
  },
  {
    id: 'forest', name: 'Лес', bpm: 92,
    a: { wave: 'noise', tune: 0.42, shape: 0.36, mod: 0.35, level: 0.45 },
    b: { wave: 'sine', tune: 0.83, texture: 0.12, mod: 0.28, level: 0.48 },
    fx: { delay: 0.35, reverb: 0.6, drive: 0, mod: 0.35 },
    mix: { a: 0.65, b: 0.5, drums: 0.4, fx: 0.65 },
    steps: [row(5, 13), row(2, 4, 6, 8, 10, 12, 14, 16), row(7), row()],
  }
];

export const fromScene = (s) => ({
  scene: s.id,
  bpm: s.bpm,
  a: { ...s.a }, b: { ...s.b }, fx: { ...s.fx }, mix: { ...s.mix }, pan: { ...PAN },
  steps: s.steps.map((r) => [...r]),
});

export const initialState = () => fromScene(SCENES[0]);
