// Translations. Feature dictionaries are merged before the shared key-parity tests.
// Use `const t = getT(locale); t('catalogue.title')` in presentation code.
import en from './messages/en.json';
import et from './messages/et.json';
import fi from './messages/fi.json';
import sv from './messages/sv.json';
import appearanceEn from './messages/appearance.en.json';
import appearanceEt from './messages/appearance.et.json';
import appearanceFi from './messages/appearance.fi.json';
import appearanceSv from './messages/appearance.sv.json';
import type { Locale } from './locales';

export type MessageKey = keyof typeof en | keyof typeof appearanceEn;
export type Messages = Record<MessageKey, string>;

export const messages: Record<Locale, Messages> = {
  en: { ...en, ...appearanceEn },
  fi: { ...fi, ...appearanceFi },
  sv: { ...sv, ...appearanceSv },
  et: { ...et, ...appearanceEt },
};

export type TranslateValues = Record<string, string | number>;
export type Translate = (key: MessageKey, values?: TranslateValues) => string;

/** Returns `t(key, values?)` for a locale. `{name}` in a message is replaced by `values.name`. */
export function getT(locale: Locale): Translate {
  const dictionary = messages[locale];
  return (key, values) => interpolate(dictionary[key], values);
}

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === undefined ? placeholder : String(value);
  });
}
