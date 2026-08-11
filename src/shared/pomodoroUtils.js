/**
 * Shared Pomodoro Utility Functions
 * 
 * Extracted to eliminate duplication between magicTodoController.js,
 * overlayManager.js, and content.js.
 */

/**
 * Format seconds into MM:SS display string
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatPomodoroTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Calculate remaining seconds from a PomodoroSession object
 * @param {Object|null} session - PomodoroSession state object
 * @returns {number}
 */
export function getPomodoroRemainingSeconds(session) {
  if (!session || !session.isActive) return 0;
  if (!session.isRunning) {
    return session.pausedRemainingSeconds != null ? session.pausedRemainingSeconds : 0;
  }
  if (!session.targetTimestamp) return 0;
  return Math.max(0, Math.ceil((session.targetTimestamp - Date.now()) / 1000));
}

/**
 * Build a Pomodoro work/break plan from total minutes
 * @param {number} totalMinutes - Total session duration
 * @param {number} workMin - Work block duration (default 25)
 * @param {number} breakMin - Break block duration (default 5)
 * @returns {Array<{type: string, minutes: number}>}
 */
export function buildPomodoroPlan(totalMinutes, workMin = 25, breakMin = 5) {
  const plan = [];
  let remaining = Math.max(workMin, Number(totalMinutes) || 60);

  while (remaining > 0) {
    const workMinutes = Math.min(workMin, remaining);
    plan.push({ type: 'work', minutes: workMinutes });
    remaining -= workMinutes;

    if (remaining <= 0) break;

    const breakMinutes = Math.min(breakMin, remaining);
    if (breakMinutes > 0) {
      plan.push({ type: 'break', minutes: breakMinutes });
      remaining -= breakMinutes;
    }
  }

  return plan;
}
