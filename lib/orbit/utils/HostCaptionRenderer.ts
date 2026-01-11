export interface WordToken {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export class HostCaptionRenderer {
  private container: HTMLElement;
  private textBox: HTMLElement | null = null;
  private finalTokens: WordToken[] = [];
  private interimTokens: WordToken[] = [];
  private masterClockOffset: number | null = null; // Mapping audio time to local performance.now()
  private frameId: number | null = null;
  private isSimulation: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init() {
    this.textBox = document.createElement('div');
    this.textBox.className = 'captionText'; // Classes from CSS module will be applied via React, but for vanilla we'll use string literal
    // Note: Since we're using CSS modules, the class name will be hashed. 
    // We'll pass the actual class names from the React component.
  }

  public setBoxClass(className: string) {
    if (this.textBox) this.textBox.className = className;
  }

  public update(words: WordToken[], isFinal: boolean) {
    if (isFinal) {
      this.finalTokens = [...this.finalTokens, ...words];
      this.interimTokens = [];
      // Optional: Limit history to last 2-3 sentences
      if (this.finalTokens.length > 30) {
        this.finalTokens = this.finalTokens.slice(-30);
      }
    } else {
      this.interimTokens = words;
    }
  }

  public setSimulation(val: boolean) {
    this.isSimulation = val;
  }

  public start(audioContext?: AudioContext) {
    const loop = (time: number) => {
      this.renderFrame(time, audioContext);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
  }

  private renderFrame(now: number, audioContext?: AudioContext) {
    if (!this.textBox) return;

    // Determine current transcript time
    let transcriptNow = 0;
    if (this.isSimulation) {
      transcriptNow = now / 1000; // Just use performance.now() in seconds
    } else if (audioContext) {
      transcriptNow = audioContext.currentTime;
      // Orbit Engine timestamps are relative to the start of the stream.
      // We might need a smoothed offset if there's significant drift, 
      // but for live Engine v2, they usually stay fairly well aligned to the stream clock.
    } else {
      transcriptNow = performance.now() / 1000;
    }

    const allTokens = [...this.finalTokens, ...this.interimTokens];
    
    // Clear display if no recent tokens
    if (allTokens.length === 0) {
      this.textBox.innerHTML = '';
      return;
    }

    // Filter tokens to show only last few seconds of active speech or committed text
    // (In a real implementation, we'd prune the finalTokens buffer based on transcriptNow - X)
    
    let html = '';
    allTokens.forEach((token, tIdx) => {
      const isCommitted = tIdx < this.finalTokens.length;
      const word = token.word;
      const duration = token.end - token.start;
      
      html += `<span class="word">`;
      
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        const charRatio = i / word.length;
        const charShowTime = token.start + (duration * charRatio);
        
        const isVisible = isCommitted || transcriptNow >= charShowTime;
        const className = isVisible ? 'char charVisible' : 'char';
        
        html += `<span class="${className}">${char}</span>`;
      }
      
      html += ` </span>`; // Space between words
    });

    // Only update DOM if content changed (naive check)
    if (this.textBox.innerHTML !== html) {
      this.textBox.innerHTML = html;
    }
    
    if (!this.textBox.parentElement) {
      this.container.appendChild(this.textBox);
    }
  }

  public clear() {
    this.finalTokens = [];
    this.interimTokens = [];
    if (this.textBox) this.textBox.innerHTML = '';
  }
}
