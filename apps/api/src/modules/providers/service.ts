import type { Provider, ProviderSummary } from '@subtracker/contracts';
import type { ProviderPattern } from '@subtracker/detection';
import { notFound } from '../../core/errors';
import { logger } from '../../core/logger';
import { ProviderModel, type ProviderDoc } from './model';
import { PROVIDER_CATALOG } from './catalog';

export function toProviderDto(doc: ProviderDoc): Provider {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    category: doc.category as Provider['category'],
    website: doc.website ?? null,
    cancellation: {
      method: doc.cancellation.method as Provider['cancellation']['method'],
      url: doc.cancellation.url ?? null,
      instructions: doc.cancellation.instructions,
      sourceUrl: doc.cancellation.sourceUrl ?? null,
      lastVerifiedAt: doc.cancellation.lastVerifiedAt,
    },
  };
}

export function toProviderSummary(doc: Pick<ProviderDoc, '_id' | 'slug' | 'name' | 'category'>): ProviderSummary {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    category: doc.category as ProviderSummary['category'],
  };
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listProviders(q?: string): Promise<Provider[]> {
  const filter = q ? { name: { $regex: escapeRegex(q), $options: 'i' } } : {};
  const docs = await ProviderModel.find(filter).sort({ name: 1 }).lean<ProviderDoc[]>();
  return docs.map(toProviderDto);
}

export async function getProviderBySlug(slug: string): Promise<Provider> {
  const doc = await ProviderModel.findOne({ slug }).lean<ProviderDoc>();
  if (!doc) throw notFound('Fournisseur');
  return toProviderDto(doc);
}

export async function providerExists(id: string): Promise<boolean> {
  return Boolean(await ProviderModel.exists({ _id: id }));
}

export async function getProviderPatterns(): Promise<ProviderPattern[]> {
  const docs = await ProviderModel.find({}, { slug: 1, name: 1, matchPatterns: 1 }).lean<ProviderDoc[]>();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    patterns: doc.matchPatterns,
  }));
}

/** Synchronise le catalogue (idempotent, par slug). Appelé au démarrage. */
export async function ensureProviderCatalog(): Promise<number> {
  const operations = PROVIDER_CATALOG.map((entry) => ({
    updateOne: {
      filter: { slug: entry.slug },
      update: { $set: entry },
      upsert: true,
    },
  }));
  const result = await ProviderModel.bulkWrite(operations);
  logger.info({ upserted: result.upsertedCount, modified: result.modifiedCount }, 'Catalogue fournisseurs à jour');
  return PROVIDER_CATALOG.length;
}
