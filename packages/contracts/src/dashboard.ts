import { z } from 'zod';
import { CentsSchema, CurrencySchema, IdSchema, IsoDateSchema, OriginSchema } from './common';
import { BankLinkStatusSchema } from './bank';

export const DashboardSummarySchema = z.object({
  currency: CurrencySchema,
  /** Abonnements suivis (actifs + résiliation en cours). */
  trackedCount: z.number().int(),
  monthly: z.object({
    totalCents: CentsSchema,
    /** Part tirée des paiements bancaires observés. */
    observedCents: CentsSchema,
    /** Part déclarée ou corrigée par l'utilisateur. */
    declaredCents: CentsSchema,
  }),
  /** Projection sur 12 mois : toujours une estimation. */
  annualProjectionCents: CentsSchema,
  /** Abonnements dans une autre devise, exclus du total. */
  excludedOtherCurrencies: z.array(z.object({ currency: CurrencySchema, count: z.number().int() })),
  upcoming: z.array(
    z.object({
      subscriptionId: IdSchema,
      label: z.string(),
      date: IsoDateSchema,
      dateOrigin: OriginSchema,
      amountCents: CentsSchema,
      currency: CurrencySchema,
    }),
  ),
  pendingCandidates: z.number().int(),
  missingPayments: z.number().int(),
  bank: z.object({ status: BankLinkStatusSchema, consentExpiringSoon: z.boolean() }).nullable(),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
