import { describe, expect, it } from '@jest/globals';
import type { Payment } from '@subtracker/contracts';
import {
  cancellationChoiceOf,
  cancellationStatusFor,
  describePaymentHistory,
  latestPayments,
  paymentBars,
  splitInstructionSteps,
} from '../presentation';

function payment(date: string, cents: number): Payment {
  return {
    id: date,
    subscriptionId: 'sub',
    source: 'bank',
    transactionId: null,
    date,
    amount: { cents, currency: 'EUR' },
    note: null,
    possibleDuplicateOfId: null,
    createdAt: `${date}T08:00:00.000Z`,
  };
}

const normalizeSpaces = (text: string) => text.replace(/\s/g, ' ');

describe('splitInstructionSteps', () => {
  it('fait une étape de chaque phrase, sans couper les noms de domaine', () => {
    expect(
      splitInstructionSteps(
        'Connectez-vous sur netflix.com, page Compte, puis « Annuler l’abonnement ». Si Netflix est facturé par un opérateur, résiliez auprès de lui.',
      ),
    ).toEqual([
      'Connectez-vous sur netflix.com, page Compte, puis « Annuler l’abonnement ».',
      'Si Netflix est facturé par un opérateur, résiliez auprès de lui.',
    ]);
  });

  it('reconnaît une phrase qui commence par une majuscule accentuée', () => {
    expect(splitInstructionSteps('Cherchez une rubrique. À défaut, écrivez.')).toEqual([
      'Cherchez une rubrique.',
      'À défaut, écrivez.',
    ]);
  });
});

describe('historique des paiements', () => {
  it('garde les six plus récents, du plus ancien au plus récent', () => {
    const payments = ['2026-05-03', '2026-11-03', '2026-04-03', '2026-08-03', '2026-06-03', '2026-09-03', '2026-10-03'];
    expect(latestPayments(payments.map((date) => payment(date, 1349))).map((kept) => kept.date)).toEqual([
      '2026-05-03',
      '2026-06-03',
      '2026-08-03',
      '2026-09-03',
      '2026-10-03',
      '2026-11-03',
    ]);
  });

  it('dimensionne les barres par rapport au plus gros paiement', () => {
    const bars = paymentBars([payment('2026-10-03', 500), payment('2026-11-03', 1000)]);
    expect(bars.map((bar) => bar.heightRatio)).toEqual([0.5, 1]);
    expect(bars.map((bar) => bar.monthLabel)).toEqual(['oct.', 'nov.']);
  });

  it('résume des montants identiques en une phrase', () => {
    const payments = [payment('2026-10-03', 1349), payment('2026-11-03', 1349)];
    expect(normalizeSpaces(describePaymentHistory(payments))).toBe('2 derniers paiements, tous de 13,49 €');
  });

  it('donne la fourchette et le plus récent quand les montants varient', () => {
    const payments = [payment('2026-09-03', 1199), payment('2026-10-03', 1349), payment('2026-11-03', 1299)];
    expect(normalizeSpaces(describePaymentHistory(payments))).toBe(
      '3 derniers paiements, de 11,99 € à 13,49 € ; le plus récent : 12,99 € le 3 novembre 2026',
    );
  });
});

describe('choix rapide de résiliation', () => {
  it('lit « Actif » sans démarche ou après abandon, et aucun choix pour une démarche seulement commencée', () => {
    expect(cancellationChoiceOf(null)).toBe('active');
    expect(cancellationChoiceOf({ status: 'abandoned' })).toBe('active');
    expect(cancellationChoiceOf({ status: 'started' })).toBeNull();
    expect(cancellationChoiceOf({ status: 'requested' })).toBe('requested');
    expect(cancellationChoiceOf({ status: 'confirmed' })).toBe('confirmed');
  });

  it("n'envoie rien quand le choix ne change pas", () => {
    expect(cancellationStatusFor('active', null)).toBeNull();
    expect(cancellationStatusFor('requested', { status: 'requested' })).toBeNull();
  });

  it('abandonne la démarche en revenant à « Actif », sans l’effacer', () => {
    expect(cancellationStatusFor('active', { status: 'started' })).toBe('abandoned');
    expect(cancellationStatusFor('active', { status: 'confirmed' })).toBe('abandoned');
  });

  it('enregistre le statut choisi', () => {
    expect(cancellationStatusFor('requested', null)).toBe('requested');
    expect(cancellationStatusFor('confirmed', { status: 'started' })).toBe('confirmed');
  });
});
