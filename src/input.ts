// Global keyboard state (shared mutable map)
export const KEYS: Record<string, boolean> = {};

export function setupInput(): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    KEYS[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e: KeyboardEvent) => {
    KEYS[e.key] = false;
  });
  window.addEventListener('blur', () => {
    // Reset all keys on window blur to avoid stuck keys
    for (const k in KEYS) delete KEYS[k];
  });
}
