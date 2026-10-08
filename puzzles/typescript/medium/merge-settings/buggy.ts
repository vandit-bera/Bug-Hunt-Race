interface Settings {
  theme: string;
  fontSize: number;
  notifications: { email: boolean; push: boolean };
}

interface Overrides {
  theme?: string;
  fontSize?: number;
  notifications?: Partial<Settings["notifications"]>;
}

const DEFAULTS: Settings = {
  theme: "light",
  fontSize: 14,
  notifications: { email: true, push: false },
};

// The defaults with the user's choices on top. Notification flags are merged
// one by one. DEFAULTS must never change.
function mergeSettings(overrides: Overrides): Settings {
  const merged: Settings = Object.assign(DEFAULTS, overrides);
  merged.notifications = overrides.notifications ?? DEFAULTS.notifications;
  return merged;
}

// A short line for a settings screen, e.g. "dark theme, 16px, email on, push off".
function describeSettings(settings: Settings): string {
  const { email, push } = settings.notifications;
  const flag = (on: boolean) => (on ? "on" : "off");
  return `${settings.theme} theme, ${settings.fontSize}px, email ${flag(email)}, push ${flag(push)}`;
}
