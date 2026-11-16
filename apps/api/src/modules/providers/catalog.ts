/**
 * Catalogue initial : services d'abonnement courants en France.
 *
 * - `matchPatterns` : expressions testées sur le libellé bancaire normalisé
 *   (majuscules, sans accents, ponctuation remplacée par des espaces).
 * - `cancellation.url` : parcours officiel quand il existe ; `instructions` : toujours présentes.
 * - `lastVerifiedAt` : date à laquelle la procédure a été confirmée sur la page officielle (`sourceUrl`).
 *   `null` = non vérifiée (page inaccessible ou trop générique) : l'application l'indique à l'utilisateur.
 *   Vérification du 16/11/2026 : spotify, netflix, apple, youtube-premium, adobe, chatgpt, claude, google-one, deezer.
 */
export interface CatalogEntry {
  slug: string;
  name: string;
  category: string;
  website: string | null;
  matchPatterns: string[];
  cancellation: {
    method: 'online' | 'in_app' | 'email' | 'letter' | 'phone' | 'in_person';
    url: string | null;
    instructions: string;
    sourceUrl: string | null;
    lastVerifiedAt: string | null;
  };
}

const VERIFIED = '2026-11-16';
const UNVERIFIED = null;

const STORE_NOTE =
  ' Si l’abonnement a été souscrit via l’App Store ou Google Play, il se résilie depuis le store (réglages du téléphone > abonnements).';

