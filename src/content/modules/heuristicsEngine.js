/**
 * Heuristics Engine Module - Mathematical Distraction & Scroll Tracking
 */

export const SENSITIVITY_MAP = {
  'lenient': 14000,
  'balanced': 8000,
  'strict': 1000
};

export const TICK_RATE_MS = 500;
export const SCORE_DECAY = 250;
export const VELOCITY_WEIGHT = 2.5;
export const INTERACTION_TIMEOUT_MS = 8000;

export class HeuristicsEngine {
  constructor({ onThresholdReached, onTick }) {
    this.onThresholdReached = onThresholdReached;
    this.onTick = onTick;
    this.distractionScore = 0;
    this.accumulatedScrollInTick = 0;
    this.totalScrollDistance = 0;
    this.maxScrollYReached = typeof window !== 'undefined' ? window.scrollY : 0;
    this.lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    this.lastTickTime = performance.now();
    this.lastInteractionTime = performance.now();

    this.tickIntervalId = null;
    this.isEngineRunning = false;
    this.doomscrollThreshold = 8000;

    this.handleScroll = this.handleScroll.bind(this);
    this.handleInteraction = this.handleInteraction.bind(this);
    this.runHeuristicsTick = this.runHeuristicsTick.bind(this);
  }

  setThreshold(sensitivity) {
    this.doomscrollThreshold = SENSITIVITY_MAP[sensitivity] || 8000;
  }

  handleScroll() {
    const currentScrollY = window.scrollY;
    const delta = Math.abs(currentScrollY - this.lastScrollY);

    this.accumulatedScrollInTick += delta;
    this.totalScrollDistance += delta;
    this.lastScrollY = currentScrollY;

    if (currentScrollY > this.maxScrollYReached) {
      this.maxScrollYReached = currentScrollY;
    }
  }

  handleInteraction(e) {
    if (e.type === 'keydown') {
      const scrollKeys = ['ArrowDown', 'ArrowUp', 'Space', ' ', 'PageDown', 'PageUp', 'Home', 'End'];
      if (scrollKeys.includes(e.key)) return;
    }

    this.lastInteractionTime = performance.now();
    this.distractionScore = 0;
  }

  runHeuristicsTick() {
    const now = performance.now();
    const dt = now - this.lastTickTime;
    this.lastTickTime = now;

    const timeSinceInteraction = now - this.lastInteractionTime;

    if (this.accumulatedScrollInTick > 0) {
      const velocity = this.accumulatedScrollInTick / dt;

      let interactionAbsenceFactor = 1.0;
      if (timeSinceInteraction > INTERACTION_TIMEOUT_MS) {
        interactionAbsenceFactor = 1.0 + ((timeSinceInteraction - INTERACTION_TIMEOUT_MS) / 5000);
      }

      const scoreDelta = this.accumulatedScrollInTick * (1 + (velocity * VELOCITY_WEIGHT)) * interactionAbsenceFactor;
      this.distractionScore += scoreDelta;
      this.accumulatedScrollInTick = 0;
    } else {
      this.distractionScore = Math.max(0, this.distractionScore - SCORE_DECAY);
    }

    if (this.onTick) {
      this.onTick({
        domain: typeof window !== 'undefined' ? window.location.hostname : '',
        scrollY: typeof window !== 'undefined' ? Math.round(window.scrollY) : 0,
        totalScrollPx: Math.round(this.totalScrollDistance),
        score: Math.round(this.distractionScore),
        threshold: this.doomscrollThreshold
      });
    }

    if (this.distractionScore >= this.doomscrollThreshold) {
      if (this.onThresholdReached) {
        this.onThresholdReached(this.distractionScore, this.doomscrollThreshold);
      }
    }
  }

  start() {
    if (this.isEngineRunning) return;

    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('wheel', this.handleScroll, { passive: true });
    window.addEventListener('click', this.handleInteraction, { passive: true });
    window.addEventListener('keydown', this.handleInteraction, { passive: true });
    window.addEventListener('input', this.handleInteraction, { passive: true });

    this.tickIntervalId = setInterval(this.runHeuristicsTick, TICK_RATE_MS);
    this.isEngineRunning = true;
    this.lastTickTime = performance.now();
    this.lastInteractionTime = performance.now();
    this.distractionScore = 0;
    this.accumulatedScrollInTick = 0;
  }

  stop() {
    if (!this.isEngineRunning) return;

    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('wheel', this.handleScroll);
    window.removeEventListener('click', this.handleInteraction);
    window.removeEventListener('keydown', this.handleInteraction);
    window.removeEventListener('input', this.handleInteraction);

    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }

    this.isEngineRunning = false;
    this.distractionScore = 0;
  }

  resetScore() {
    this.distractionScore = 0;
    this.accumulatedScrollInTick = 0;
    this.lastInteractionTime = performance.now();
  }
}
