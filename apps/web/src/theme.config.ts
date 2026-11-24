import { theme } from '@skin/theme';
export { theme };
export function applyTheme(mode: 'light' | 'dark', overrides: Record<string, string> = {}) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  for (const [key, value] of Object.entries(theme.colors[mode]))
    root.style.setProperty(
      `--${key}`,
      /^#[0-9a-fA-F]{6}$/.test(overrides[`${mode}.${key}`] ?? '')
        ? overrides[`${mode}.${key}`]
        : value,
    );
  for (const [key, value] of Object.entries(theme.fonts))
    root.style.setProperty(`--font-${key}`, value);
  for (const [key, value] of Object.entries(theme.radius))
    root.style.setProperty(`--radius-${key}`, value);
  for (const [key, value] of Object.entries(theme.spacing))
    root.style.setProperty(`--${key}`, value);
  root.style.setProperty('--dialog-shadow', theme.shadows.dialog);
  root.style.setProperty('--duration', theme.motion.duration);
  root.style.setProperty('--ease', theme.motion.ease);
}
