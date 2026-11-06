'use client';

import { useSyncExternalStore } from 'react';
import { appearanceKey, defaultAppearance, parseAppearance, type Appearance } from './preferences';

const eventName = 'lease-loop-appearance-changed';
const serverSnapshot = () => 'server';

function snapshot(): string {
  const data = document.documentElement.dataset;
  return JSON.stringify({
    design: data.design,
    mode: data.mode,
    volatile: data.appearanceVolatile,
  });
}

function apply(value: Appearance, volatile: boolean): void {
  const data = document.documentElement.dataset;
  data.design = value.design;
  data.mode = value.mode;
  data.theme =
    value.mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : value.mode;
  data.appearanceVolatile = String(volatile);
}

function subscribe(listener: () => void): () => void {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = () => {
    const value = snapshot();
    apply(parseAppearance(value), document.documentElement.dataset.appearanceVolatile === 'true');
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== appearanceKey && event.key !== null) return;
    apply(parseAppearance(event.newValue), false);
    listener();
  };
  system.addEventListener('change', onSystem);
  window.addEventListener('storage', onStorage);
  window.addEventListener(eventName, listener);
  return () => {
    system.removeEventListener('change', onSystem);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(eventName, listener);
  };
}

function save(value: Appearance): void {
  let volatile = false;
  try {
    window.localStorage.setItem(appearanceKey, JSON.stringify(value));
  } catch {
    volatile = true;
  }
  apply(value, volatile);
  window.dispatchEvent(new Event(eventName));
}

export function useAppearance() {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ready = value !== 'server';
  return {
    appearance: ready ? parseAppearance(value) : defaultAppearance,
    ready,
    volatile: ready && (JSON.parse(value) as { volatile?: string }).volatile === 'true',
    save,
  };
}
