import type { CancellationStatus, Payment, ProviderCategory } from '@subtracker/contracts';
import { formatDate, formatMoney } from '@/lib/format';

export const PROVIDER_CATEGORY_LABELS: Record<ProviderCategory, string> = {
  music: 'Musique',
  video: 'Streaming vidéo',
  ai: 'Intelligence artificielle',
  software: 'Logiciel',
  cloud: 'Stockage en ligne',
  gaming: 'Jeu vidéo',
  news: 'Presse',
  sport: 'Sport',
  telecom: 'Télécom',
  delivery: 'Livraison',
  other: 'Autre',
};

export const GENERIC_CANCELLATION_INSTRUCTIONS =
  'Cherchez dans votre espace client une rubrique « Abonnement » ou « Résiliation » : les contrats souscrits en ligne doivent en principe pouvoir être résiliés en ligne. À défaut, envoyez une lettre recommandée avec accusé de réception en indiquant vos références client, et conservez la preuve d’envoi.';

const SENTENCE_BOUNDARY = /([.!?])\s+(?=[\p{Lu}«])/gu;

/** Le catalogue décrit chaque procédure en un seul texte : chaque phrase devient une étape numérotée. */
export function splitInstructionSteps(instructions: string): string[] {
  return instructions
    .replace(SENTENCE_BOUNDARY, '$1\n')
    .split('\n')
    .map((step) => step.trim())
    .filter(Boolean);
}

export interface PaymentBar {
  id: string;
  monthLabel: string;
  /** Hauteur relative au plus gros paiement affiché, entre 0 et 1. */
  heightRatio: number;
}

const PAYMENT_HISTORY_SIZE = 6;
const MIN_BAR_RATIO = 0.15;

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

function byDateAscending(a: Payment, b: Payment): number {
  return a.date.localeCompare(b.date);
}

export function latestPayments(payments: Payment[], size = PAYMENT_HISTORY_SIZE): Payment[] {
  return [...payments].sort(byDateAscending).slice(-size);
}

/** `payments` : du plus ancien au plus récent, comme le renvoie `latestPayments`. */
export function paymentBars(payments: Payment[]): PaymentBar[] {
  const largestCents = Math.max(0, ...payments.map((payment) => payment.amount.cents));
  return payments.map((payment) => ({
    id: payment.id,
    monthLabel: monthFormatter.format(new Date(`${payment.date}T00:00:00Z`)),
    heightRatio: largestCents > 0 ? Math.max(MIN_BAR_RATIO, payment.amount.cents / largestCents) : MIN_BAR_RATIO,
  }));
}

function formatPayment(payment: Payment): string {
  return formatMoney(payment.amount.cents, payment.amount.currency);
}

/** Libellé accessible du graphique : les barres seules ne disent rien à un lecteur d'écran. */
export function describePaymentHistory(payments: Payment[]): string {
  const latest = payments.at(-1);
  if (!latest) return 'Aucun paiement enregistré';
  if (payments.length === 1) return `Dernier paiement : ${formatPayment(latest)} le ${formatDate(latest.date)}`;
  const smallest = payments.reduce((min, payment) => (payment.amount.cents < min.amount.cents ? payment : min), latest);
  const largest = payments.reduce((max, payment) => (payment.amount.cents > max.amount.cents ? payment : max), latest);
  const intro = `${payments.length} derniers paiements`;
  if (smallest.amount.cents === largest.amount.cents) return `${intro}, tous de ${formatPayment(latest)}`;
  return `${intro}, de ${formatPayment(smallest)} à ${formatPayment(largest)} ; le plus récent : ${formatPayment(latest)} le ${formatDate(latest.date)}`;
}

/** `abandoned` sort de la progression : la démarche n'avance plus. */
export const CANCELLATION_PROGRESS: { status: Exclude<CancellationStatus, 'abandoned'>; label: string }[] = [
  { status: 'started', label: 'Commencée' },
  { status: 'requested', label: 'Demandée' },
  { status: 'confirmed', label: 'Confirmée' },
];
