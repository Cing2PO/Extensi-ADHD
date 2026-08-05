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
    this.lastTouchY = 0;
    this.lastPointerY = 0;
    this.isSwiping = false;
    this.isPointerDown = false;
    this.lastTickTime = performance.now();
    this.lastInteractionTime = performance.now();

    this.tickIntervalId = null;
    this.isEngineRunning = false;
    this.doomscrollThreshold = 8000;

    this.handleScroll = this.handleScroll.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleKeyDownSwipe = this.handleKeyDownSwipe.bind(this);
    this.handleInteraction = this.handleInteraction.bind(this);
    this.runHeuristicsTick = this.runHeuristicsTick.bind(this);
  }

  setThreshold(sensitivity) {
    this.doomscrollThreshold = SENSITIVITY_MAP[sensitivity] || 8000;
  }

  handleScroll(e) {
    let delta = 0;
    if (e && e.type === 'wheel') {
      delta = Math.abs(e.deltaY || e.detail || 0);
    } else {
      const currentScrollY = typeof window !== 'undefined' ? (window.scrollY || document.documentElement?.scrollTop || 0) : 0;
      delta = Math.abs(currentScrollY - this.lastScrollY);
      this.lastScrollY = currentScrollY;
    }

    if (delta > 0) {
      this.accumulatedScrollInTick += delta;
      this.totalScrollDistance += delta;
    }

    if (typeof window !== 'undefined' && window.scrollY > this.maxScrollYReached) {
      this.maxScrollYReached = window.scrollY;
    }
  }

  handleTouchStart(e) {
    if (e.touches && e.touches[0]) {
      this.lastTouchY = e.touches[0].clientY;
      this.isSwiping = true;
    }
  }

  handleTouchMove(e) {
    if (!this.isSwiping || !e.touches || !e.touches[0]) return;
    const currentTouchY = e.touches[0].clientY;
    const delta = Math.abs(currentTouchY - this.lastTouchY);
    this.lastTouchY = currentTouchY;

    if (delta > 0) {
      this.accumulatedScrollInTick += delta;
      this.totalScrollDistance += delta;
    }
  }

  handleTouchEnd() {
    this.isSwiping = false;
  }

  handlePointerDown(e) {
    this.isPointerDown = true;
    this.lastPointerY = e.clientY;
  }

  handlePointerMove(e) {
    if (!this.isPointerDown) return;
    const delta = Math.abs(e.clientY - this.lastPointerY);
    this.lastPointerY = e.clientY;

    if (delta > 5) {
      this.accumulatedScrollInTick += delta;
      this.totalScrollDistance += delta;
    }
  }

  handlePointerUp() {
    this.isPointerDown = false;
  }

  handleKeyDownSwipe(e) {
    const navKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'j', 'k', 'w', 's'];
    if (navKeys.includes(e.key)) {
      const simulatedSwipePx = 600;
      this.accumulatedScrollInTick += simulatedSwipePx;
      this.totalScrollDistance += simulatedSwipePx;
    }
  }

  handleInteraction(e) {
    if (e.type === 'keydown') {
      const scrollKeys = ['ArrowDown', 'ArrowUp', 'Space', ' ', 'PageDown', 'PageUp', 'Home', 'End', 'j', 'k', 'w', 's'];
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

    const opt = { capture: true, passive: true };

    window.addEventListener('scroll', this.handleScroll, opt);
    window.addEventListener('wheel', this.handleScroll, opt);
    window.addEventListener('touchstart', this.handleTouchStart, opt);
    window.addEventListener('touchmove', this.handleTouchMove, opt);
    window.addEventListener('touchend', this.handleTouchEnd, opt);
    window.addEventListener('pointerdown', this.handlePointerDown, opt);
    window.addEventListener('pointermove', this.handlePointerMove, opt);
    window.addEventListener('pointerup', this.handlePointerUp, opt);
    window.addEventListener('keydown', this.handleKeyDownSwipe, opt);
    window.addEventListener('click', this.handleInteraction, opt);

    this.tickIntervalId = setInterval(this.runHeuristicsTick, TICK_RATE_MS);
    this.isEngineRunning = true;
    this.lastTickTime = performance.now();
    this.lastInteractionTime = performance.now();
    this.distractionScore = 0;
    this.accumulatedScrollInTick = 0;
  }

  stop() {
    if (!this.isEngineRunning) return;

    const opt = { capture: true };

    window.removeEventListener('scroll', this.handleScroll, opt);
    window.removeEventListener('wheel', this.handleScroll, opt);
    window.removeEventListener('touchstart', this.handleTouchStart, opt);
    window.removeEventListener('touchmove', this.handleTouchMove, opt);
    window.removeEventListener('touchend', this.handleTouchEnd, opt);
    window.removeEventListener('pointerdown', this.handlePointerDown, opt);
    window.removeEventListener('pointermove', this.handlePointerMove, opt);
    window.removeEventListener('pointerup', this.handlePointerUp, opt);
    window.removeEventListener('keydown', this.handleKeyDownSwipe, opt);
    window.removeEventListener('click', this.handleInteraction, opt);

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
