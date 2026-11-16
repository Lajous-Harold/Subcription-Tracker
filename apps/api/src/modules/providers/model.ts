import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/** Catalogue global des fournisseurs, en lecture seule pour les utilisateurs. */
const providerSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    website: { type: String, default: null },
    /** Expressions régulières testées sur les libellés bancaires normalisés. */
    matchPatterns: { type: [String], default: [] },
    cancellation: {
      method: { type: String, required: true },
      url: { type: String, default: null },
      instructions: { type: String, required: true },
      sourceUrl: { type: String, default: null },
      lastVerifiedAt: { type: String, default: null },
    },
  },
  { timestamps: true },
);
providerSchema.index({ name: 'text', slug: 'text' });

export type ProviderDoc = Omit<InferSchemaType<typeof providerSchema>, 'cancellation'> & {
  cancellation: {
    method: string;
    url?: string | null;
    instructions: string;
    sourceUrl?: string | null;
    lastVerifiedAt?: string | null;
  };
  _id: Types.ObjectId;
};
export const ProviderModel = model('Provider', providerSchema);
