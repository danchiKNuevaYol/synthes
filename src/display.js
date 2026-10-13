import p5 from 'p5';
import { engine } from './audio/engine.js';
import { NAMES_A, NAMES_B, TRACKS } from './state/model.js';

const W = 424, H = 224;
const COLORS = { orange: [154, 170, 120], blue: [71, 118, 91], yellow: [192, 205, 105], gray: [176, 174, 170] };
const FFT_BINS = [0, 1, 2, 3, 4, 6, 8, 10, 13, 17, 22, 28];
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function makeSketch(live) {
  return (p) => {
    const histA = new Array(46).fill(0.03);
    const histB = new Array(46).fill(0.03);

    p.setup = () => {
      p.createCanvas(W, H);
      p.frameRate(30);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      const font = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
      if (font) p.textFont(font);
    };

    p.draw = () => {
      const { state, step, playing, recording } = live.current;
      const sc = playing ? engine.scope() : null;
      p.background(6, 7, 9);

      histA.push(sc ? Math.min(1, sc.a * 6) : 0.03); histA.shift();
      histB.push(sc ? Math.min(1, sc.b * 6) : 0.03); histB.shift();

      p.noStroke();
      p.textStyle(p.BOLD);
      p.textSize(12);
      p.fill(playing ? 255 : 120);
      p.triangle(14, 17, 14, 31, 26, 24);
      p.textAlign(p.LEFT, p.CENTER);
      p.fill(...COLORS.orange); p.text(`A: ${NAMES_A[state.a.wave]}`, 40, 25);
      p.fill(...COLORS.blue);   p.text(`B: ${NAMES_B[state.b.wave]}`, 138, 25);
      p.fill(...COLORS.yellow); p.text('ЧАСТИЦЫ', 238, 25);
      if (recording) {
        if (p.frameCount % 30 < 20) { p.fill(224, 72, 56); p.circle(W - 112, 25, 10); }
        p.fill(235); p.text(`ЗАП ${mmss(engine.recElapsed())}`, W - 100, 25);
      }

      const cy = 98, pitch = 3.4;
      p.rectMode(p.CENTER);
      for (let i = 0; i < 46; i++) {
        const j = Math.sin(i * 1.7 + p.frameCount * 0.35) * 0.18 + 0.82;
        p.fill(...COLORS.orange); p.rect(16 + i * pitch, cy, 2, 3 + histA[i] * 84 * j);
        p.fill(...COLORS.blue);   p.rect(16 + (46 + i) * pitch, cy, 2, 3 + histB[i] * 84 * j);
      }
      p.stroke(70); p.strokeWeight(1); p.line(16 + 46 * pitch - 1, 52, 16 + 46 * pitch - 1, 144); p.noStroke();
      FFT_BINS.forEach((bin, i) => {
        const db = sc ? sc.fft[bin] : -100;
        const v = Math.min(1, Math.max(0, (db + 95) / 65));
        if (i >= FFT_BINS.length - 2) p.fill(...COLORS.yellow); else p.fill(232);
        p.rect(346 + i * 6.6, 144 - (3 + v * 84) / 2, 5, 3 + v * 84);
      });

      for (let i = 0; i < 16; i++) {
        const r = state.steps.findIndex((row) => row[i]);
        const x = 16 + i * 23, now = step === i;
        if (r < 0) p.fill(now ? 120 : 42, now ? 124 : 48, now ? 128 : 52);
        else p.fill(...COLORS[TRACKS[r].color].map((c) => (now ? 255 : c * 0.62)));
        p.rectMode(p.CORNER);
        p.rect(x, 164, 17, 12, 2);
        if (now) { p.stroke(255, 165, 95); p.strokeWeight(1.5); p.line(x + 8.5, 152, x + 8.5, 188); p.noStroke(); }
      }

      p.textStyle(p.NORMAL); p.textSize(11); p.textAlign(p.LEFT, p.CENTER);
      p.fill(130); p.triangle(16, 200, 16, 210, 24, 205); p.text('ШАГ', 32, 205);
      p.fill(235); p.text(step >= 0 ? `${String(step + 1).padStart(2, '0')}/16` : '--/16', 68, 205);
      if (!playing) {
        p.textAlign(p.CENTER, p.CENTER); p.textSize(12);
        p.fill(255, 255, 255, 90 + 90 * Math.sin(p.frameCount * 0.12));
        p.text('НАЖМИТЕ ▶ ДЛЯ ЗАПУСКА', W / 2, 122);
      }
    };
  };
}

export function startDisplay(host, getLive) {
  const live = { current: getLive() };
  const instance = new p5(makeSketch(live), host);
  const originalDraw = instance.draw.bind(instance);
  instance.draw = () => { live.current = getLive(); originalDraw(); };
  return () => instance.remove();
}
