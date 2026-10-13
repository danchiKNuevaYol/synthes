







import * as Tone from 'tone';
import { encodeWav } from './wav.js';

const expo = (a, b, t) => a * Math.pow(b / a, t);
const lerp = (a, b, t) => a + (b - a) * t;
const fader = (v) => v * v * 1.4;                 // положение фейдера → усиление
const rms = (arr) => { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]; return Math.sqrt(s / arr.length); };

class Engine {
  ready = false;
  playing = false;
  recording = false;
  take = null;            // последняя запись (WAV Blob)
  step = -1;
  stepIndex = 0;
  state = null;
  stepListeners = new Set();
  recStartedAt = 0;
  initPromise = null;

  
  init() {
    this.initPromise ||= this.#init();
    return this.initPromise;
  }

  async #init() {
    await Tone.start();

    this.master = new Tone.Gain(0);
    this.limiter = new Tone.Limiter(-1);
    this.master.connect(this.limiter);
    this.limiter.toDestination();
    this.recorder = new Tone.Recorder();
    this.limiter.connect(this.recorder);
    this.fft = new Tone.FFT(32);
    this.limiter.connect(this.fft);

    this.bus = new Tone.Gain(1);
    this.drive = new Tone.Distortion({ distortion: 0.7, wet: 0 });
    this.mod = new Tone.Chorus({ frequency: 1.6, delayTime: 3.5, depth: 0.7, wet: 0 }).start();
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.3, feedback: 0.45, wet: 0 });
    this.reverb = new Tone.Reverb({ decay: 5, wet: 0 });
    this.bus.chain(this.drive, this.mod, this.delay, this.reverb, this.master);
    await this.reverb.generate();

    const A = (this.A = {});
    A.noise = new Tone.Noise('pink').start();
    A.osc = new Tone.Oscillator({ type: 'sine', frequency: 120 }).start();
    A.noiseGain = new Tone.Gain(1);
    A.oscGain = new Tone.Gain(0);
    A.filter = new Tone.Filter({ type: 'lowpass', frequency: 600, Q: 0.7 });
    A.motion = new Tone.Gain(0.75);
    A.breeze = new Tone.LFO({ frequency: 0.13, min: 0.48, max: 0.95 }).start();
    A.level = new Tone.Gain(0);
    A.pan = new Tone.Panner(0);
    A.scope = new Tone.Waveform(128);
    A.lfo = new Tone.LFO({ frequency: 0.2, min: -1200, max: 1200, amplitude: 0.5 }).start();
    A.noise.connect(A.noiseGain);
    A.osc.connect(A.oscGain);
    A.noiseGain.connect(A.filter);
    A.oscGain.connect(A.filter);
    A.filter.chain(A.motion, A.level, A.pan, this.bus);
    A.breeze.connect(A.motion.gain);
    A.pan.connect(A.scope);
    A.lfo.connect(A.filter.detune);

    const B = (this.B = {});
    B.osc = new Tone.Oscillator({ type: 'sine', frequency: 440 }).start();
    B.noise = new Tone.Noise('white').start();
    B.oscGain = new Tone.Gain(1);
    B.noiseGain = new Tone.Gain(0);
    B.filter = new Tone.Filter({ type: 'lowpass', frequency: 1800, Q: 1 });
    B.trem = new Tone.Gain(0);
    B.level = new Tone.Gain(0);
    B.pan = new Tone.Panner(0);
    B.scope = new Tone.Waveform(128);
    B.vib = new Tone.LFO({ frequency: 5, min: -100, max: 100, amplitude: 0 }).start();

    B.osc.connect(B.oscGain);
    B.noise.connect(B.noiseGain);
    B.oscGain.connect(B.filter);
    B.noiseGain.connect(B.filter);
    B.filter.chain(B.trem, B.level, B.pan, this.bus);
    B.pan.connect(B.scope);
    B.vib.connect(B.osc.detune);

    this.bBase = 440;
    this.bRange = 0.4;

    this.elementTimer = setInterval(() => {
      if (!this.playing || !this.state) return;
      const isNoise = this.state.b.wave === 'noise';
      const change = this.state.b.mod;
      const length = isNoise ? 1.2 + Math.random() * 1.7 : 0.09 + Math.random() * 0.16;
      const loudness = isNoise ? 0.35 + Math.random() * 0.4 : 0.25 + Math.random() * 0.5;
      const base = this.bBase * (0.85 + Math.random() * 0.3);
      B.osc.frequency.rampTo(base, 0.025);
      if (!isNoise) B.osc.frequency.rampTo(base * (1.07 + change * 0.25), length * 0.65);
      B.trem.gain.rampTo(loudness, isNoise ? 0.35 : 0.015);
      B.trem.gain.rampTo(0, length * 0.65, `+${length}`);
    }, 600);

    const D = (this.D = {});
    D.level = new Tone.Gain(1);
    D.pan = new Tone.Panner(0);
    D.drop = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 } });
    D.dropFilter = new Tone.Filter({ type: 'bandpass', frequency: 1700, Q: 0.8 });
    D.click = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 } });
    D.clickHp = new Tone.Filter(2600, 'highpass');
    D.crackle = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } });
    D.crackleHp = new Tone.Filter(4500, 'highpass');
    D.boom = new Tone.MembraneSynth({ pitchDecay: 0.55, octaves: 1.6, envelope: { attack: 0.08, decay: 1.4, sustain: 0, release: 0.7 } });
    D.thunder = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.12, decay: 2.1, sustain: 0, release: 0.6 } });
    D.thunderLow = new Tone.Filter({ type: 'lowpass', frequency: 170, Q: 0.5 });
    D.drop.volume.value = -18;
    D.click.volume.value = -12;
    D.crackle.volume.value = -14;
    D.boom.volume.value = -9;
    D.thunder.volume.value = -12;
    D.drop.chain(D.dropFilter, D.level);
    D.click.chain(D.clickHp, D.level);
    D.crackle.chain(D.crackleHp, D.level);
    D.boom.connect(D.level);
    D.thunder.chain(D.thunderLow, D.level);
    D.level.chain(D.pan, this.bus);

    Tone.getTransport().scheduleRepeat((time) => this.#tick(time), '16n');

    this.ready = true;
    if (this.state) this.apply(this.state);
  }

  #tick(time) {
    const i = this.stepIndex;
    this.stepIndex = (i + 1) % 16;
    const s = this.state && this.state.steps;
    if (s) {
      const v = () => 0.5 + Math.random() * 0.5;
      if (s[0][i]) {
        this.D.dropFilter.frequency.setValueAtTime(1000 + Math.random() * 3600, time);
        this.D.drop.triggerAttackRelease('32n', time, v() * 0.7);
      }
      if (s[1][i]) this.D.click.triggerAttackRelease('64n', time, v());
      if (s[2][i]) {
        this.D.crackle.triggerAttackRelease('64n', time, v());
        this.D.crackle.triggerAttackRelease('64n', time + 0.03 + Math.random() * 0.05, v() * 0.7);
      }
      if (s[3][i]) {
        this.D.boom.triggerAttackRelease('C1', '4n', time, v() * 0.55);
        this.D.thunder.triggerAttackRelease('2n', time, v() * 0.75);
      }
    }
    Tone.getDraw().schedule(() => {
      this.step = i;
      this.stepListeners.forEach((fn) => fn(i));
    }, time);
  }

  
  apply(st) {
    this.state = st;
    if (!this.ready) return;
    const { a, b, fx, mix, pan, bpm } = st;
    const { A, B, D } = this;
    Tone.getTransport().bpm.rampTo(bpm, 0.2);

    const fA = expo(40, 1280, a.tune);
    const noiseA = a.wave === 'noise';
    if (!noiseA) A.osc.type = a.wave;
    A.osc.frequency.rampTo(fA, 0.15);
    A.oscGain.gain.rampTo(noiseA ? 0 : 0.55, 0.15);
    A.noiseGain.gain.rampTo(noiseA ? 1 : 0, 0.15);
    A.filter.type = 'lowpass';
    A.filter.frequency.rampTo(noiseA ? 150 + a.tune * 1800 + a.shape * 950 : Math.min(4200, fA * (1.4 + a.shape * 3)), 0.15);
    A.filter.Q.rampTo(0.65 + a.shape * 0.6, 0.15);
    A.breeze.frequency.rampTo(0.045 + a.mod * 0.3, 0.2);
    A.breeze.min = 0.42 - a.mod * 0.2;
    A.breeze.max = 0.86 + a.mod * 0.12;
    A.lfo.amplitude.rampTo(a.mod * 0.22, 0.2);
    A.lfo.frequency.rampTo(0.07 + a.mod * 2.2, 0.2);
    A.level.gain.rampTo(a.level * a.level * (noiseA ? 0.75 : 0.45) * fader(mix.a), 0.08);
    A.pan.pan.rampTo(pan.a * 2 - 1, 0.1);

    this.bBase = expo(60, 2400, b.tune);
    this.bRange = 0.12 + b.texture * 0.8;
    const noiseB = b.wave === 'noise';
    if (!noiseB) B.osc.type = b.wave;
    B.osc.frequency.rampTo(this.bBase, 0.2);
    B.oscGain.gain.rampTo(noiseB ? 0 : 1, 0.15);
    B.noiseGain.gain.rampTo(noiseB ? 1 : b.texture * 0.5, 0.15);
    B.filter.type = 'lowpass';
    B.filter.frequency.rampTo(noiseB ? 130 + b.tune * 500 : Math.min(6500, this.bBase * (1.5 + b.texture * 3)), 0.2);
    B.filter.Q.rampTo(0.7 + b.texture * 1.5, 0.2);
    B.vib.amplitude.rampTo(b.mod, 0.2);
    B.vib.frequency.rampTo(2 + b.mod * 8, 0.2);

    B.level.gain.rampTo(b.level * b.level * (noiseB ? 0.8 : 0.55) * fader(mix.b), 0.08);
    B.pan.pan.rampTo(pan.b * 2 - 1, 0.1);

    D.level.gain.rampTo(fader(mix.drums), 0.05);
    D.pan.pan.rampTo(pan.drums * 2 - 1, 0.1);

    const k = Math.min(1, mix.fx * 1.4);
    this.delay.wet.rampTo(fx.delay * k * 0.8, 0.1);
    this.delay.delayTime.rampTo(lerp(0.08, 0.65, pan.fx), 0.1);
    this.reverb.wet.rampTo(fx.reverb * k * 0.9, 0.1);
    this.drive.wet.rampTo(fx.drive * k, 0.1);
    this.mod.wet.rampTo(fx.mod * k, 0.1);
  }

  async play() {
    await this.init();
    if (this.playing) return;
    this.stepIndex = 0;
    Tone.getTransport().start('+0.05');
    this.master.gain.rampTo(1, 1.2);
    this.playing = true;
  }

  stop() {
    if (!this.ready || !this.playing) return;
    this.master.gain.rampTo(0, 0.4);
    Tone.getTransport().stop();
    this.playing = false;
    this.step = -1;
    this.stepListeners.forEach((fn) => fn(-1));
  }

  onStep(fn) {
    this.stepListeners.add(fn);
    return () => this.stepListeners.delete(fn);
  }

  startRec() {
    if (!this.ready || this.recording) return false;
    this.recorder.start();
    this.recording = true;
    this.take = null;
    this.recStartedAt = performance.now();
    return true;
  }

  
  async stopRec() {
    if (!this.recording) return null;
    this.recording = false;
    const blob = await this.recorder.stop();
    const buffer = await Tone.getContext().decodeAudioData(await blob.arrayBuffer());
    this.take = encodeWav(buffer);
    return this.take;
  }

  recElapsed() {
    return this.recording ? (performance.now() - this.recStartedAt) / 1000 : 0;
  }

  
  scope() {
    if (!this.ready) return null;
    return { a: rms(this.A.scope.getValue()), b: rms(this.B.scope.getValue()), fft: this.fft.getValue() };
  }
}

export const engine = new Engine();