export const PROVIDER_CATALOG: CatalogEntry[] = [
  {
    slug: 'spotify',
    name: 'Spotify',
    category: 'music',
    website: 'https://www.spotify.com/fr/',
    matchPatterns: ['\\bSPOTIFY\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.spotify.com/fr/account/subscription/',
      instructions:
        'Connectez-vous sur spotify.com, page « Gérer votre abonnement », puis choisissez d’annuler. L’accès Premium reste actif jusqu’à la fin de la période payée.' +
        STORE_NOTE,
      sourceUrl: 'https://support.spotify.com/fr/article/cancel-premium/',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'deezer',
    name: 'Deezer',
    category: 'music',
    website: 'https://www.deezer.com/fr/',
    matchPatterns: ['\\bDEEZER\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.deezer.com/account/subscription',
      instructions:
        'Sur deezer.com : profil > Paramètres du compte > Gérer mon abonnement, puis résiliez et confirmez. Un abonnement souscrit via Apple ou via un partenaire (opérateur) se résilie auprès de celui-ci.' +
        STORE_NOTE,
      sourceUrl: 'https://support.deezer.com/hc/en-gb/articles/214349245-Cancel-Your-Deezer-Subscription',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'apple',
    name: 'Apple (iCloud+, Music, TV+, Arcade)',
    category: 'cloud',
    website: 'https://www.apple.com/fr/',
    matchPatterns: ['\\bAPPLE COM\\b', '\\bITUNES\\b', '\\bAPPLE COM BILL\\b'],
    cancellation: {
      method: 'in_app',
      url: 'https://support.apple.com/fr-fr/118428',
      instructions:
        'Sur iPhone ou iPad : Réglages > votre nom > Abonnements, choisissez l’abonnement puis « Annuler l’abonnement ». Sur Mac : App Store > votre profil > Réglages du compte > Abonnements.',
      sourceUrl: 'https://support.apple.com/fr-fr/118428',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    category: 'video',
    website: 'https://www.youtube.com/premium',
    matchPatterns: ['\\bYOUTUBE\\b', '\\bGOOGLE YOUTUBE\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.youtube.com/paid_memberships',
      instructions:
        'Sur youtube.com, menu « Achats et abonnements », choisissez l’abonnement puis « Désactiver ».' + STORE_NOTE,
      sourceUrl: 'https://support.google.com/youtube/answer/6308278?hl=fr',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'netflix',
    name: 'Netflix',
    category: 'video',
    website: 'https://www.netflix.com/fr/',
    matchPatterns: ['\\bNETFLIX\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.netflix.com/cancelplan',
      instructions:
        'Connectez-vous sur netflix.com, page Compte, puis « Annuler l’abonnement ». Si Netflix est facturé par un opérateur ou une box, résiliez auprès de ce partenaire.',
      sourceUrl: 'https://help.netflix.com/fr/node/407',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'disney-plus',
    name: 'Disney+',
    category: 'video',
    website: 'https://www.disneyplus.com/fr-fr',
    matchPatterns: ['\\bDISNEY ?PLUS\\b', '\\bDISNEYPLUS\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.disneyplus.com/account/subscription',
      instructions:
        'Connectez-vous sur disneyplus.com depuis un navigateur, Compte > Abonnement, puis « Résilier l’abonnement ».' +
        STORE_NOTE,
      sourceUrl: 'https://help.disneyplus.com/fr-FR/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'amazon-prime',
    name: 'Amazon Prime',
    category: 'video',
    website: 'https://www.amazon.fr/prime',
    matchPatterns: ['\\bAMAZON PRIME\\b', '\\bPRIME VIDEO\\b', '\\bAMZN PRIME\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.amazon.fr/mc/pipelines/cancellation',
      instructions:
        'Sur amazon.fr, rubrique « Gérer mon abonnement Prime », puis « Mettre fin à l’abonnement » et confirmez chaque étape.',
      sourceUrl: 'https://www.amazon.fr/gp/help/customer/display.html?nodeId=G34EUPKVMYFW8N2U',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'canal-plus',
    name: 'Canal+',
    category: 'video',
    website: 'https://www.canalplus.com/',
    matchPatterns: ['\\bCANAL ?PLUS\\b', '^CANAL\\b', '\\bGROUPE CANAL\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.canalplus.com/',
      instructions:
        'Depuis votre espace client Canal+, rubrique de gestion du contrat, utilisez la fonctionnalité de résiliation. Vérifiez la date d’engagement de votre offre avant de résilier.',
      sourceUrl: 'https://client.canalplus.com/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'crunchyroll',
    name: 'Crunchyroll',
    category: 'video',
    website: 'https://www.crunchyroll.com/fr',
    matchPatterns: ['\\bCRUNCHYROLL\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.crunchyroll.com/account/membership',
      instructions: 'Sur crunchyroll.com, Paramètres du compte > Abonnement, puis annulez.' + STORE_NOTE,
      sourceUrl: 'https://help.crunchyroll.com/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'chatgpt',
    name: 'ChatGPT (OpenAI)',
    category: 'ai',
    website: 'https://chatgpt.com/',
    matchPatterns: ['\\bCHATGPT\\b', '\\bOPENAI\\b'],
    cancellation: {
      method: 'online',
      url: 'https://chatgpt.com/#settings/Subscription',
      instructions:
        'Sur chatgpt.com : icône du profil > Paramètres > Facturation, puis « Annuler » sous « Annuler l’offre ». L’accès reste actif jusqu’à la fin de la période payée ; supprimer le compte ne résilie pas un abonnement App Store.' +
        STORE_NOTE,
      sourceUrl: 'https://help.openai.com/en/articles/7232927',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'claude',
    name: 'Claude (Anthropic)',
    category: 'ai',
    website: 'https://claude.ai/',
    matchPatterns: ['\\bANTHROPIC\\b', '\\bCLAUDE AI\\b'],
    cancellation: {
      method: 'online',
      url: 'https://claude.ai/settings/billing',
      instructions:
        'Sur claude.ai ou Claude Desktop : vos initiales > Paramètres > Facturation, puis « Annuler ». Résiliez au moins 24 h avant la prochaine échéance ; l’accès reste actif jusqu’à la fin de la période payée.' +
        STORE_NOTE,
      sourceUrl: 'https://support.claude.com/en/articles/8325617',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'github',
    name: 'GitHub (Copilot, Pro)',
    category: 'software',
    website: 'https://github.com/',
    matchPatterns: ['\\bGITHUB\\b'],
    cancellation: {
      method: 'online',
      url: 'https://github.com/settings/billing',
      instructions: 'Sur github.com, Settings > Billing and licensing, puis annulez ou rétrogradez le plan concerné.',
      sourceUrl: 'https://docs.github.com/fr/billing',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'microsoft-365',
    name: 'Microsoft 365 / Xbox Game Pass',
    category: 'software',
    website: 'https://www.microsoft.com/fr-fr/microsoft-365',
    matchPatterns: ['\\bMICROSOFT\\b', '\\bMSFT\\b', '\\bXBOX\\b'],
    cancellation: {
      method: 'online',
      url: 'https://account.microsoft.com/services',
      instructions:
        'Sur account.microsoft.com, rubrique « Services et abonnements », choisissez l’abonnement puis « Gérer » > « Annuler l’abonnement » ou désactivez le renouvellement.',
      sourceUrl: 'https://support.microsoft.com/fr-fr/account-billing',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'google-one',
    name: 'Google One',
    category: 'cloud',
    website: 'https://one.google.com/',
    matchPatterns: ['\\bGOOGLE ONE\\b', '\\bGOOGLE STORAGE\\b'],
    cancellation: {
      method: 'online',
      url: 'https://one.google.com/settings',
      instructions: 'Sur one.google.com, Paramètres > « Annuler l’abonnement ».' + STORE_NOTE,
      sourceUrl: 'https://support.google.com/googleone?hl=fr',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'dropbox',
    name: 'Dropbox',
    category: 'cloud',
    website: 'https://www.dropbox.com/',
    matchPatterns: ['\\bDROPBOX\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.dropbox.com/account/plan',
      instructions: 'Sur dropbox.com, Paramètres > Forfait, puis « Annuler le forfait ».' + STORE_NOTE,
      sourceUrl: 'https://help.dropbox.com/fr-fr/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'adobe',
    name: 'Adobe Creative Cloud',
    category: 'software',
    website: 'https://www.adobe.com/fr/',
    matchPatterns: ['\\bADOBE\\b'],
    cancellation: {
      method: 'online',
      url: 'https://account.adobe.com/plans',
      instructions:
        'Sur account.adobe.com, rubrique Plans, « Gérer le plan » puis « Annuler votre plan ». Le remboursement dépend de la date d’annulation (intégral dans les 14 jours suivant l’achat pour la plupart des plans) : lisez le récapitulatif avant de confirmer.',
      sourceUrl: 'https://helpx.adobe.com/fr/manage-account/using/cancel-subscription.html',
      lastVerifiedAt: VERIFIED,
    },
  },
  {
    slug: 'notion',
    name: 'Notion',
    category: 'software',
    website: 'https://www.notion.com/',
    matchPatterns: ['\\bNOTION\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.notion.so/',
      instructions:
        'Dans Notion, Paramètres > Facturation (ou Abonnement) de l’espace de travail, puis rétrogradez vers l’offre gratuite.',
      sourceUrl: 'https://www.notion.com/help',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'playstation-plus',
    name: 'PlayStation Plus',
    category: 'gaming',
    website: 'https://www.playstation.com/fr-fr/ps-plus/',
    matchPatterns: ['\\bPLAYSTATION\\b', '\\bSONY INTERACTIVE\\b', '\\bPSN\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.playstation.com/fr-fr/support/subscriptions/cancel-playstation-subscription/',
      instructions:
        'Depuis la gestion du compte PlayStation (navigateur ou console), rubrique Abonnements, désactivez le renouvellement automatique.',
      sourceUrl: 'https://www.playstation.com/fr-fr/support/subscriptions/cancel-playstation-subscription/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'nintendo-switch-online',
    name: 'Nintendo Switch Online',
    category: 'gaming',
    website: 'https://www.nintendo.com/fr-fr/',
    matchPatterns: ['\\bNINTENDO\\b'],
    cancellation: {
      method: 'online',
      url: 'https://accounts.nintendo.com/',
      instructions:
        'Depuis le Nintendo eShop ou le site du compte Nintendo, rubrique abonnement, désactivez le renouvellement automatique.',
      sourceUrl: 'https://www.nintendo.com/fr-fr/Assistance/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'audible',
    name: 'Audible',
    category: 'news',
    website: 'https://www.audible.fr/',
    matchPatterns: ['\\bAUDIBLE\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.audible.fr/account/overview',
      instructions:
        'Sur audible.fr (navigateur), Détails du compte > « Résilier l’abonnement ». Utilisez vos crédits restants avant : ils sont perdus à la résiliation.',
      sourceUrl: 'https://www.audible.fr/help',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'le-monde',
    name: 'Le Monde',
    category: 'news',
    website: 'https://www.lemonde.fr/',
    matchPatterns: ['\\bLE MONDE\\b', '\\bSOCIETE EDITRICE DU MONDE\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.lemonde.fr/',
      instructions:
        'Depuis votre espace abonné, rubrique de gestion de l’abonnement, utilisez la fonction de résiliation ; à défaut, contactez le service abonnés.',
      sourceUrl: 'https://www.lemonde.fr/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'duolingo',
    name: 'Duolingo Super',
    category: 'software',
    website: 'https://www.duolingo.com/',
    matchPatterns: ['\\bDUOLINGO\\b'],
    cancellation: {
      method: 'in_app',
      url: null,
      instructions:
        'L’abonnement se résilie là où il a été souscrit : depuis le store (App Store ou Google Play) pour un achat dans l’application, sinon depuis les paramètres du compte sur duolingo.com.',
      sourceUrl: 'https://support.duolingo.com/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'uber-one',
    name: 'Uber One',
    category: 'delivery',
    website: 'https://www.uber.com/fr/fr/u/uber-one/',
    matchPatterns: ['\\bUBER ONE\\b'],
    cancellation: {
      method: 'in_app',
      url: null,
      instructions:
        'Dans l’application Uber ou Uber Eats : Compte > Uber One > Gérer l’abonnement > Mettre fin à l’abonnement.',
      sourceUrl: 'https://help.uber.com/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'deliveroo-plus',
    name: 'Deliveroo Plus',
    category: 'delivery',
    website: 'https://deliveroo.fr/',
    matchPatterns: ['\\bDELIVEROO\\b'],
    cancellation: {
      method: 'in_app',
      url: null,
      instructions: 'Dans l’application ou sur deliveroo.fr : Compte > Deliveroo Plus > gérer ou annuler l’abonnement.',
      sourceUrl: 'https://deliveroo.fr/fr/faq',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'basic-fit',
    name: 'Basic-Fit',
    category: 'sport',
    website: 'https://www.basic-fit.com/fr-fr',
    matchPatterns: ['\\bBASIC ?FIT\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.basic-fit.com/fr-fr',
      instructions:
        'Depuis l’espace membre (site ou application), rubrique abonnement, demandez la résiliation. Vérifiez la durée d’engagement et le préavis prévus par votre contrat.',
      sourceUrl: 'https://www.basic-fit.com/fr-fr',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'free',
    name: 'Free (mobile, Freebox)',
    category: 'telecom',
    website: 'https://www.free.fr/',
    matchPatterns: ['\\bFREE MOBILE\\b', '\\bFREE TELECOM\\b', '\\bFREEBOX\\b'],
    cancellation: {
      method: 'letter',
      url: 'https://mobile.free.fr/account/',
      instructions:
        'Depuis l’espace abonné, rubrique de résiliation, ou par lettre recommandée avec accusé de réception. Pensez à la portabilité (code RIO) si vous changez d’opérateur : la résiliation est alors automatique.',
      sourceUrl: 'https://assistance.free.fr/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'orange',
    name: 'Orange / Sosh',
    category: 'telecom',
    website: 'https://www.orange.fr/',
    matchPatterns: ['\\bORANGE SA\\b', '\\bORANGE FRANCE\\b', '\\bSOSH\\b'],
    cancellation: {
      method: 'online',
      url: 'https://espace-client.orange.fr/',
      instructions:
        'Depuis l’espace client, rubrique de gestion de l’offre, utilisez la fonction de résiliation. En cas de changement d’opérateur avec portabilité (code RIO), la résiliation est automatique.',
      sourceUrl: 'https://assistance.orange.fr/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'sfr',
    name: 'SFR / RED by SFR',
    category: 'telecom',
    website: 'https://www.sfr.fr/',
    matchPatterns: ['\\bSFR\\b', '\\bRED BY SFR\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.sfr.fr/mon-espace-client/',
      instructions:
        'Depuis l’espace client, rubrique de résiliation de l’offre. En cas de portabilité (code RIO) vers un autre opérateur, la résiliation est automatique.',
      sourceUrl: 'https://assistance.sfr.fr/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
  {
    slug: 'bouygues-telecom',
    name: 'Bouygues Telecom / B&You',
    category: 'telecom',
    website: 'https://www.bouyguestelecom.fr/',
    matchPatterns: ['\\bBOUYGUES TELECOM\\b', '\\bBOUYGUES TEL\\b', '\\bB YOU\\b'],
    cancellation: {
      method: 'online',
      url: 'https://www.bouyguestelecom.fr/mon-compte',
      instructions:
        'Depuis l’espace client, rubrique de gestion de la ligne ou de la box, utilisez la fonction de résiliation. La portabilité (code RIO) résilie automatiquement l’ancienne offre.',
      sourceUrl: 'https://www.assistance.bouyguestelecom.fr/',
      lastVerifiedAt: UNVERIFIED,
    },
  },
];

/** Procédure générique proposée pour un fournisseur absent du catalogue. */
export const GENERIC_CANCELLATION_INSTRUCTIONS =
  'Cherchez dans votre espace client une rubrique « Abonnement » ou « Résiliation » : les contrats souscrits en ligne doivent en principe pouvoir être résiliés en ligne. À défaut, envoyez une lettre recommandée avec accusé de réception en indiquant vos références client, et conservez la preuve d’envoi.';
