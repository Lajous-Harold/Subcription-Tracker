export type DeferredAction = () => void | Promise<void>;

export interface DeferredActionsOptions {
  delayMs?: number;
  onError?: (error: unknown, key: string) => void;
}

export interface DeferredActions {
  schedule(key: string, run: DeferredAction): void;
  cancel(key: string): boolean;
  cancelLast(): string | null;
  flush(): Promise<void>;
  pendingKeys(): string[];
}

interface PendingAction {
  run: DeferredAction;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_DELAY_MS = 5000;

/**
 * Diffère l'envoi des décisions pour laisser à l'utilisateur le temps de les annuler.
 *
 * Une action programmée s'exécute à l'expiration du délai ; l'annuler revient à ne jamais l'exécuter.
 * Reprogrammer une clé remplace son action, relance le délai et la place en fin de file (cible de `cancelLast`).
 * `flush` exécute aussitôt les actions en attente, par exemple en quittant l'écran.
 * Un échec est transmis à `onError` avec la clé, sans bloquer les autres actions.
 */
export function createDeferredActions({
  delayMs = DEFAULT_DELAY_MS,
  onError,
}: DeferredActionsOptions = {}): DeferredActions {
  const pendingByKey = new Map<string, PendingAction>();

  async function runReportingErrors(key: string, run: DeferredAction): Promise<void> {
    try {
      await run();
    } catch (error) {
      onError?.(error, key);
    }
  }

  function take(key: string): PendingAction | undefined {
    const pending = pendingByKey.get(key);
    if (!pending) return undefined;
    clearTimeout(pending.timer);
    pendingByKey.delete(key);
    return pending;
  }

  return {
    schedule(key, run) {
      take(key);
      const timer = setTimeout(() => {
        pendingByKey.delete(key);
        void runReportingErrors(key, run);
      }, delayMs);
      pendingByKey.set(key, { run, timer });
    },

    cancel(key) {
      return take(key) !== undefined;
    },

    cancelLast() {
      const lastKey = [...pendingByKey.keys()].at(-1);
      if (lastKey === undefined) return null;
      take(lastKey);
      return lastKey;
    },

    async flush() {
      const dueActions = [...pendingByKey];
      pendingByKey.clear();
      for (const [, pending] of dueActions) clearTimeout(pending.timer);
      await Promise.all(dueActions.map(([key, pending]) => runReportingErrors(key, pending.run)));
    },

    pendingKeys() {
      return [...pendingByKey.keys()];
    },
  };
}
