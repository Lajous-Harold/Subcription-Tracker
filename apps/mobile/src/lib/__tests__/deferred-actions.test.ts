import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createDeferredActions } from '../deferred-actions';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createDeferredActions : exécution différée', () => {
  it('exécute l’action au bout de 5 secondes par défaut, et pas avant', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];

    actions.schedule('netflix', () => {
      executed.push('netflix');
    });
    await jest.advanceTimersByTimeAsync(4999);
    expect(executed).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    expect(executed).toEqual(['netflix']);
  });

  it('respecte le délai fourni en option', async () => {
    const actions = createDeferredActions({ delayMs: 1000 });
    const executed: string[] = [];

    actions.schedule('netflix', () => {
      executed.push('netflix');
    });
    await jest.advanceTimersByTimeAsync(999);
    expect(executed).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    expect(executed).toEqual(['netflix']);
  });

  it('liste les clés en attente dans l’ordre de programmation et les retire une fois exécutées', async () => {
    const actions = createDeferredActions({});

    actions.schedule('netflix', () => undefined);
    actions.schedule('spotify', () => undefined);
    actions.schedule('canal', () => undefined);
    expect(actions.pendingKeys()).toEqual(['netflix', 'spotify', 'canal']);

    await jest.advanceTimersByTimeAsync(5000);
    expect(actions.pendingKeys()).toEqual([]);
  });

  it('n’exécute une action qu’une seule fois', async () => {
    const actions = createDeferredActions({});
    let runCount = 0;

    actions.schedule('netflix', () => {
      runCount += 1;
    });
    await jest.advanceTimersByTimeAsync(20_000);

    expect(runCount).toBe(1);
  });

  it('remplace l’action d’une clé reprogrammée et relance le délai', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];

    actions.schedule('netflix', () => {
      executed.push('ignorer');
    });
    await jest.advanceTimersByTimeAsync(3000);
    actions.schedule('netflix', () => {
      executed.push('suivre');
    });
    expect(actions.pendingKeys()).toEqual(['netflix']);

    await jest.advanceTimersByTimeAsync(4999);
    expect(executed).toEqual([]);

    await jest.advanceTimersByTimeAsync(1);
    expect(executed).toEqual(['suivre']);
  });
});

describe('createDeferredActions : annulation par clé', () => {
  it('annule une action en attente, qui ne s’exécute jamais', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];
    actions.schedule('netflix', () => {
      executed.push('netflix');
    });
    actions.schedule('spotify', () => {
      executed.push('spotify');
    });

    expect(actions.cancel('netflix')).toBe(true);
    expect(actions.pendingKeys()).toEqual(['spotify']);

    await jest.advanceTimersByTimeAsync(5000);
    expect(executed).toEqual(['spotify']);
  });

  it('renvoie false pour une clé inconnue', () => {
    const actions = createDeferredActions({});
    actions.schedule('netflix', () => undefined);

    expect(actions.cancel('spotify')).toBe(false);
    expect(actions.pendingKeys()).toEqual(['netflix']);
  });

  it('renvoie false pour une action déjà exécutée', async () => {
    const actions = createDeferredActions({});
    actions.schedule('netflix', () => undefined);
    await jest.advanceTimersByTimeAsync(5000);

    expect(actions.cancel('netflix')).toBe(false);
  });
});

describe('createDeferredActions : annulation de la dernière action', () => {
  it('annule la dernière action programmée et renvoie sa clé, sans toucher aux autres', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];
    actions.schedule('netflix', () => {
      executed.push('netflix');
    });
    actions.schedule('spotify', () => {
      executed.push('spotify');
    });

    expect(actions.cancelLast()).toBe('spotify');
    expect(actions.pendingKeys()).toEqual(['netflix']);

    await jest.advanceTimersByTimeAsync(5000);
    expect(executed).toEqual(['netflix']);
  });

  it('remonte la file à chaque appel, puis renvoie null quand plus rien n’est en attente', () => {
    const actions = createDeferredActions({});
    actions.schedule('netflix', () => undefined);
    actions.schedule('spotify', () => undefined);

    expect(actions.cancelLast()).toBe('spotify');
    expect(actions.cancelLast()).toBe('netflix');
    expect(actions.cancelLast()).toBeNull();
  });

  it('ignore les actions déjà exécutées ou déjà annulées', async () => {
    const actions = createDeferredActions({});
    actions.schedule('netflix', () => undefined);
    await jest.advanceTimersByTimeAsync(2000);
    actions.schedule('spotify', () => undefined);
    actions.schedule('canal', () => undefined);
    await jest.advanceTimersByTimeAsync(3000);

    actions.cancel('canal');

    expect(actions.cancelLast()).toBe('spotify');
    expect(actions.cancelLast()).toBeNull();
  });
});

describe('createDeferredActions : envoi immédiat en quittant l’écran', () => {
  it('exécute aussitôt toutes les actions en attente, dans l’ordre de programmation', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];
    actions.schedule('netflix', () => {
      executed.push('netflix');
    });
    actions.schedule('spotify', () => {
      executed.push('spotify');
    });
    actions.schedule('canal', () => {
      executed.push('canal');
    });

    await actions.flush();

    expect(executed).toEqual(['netflix', 'spotify', 'canal']);
    expect(actions.pendingKeys()).toEqual([]);
  });

  it('attend la fin des actions asynchrones avant de se résoudre', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];
    actions.schedule('netflix', async () => {
      await Promise.resolve();
      await Promise.resolve();
      executed.push('netflix');
    });

    await actions.flush();

    expect(executed).toEqual(['netflix']);
  });

  it('n’exécute pas une seconde fois les actions envoyées, à l’expiration du délai', async () => {
    const actions = createDeferredActions({});
    let runCount = 0;
    actions.schedule('netflix', () => {
      runCount += 1;
    });

    await actions.flush();
    await jest.advanceTimersByTimeAsync(5000);

    expect(runCount).toBe(1);
  });

  it('n’exécute pas les actions annulées avant l’envoi', async () => {
    const actions = createDeferredActions({});
    const executed: string[] = [];
    actions.schedule('netflix', () => {
      executed.push('netflix');
    });
    actions.schedule('spotify', () => {
      executed.push('spotify');
    });
    actions.cancelLast();

    await actions.flush();

    expect(executed).toEqual(['netflix']);
  });
});

describe('createDeferredActions : échec d’une action', () => {
  it('signale l’erreur avec la clé sans bloquer les autres actions à l’expiration du délai', async () => {
    const onError = jest.fn();
    const actions = createDeferredActions({ onError });
    const failure = new Error('Réseau indisponible');
    const executed: string[] = [];
    actions.schedule('netflix', () => Promise.reject(failure));
    actions.schedule('spotify', () => {
      executed.push('spotify');
    });

    await jest.advanceTimersByTimeAsync(5000);

    expect(onError).toHaveBeenCalledWith(failure, 'netflix');
    expect(executed).toEqual(['spotify']);
    expect(actions.pendingKeys()).toEqual([]);
  });

  it('signale l’erreur avec la clé sans bloquer les autres actions lors de l’envoi immédiat', async () => {
    const onError = jest.fn();
    const actions = createDeferredActions({ onError });
    const failure = new Error('Réseau indisponible');
    const executed: string[] = [];
    actions.schedule('netflix', () => Promise.reject(failure));
    actions.schedule('spotify', () => {
      executed.push('spotify');
    });

    await actions.flush();

    expect(onError).toHaveBeenCalledWith(failure, 'netflix');
    expect(executed).toEqual(['spotify']);
    expect(actions.pendingKeys()).toEqual([]);
  });
});
