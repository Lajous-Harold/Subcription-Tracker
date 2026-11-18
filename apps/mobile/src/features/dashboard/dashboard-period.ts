/** Les montants de l'accueil portent sur le mois en cours : « Novembre 2026 · 6 abonnements suivis ». */
export function describeDashboardPeriod(trackedCount: number, now: Date = new Date()): string {
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(now);
  const tracked = trackedCount === 1 ? '1 abonnement suivi' : `${trackedCount} abonnements suivis`;
  return `${month.charAt(0).toLocaleUpperCase('fr-FR')}${month.slice(1)} · ${tracked}`;
}
