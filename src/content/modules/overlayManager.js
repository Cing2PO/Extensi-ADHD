/**
 * Overlay Manager Module - Facade/Orchestrator
 * 
 * Composes SoftBlockOverlay and FloatingPomodoroWidget into a single interface.
 * content.js uses this facade — no changes needed in content.js.
 */

import { SoftBlockOverlay } from './softBlockOverlay.js';
import { FloatingPomodoroWidget } from './floatingPomodoroWidget.js';
import { getPomodoroRemainingSeconds } from '../../shared/pomodoroUtils.js';

export class OverlayManager {
  constructor({ onKeepWorking, onGetMeOut, onPomoAction }) {
    this.softBlock = new SoftBlockOverlay({ onKeepWorking, onGetMeOut });
    this.floatingWidget = new FloatingPomodoroWidget({ onPomoAction });
  }

  // --- SOFT-BLOCK OVERLAY (delegated) ---
  isOverlayVisible() {
    return this.softBlock.isOverlayVisible();
  }

  showOverlay(currentTask = '') {
    this.softBlock.showOverlay(currentTask);
  }

  hideOverlay() {
    this.softBlock.hideOverlay();
  }

  removeOverlay() {
    this.softBlock.removeOverlay();
  }

  // --- FLOATING POMODORO WIDGET (delegated) ---
  injectPomodoroFloatingWidget() {
    this.floatingWidget.injectWidget();
  }

  updatePomoFloatingUI(session, activeTaskText) {
    this.floatingWidget.updateUI(session, activeTaskText);
  }

  updatePomoFloatingDebug(metrics) {
    this.floatingWidget.updateDebug(metrics);
  }

  removePomodoroWidget() {
    this.floatingWidget.removeWidget();
  }

  // --- SHARED UTILITIES (for content.js compatibility) ---
  getFloatingRemainingSeconds(session) {
    return getPomodoroRemainingSeconds(session);
  }
}
