/** Rend littérale une saisie utilisateur avant de l'employer dans un `$regex` MongoDB. */
export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
