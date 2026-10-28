import { z } from 'zod';

export const IngestionSourceDepthEnum = z.enum([
  'FULL_TEXT_PDF',
  'FULL_TEXT_JATS_XML',
  'FULL_TEXT_HTML',
  'ABSTRACT_ONLY_FALLBACK',
]);

export type IngestionSourceDepth = z.infer<typeof IngestionSourceDepthEnum>;

export const BibliographicMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  authors: z.array(z.string()).default([]),
  journal: z.string().default('Journal Not Specified'),
  publicationYear: z.number().int().default(new Date().getFullYear()),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  vancouverCitation: z.string(),
  sourceDepth: IngestionSourceDepthEnum,
  openAccess: z.boolean().default(false),
  resolvedUrl: z.string().optional(),
});

export type BibliographicMetadata = z.infer<typeof BibliographicMetadataSchema>;

export const ManuscriptSectionSchema = z.object({
  heading: z.string(),
  content: z.string(),
});

export type ManuscriptSection = z.infer<typeof ManuscriptSectionSchema>;

export const ParsedManuscriptPayloadSchema = z.object({
  id: z.string().uuid().or(z.string()),
  metadata: BibliographicMetadataSchema,
  abstract: z.string(),
  fullText: z.string(),
  sections: z.array(ManuscriptSectionSchema).default([]),
  tablesRaw: z.array(z.string()).default([]),
  detectedStudyTypeHint: z.string().optional(),
  pageCount: z.number().optional(),
  extractedAt: z.string().datetime(),
});

export type ParsedManuscriptPayload = z.infer<typeof ParsedManuscriptPayloadSchema>;

export const IdentifierInputSchema = z.object({
  rawInput: z.string().min(3, 'Identifier or URL is too short').trim(),
});

export type IdentifierInput = z.infer<typeof IdentifierInputSchema>;
