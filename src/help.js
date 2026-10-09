/** DOM-free rules for the opt-in help button appearance. */
export const RETURN_DELAY_MS = 1500;
export const NUDGE_MS = 2000;

/** 24×24 evenodd path: circle r11 minus a "?" hook and dot, so the glyph stays transparent. */
export const HELP_ICON_PATH = 'M12 1a11 11 0 1 0 0 22a11 11 0 1 0 0-22ZM10.19 9.49L10.31 9.24L10.41 9.06L10.54 8.9L10.68 8.75L10.84 8.62L11.01 8.51L11.2 8.42L11.39 8.35L11.59 8.3L11.8 8.28L12 8.28L12.21 8.3L12.41 8.35L12.6 8.42L12.79 8.51L12.96 8.62L13.12 8.75L13.26 8.9L13.39 9.06L13.49 9.24L13.58 9.43L13.64 9.62L13.68 9.82L13.7 9.99L13.69 10.15L13.65 10.27L13.59 10.4L13.49 10.55L13.35 10.72L13.16 10.9L12.95 11.09L12.7 11.29L12.43 11.5L12.16 11.72L11.87 11.96L11.58 12.24L11.3 12.57L11.05 12.97L10.87 13.45L10.81 13.85A1.2 1.2 0 0 0 13.19 14.15L13.2 14.04L13.2 14.05L13.23 14L13.32 13.89L13.48 13.75L13.68 13.57L13.92 13.38L14.2 13.16L14.49 12.92L14.8 12.65L15.11 12.35L15.41 11.99L15.68 11.58L15.9 11.11L16.05 10.57L16.1 10.01L16.06 9.49L15.97 9.02L15.82 8.56L15.62 8.12L15.37 7.71L15.08 7.33L14.74 6.98L14.37 6.68L13.97 6.42L13.54 6.21L13.08 6.04L12.61 5.94L12.14 5.88L11.66 5.88L11.18 5.94L10.71 6.05L10.26 6.21L9.83 6.42L9.42 6.68L9.05 6.99L8.72 7.34L8.42 7.72L8.18 8.13L8.01 8.51A1.2 1.2 0 0 0 10.19 9.49ZM12 16.15a1.45 1.45 0 1 0 0 2.9a1.45 1.45 0 1 0 0-2.9Z';

export function helpResting({ enabled, state, navigationState, bubbleOpen, trainingRunning }) {
  return Boolean(enabled) && state === 'idle' && navigationState === 'home' && !bubbleOpen && !trainingRunning;
}

export function helpAppearance(input) {
  return helpResting(input) && input.returnRemaining <= 0 ? 'help' : 'bot';
}

/** Counts the delay down while resting; any activity restarts it. */
export function advanceHelpReturn(remaining, resting, dt) {
  return resting ? Math.max(0, remaining - dt) : RETURN_DELAY_MS;
}

/** The band's end nearest a horizontal viewport edge; ties (centered bands) keep the right end. */
export const helpSide = (box, viewportWidth) => box.left < viewportWidth - box.right ? 'start' : 'end';

export const helpHomeX = (bandWidth, side = 'end') => side === 'start' ? 0 : Math.max(0, Math.round(bandWidth) - 24);
