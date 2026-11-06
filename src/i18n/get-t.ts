// All UI copy lives in four-locale JSON dictionaries, covered by the same parity tests.
import en from './messages/en.json';
import et from './messages/et.json';
import fi from './messages/fi.json';
import sv from './messages/sv.json';
import workflowEn from './messages/workflow/en.json';
import workflowEt from './messages/workflow/et.json';
import workflowFi from './messages/workflow/fi.json';
import workflowSv from './messages/workflow/sv.json';
import guardianEn from './messages/guardian/en.json';
import guardianEt from './messages/guardian/et.json';
import guardianFi from './messages/guardian/fi.json';
import guardianSv from './messages/guardian/sv.json';
import type { Locale } from './locales';

export type MessageKey = keyof typeof en | keyof typeof workflowEn | keyof typeof guardianEn;
export type Messages = Record<MessageKey, string>;

export const messages: Record<Locale, Messages> = {
  en: { ...en, ...workflowEn, ...guardianEn },
  fi: { ...fi, ...workflowFi, ...guardianFi },
  sv: { ...sv, ...workflowSv, ...guardianSv },
  et: { ...et, ...workflowEt, ...guardianEt },
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
