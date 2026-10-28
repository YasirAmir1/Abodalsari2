class SoundService {
  private audioCtx: AudioContext | null = null;
  private volume: number = 0.6;
  private isMuted: boolean = false;
  private customAudioDataUrl: string | null = null;
  private customAudioElement: HTMLAudioElement | null = null;
  private activeToneType: 'westminster' | 'dingdong' | 'digital' | 'custom' = 'westminster';
  private repeatIntervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedAudio = localStorage.getItem('alsari_custom_sound');
        if (savedAudio) {
          this.customAudioDataUrl = savedAudio;
          this.customAudioElement = new Audio(savedAudio);
        }
        const savedTone = localStorage.getItem('alsari_tone_type');
        if (savedTone) {
          this.activeToneType = savedTone as any;
        }
      } catch {
        // ignore
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.customAudioElement) {
      this.customAudioElement.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopRepeat();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setToneType(type: 'westminster' | 'dingdong' | 'digital' | 'custom') {
    this.activeToneType = type;
    try {
      localStorage.setItem('alsari_tone_type', type);
    } catch {
      // ignore
    }
  }

  public getToneType(): 'westminster' | 'dingdong' | 'digital' | 'custom' {
    return this.activeToneType;
  }

  public setCustomAudio(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.customAudioDataUrl = result;
        this.customAudioElement = new Audio(result);
        this.customAudioElement.volume = this.volume;
        this.activeToneType = 'custom';
        try {
          localStorage.setItem('alsari_custom_sound', result);
          localStorage.setItem('alsari_tone_type', 'custom');
        } catch {
          // ignore
        }
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  public playPendingAlert() {
    if (this.isMuted) return;

    // If custom audio uploaded and active
    if (this.activeToneType === 'custom' && this.customAudioElement) {
      try {
        this.customAudioElement.currentTime = 0;
        this.customAudioElement.volume = this.volume;
        this.customAudioElement.play().catch(() => {
          this.playSynthesizedChime();
        });
        return;
      } catch {
        // fallback
      }
    }

    if (this.activeToneType === 'digital') {
      this.playDigitalBeep();
      return;
    }

    if (this.activeToneType === 'dingdong') {
      this.playDingDong();
      return;
    }

    // Default: The exact Westminster 4-note bell chime from the uploaded audio file!
    this.playSynthesizedChime();
  }

  /**
   * Synthesizes the exact 4-note bell/doorbell chime from the user's uploaded audio clip:
   * 1. E4 (329.63 Hz)
   * 2. G#4 (415.30 Hz)
   * 3. F#4 (369.99 Hz)
   * 4. B3 (246.94 Hz)
   */
  private playSynthesizedChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const strikes = [
      { timeOffset: 0.0, freq: 329.63, dur: 1.2 }, // E4
      { timeOffset: 0.85, freq: 415.30, dur: 1.2 }, // G#4
      { timeOffset: 1.70, freq: 369.99, dur: 1.2 }, // F#4
      { timeOffset: 2.55, freq: 246.94, dur: 1.8 }  // B3 (resonant ending)
    ];

    strikes.forEach((strike) => {
      this.playBellNote(ctx, ctx.currentTime + strike.timeOffset, strike.freq, strike.dur);
    });
  }

  private playBellNote(ctx: AudioContext, startTime: number, freq: number, duration: number) {
    const fundamental = ctx.createOscillator();
    const harmonic1 = ctx.createOscillator();
    const harmonic2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(freq, startTime);

    // First harmonic for tubular bell warmth
    harmonic1.type = 'sine';
    harmonic1.frequency.setValueAtTime(freq * 2.0, startTime);

    // Chime overtone
    harmonic2.type = 'sine';
    harmonic2.frequency.setValueAtTime(freq * 2.76, startTime);

    // Natural bell envelope: instant attack then gentle exponential decay
    const peakVolume = this.volume * 0.45;
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(peakVolume, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(peakVolume * 0.5, startTime + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    // Connect oscillators
    fundamental.connect(gainNode);
    harmonic1.connect(gainNode);
    harmonic2.connect(gainNode);
    gainNode.connect(ctx.destination);

    fundamental.start(startTime);
    harmonic1.start(startTime);
    harmonic2.start(startTime);

    fundamental.stop(startTime + duration);
    harmonic1.stop(startTime + duration);
    harmonic2.stop(startTime + duration);
  }

  private playDingDong() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playBellNote(ctx, now, 659.25, 1.0); // E5
    this.playBellNote(ctx, now + 0.5, 523.25, 1.4); // C5
  }

  private playDigitalBeep() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  public playSuccess() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {
      // ignore
    }
  }

  public playTestBeep() {
    this.playPendingAlert();
  }

  /**
   * Referee whistle sound for match kickoff or final whistle
   */
  public playFootballWhistle() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two short sharp whistle bursts
      const bursts = [0.0, 0.22];
      bursts.forEach((offset) => {
        const t = now + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2600, t);
        osc.frequency.linearRampToValueAtTime(2850, t + 0.1);
        osc.frequency.setValueAtTime(2600, t + 0.16);

        gain.gain.setValueAtTime(this.volume * 0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Goal fanfare sound: Exciting triumphant chime
   */
  public playGoalFanfare() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 4 ascending triumph notes: C5, E5, G5, C6
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.15 },
        { freq: 659.25, time: 0.12, dur: 0.15 },
        { freq: 783.99, time: 0.24, dur: 0.2 },
        { freq: 1046.50, time: 0.4, dur: 0.6 }
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(this.volume * 0.4, now + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      });
    } catch {
      // ignore
    }
  }

  public startRepeatAlert(intervalSeconds = 12) {
    this.stopRepeat();
    this.playPendingAlert();
    this.repeatIntervalId = setInterval(() => {
      this.playPendingAlert();
    }, intervalSeconds * 1000);
  }

  public stopRepeat() {
    if (this.repeatIntervalId) {
      clearInterval(this.repeatIntervalId);
      this.repeatIntervalId = null;
    }
  }
}

export const soundService = new SoundService();
