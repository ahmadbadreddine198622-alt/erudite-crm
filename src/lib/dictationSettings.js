const SETTINGS_KEY = 'erudite_dictation_settings';

export function getDictationSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { enabled: true, language: 'auto' };
}

export function setDictationSettings(patch) {
  const current = getDictationSettings();
  const next = { ...current, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('dictation-settings-changed', { detail: next }));
  return next;
}

export function onDictationSettingsChange(callback) {
  const handler = (e) => callback(e.detail || getDictationSettings());
  window.addEventListener('dictation-settings-changed', handler);
  return () => window.removeEventListener('dictation-settings-changed', handler);
}

export const DICTATION_LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' },
];

const LANG_MAP = {
  auto: { deepgram: 'multi', webkit: '' },
  en: { deepgram: 'en', webkit: 'en-US' },
  ar: { deepgram: 'ar', webkit: 'ar-SA' },
  ru: { deepgram: 'ru', webkit: 'ru-RU' },
};

export function getLangParams(lang) {
  return LANG_MAP[lang] || LANG_MAP.auto;
}