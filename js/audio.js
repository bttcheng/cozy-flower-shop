// js/audio.js - Web Audio API Sound Synthesizer cho Flower Shop Story
// Độc lập, không cần tài nguyên mp3 bên ngoài, chạy tức thì & mượt mà

class SoundManager {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.musicEnabled = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  toggleMusic() {
    this.init();
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.startLofiMusic();
    } else {
      this.stopLofiMusic();
    }
    return this.musicEnabled;
  }

  // Tiếng chuông cửa leng keng khi khách bước vào tiệm
  playDoorBell() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    
    // Nốt Mi (E5) & Sol (G5) leng keng chuông gió
    const notes = [659.25, 783.99, 987.77];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);
      
      gain.gain.setValueAtTime(0.18, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 0.85);
    });
  }

  // Tiếng đặt hoa sột soạt nhẹ nhàng (Pluck/Pop)
  playPickFlower() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.1);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Tiếng kéo cắt tỉa cành "Snip-Snip"
  playSnip() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    
    // Tiếng rít nhẹ (noise buffer giả lập kéo sắc nhọn)
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.Q.setValueAtTime(3, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.08);
  }

  // Tiếng gấp giấy gói sột soạt / ruy băng
  playWrapPaper() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.15);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  // Tiếng hoàn thành và nhận tiền xu (Coin Cha-ching)
  playCoinChime() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const chords = [987.77, 1318.51, 1567.98, 1975.53]; // B5, E6, G6, B6
    
    chords.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);

      gain.gain.setValueAtTime(0.2, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.45);
    });
  }

  // Tiếng khách hài lòng hân hoan
  playCustomerHappy() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
    melody.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);

      gain.gain.setValueAtTime(0.16, t + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.38);
    });
  }

  // Tiếng khách thất vọng bỏ đi
  playCustomerSad() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.35);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Tiếng nâng cấp thành công / Level Up
  playLevelUp() {
    if (!this.soundEnabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const arpeggio = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    
    arpeggio.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);

      gain.gain.setValueAtTime(0.18, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.55);
    });
  }

  // Vòng lặp nhạc nền Lofi Acoustic ấm cúng
  startLofiMusic() {
    if (this.musicTimer) return;
    // Hợp âm Cozy: Cmaj7 -> Am7 -> Dm7 -> G7 (ấm áp, thư giãn)
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [146.83, 220.00, 261.63, 349.23], // Dm7
      [196.00, 246.94, 293.66, 349.23]  // G7
    ];

    const playNextChord = () => {
      if (!this.musicEnabled) return;
      const t = this.ctx.currentTime;
      const chord = chords[this.musicStep % chords.length];
      this.musicStep++;

      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.04);

        gain.gain.setValueAtTime(0.04, t + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.04);
        osc.stop(t + 2.3);
      });

      this.musicTimer = setTimeout(playNextChord, 2200);
    };

    playNextChord();
  }

  stopLofiMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

// Khởi tạo global sound instance
window.soundMgr = new SoundManager();

