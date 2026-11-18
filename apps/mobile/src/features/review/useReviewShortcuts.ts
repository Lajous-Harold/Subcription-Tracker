import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';
import { shortcutForKey, type ReviewShortcut } from './review-session';

export const shortcutsAvailable = Platform.OS === 'web';

export const undoShortcutLabel =
  shortcutsAvailable && typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? 'Cmd+Z'
    : 'Ctrl+Z';

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Raccourcis du web, actifs seulement quand l'écran a le focus de navigation. */
export function useReviewShortcuts(handlers: Record<ReviewShortcut, () => void>) {
  const isFocused = useIsFocused();
  const runShortcut = useEffectEvent((shortcut: ReviewShortcut) => handlers[shortcut]());

  useEffect(() => {
    if (!shortcutsAvailable || !isFocused) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutForKey({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        targetIsEditable: isEditable(event.target),
      });
      if (!shortcut) return;
      event.preventDefault();
      runShortcut(shortcut);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFocused]);
}
