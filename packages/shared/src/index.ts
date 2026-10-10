import { z } from "zod";

// --- Enums & Literals ---
export const AoiKindSchema = z.enum(["curated", "user"]);
export type AoiKind = z.infer<typeof AoiKindSchema>;

export const ObservationKindSchema = z.enum(["scene", "composite"]);
export type ObservationKind = z.infer<typeof ObservationKindSchema>;

export const ObservationStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);
export type ObservationStatus = z.infer<typeof ObservationStatusSchema>;

export const ModelStatusSchema = z.enum(["reference", "baseline", "prototype", "validated"]);
export type ModelStatus = z.infer<typeof ModelStatusSchema>;

export const AnalysisStatusSchema = z.enum(["queued", "running", "ready", "failed"]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const ConfidenceClassSchema = z.enum(["low", "medium", "high"]);
export type ConfidenceClass = z.infer<typeof ConfidenceClassSchema>;

export const JobStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobTypeSchema = z.enum([
  "ingest_observations",
  "compute_forest_mask",
  "run_change_analysis",
]);
export type JobType = z.infer<typeof JobTypeSchema>;

// --- Core Models ---
export const AoiSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  countryCode: z.string().length(3),
  countryName: z.string().optional(),
  biome: z.string().optional(),
  areaKm2: z.number().positive(),
  kind: AoiKindSchema,
  isDemo: z.boolean().default(false),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  geojson: z.any().optional(),
  createdAt: z.string().datetime(),
});
export type Aoi = z.infer<typeof AoiSchema>;

export const AoiSummarySchema = AoiSchema.extend({
  latestObservationDate: z.string().nullable(),
  observationCount: z.number().int().nonnegative(),
  analysisCount: z.number().int().nonnegative(),
  totalLossHa: z.number().nonnegative().optional(),
});
export type AoiSummary = z.infer<typeof AoiSummarySchema>;

export const ProvenanceSchema = z.object({
  provider: z.string(),
  collection: z.string().optional(),
  sceneIds: z.array(z.string()).default([]),
  platform: z.string().optional(),
  processingBaseline: z.string().optional(),
  processedAt: z.string().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const PreviewBoundsSchema = z.tuple([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
]);
export type PreviewBounds = z.infer<typeof PreviewBoundsSchema>;

export const ObservationSchema = z.object({
  id: z.string().uuid(),
  aoiId: z.string().uuid(),
  kind: ObservationKindSchema,
  acquiredAt: z.string(), // YYYY-MM-DD
  windowStart: z.string().nullable().optional(),
  windowEnd: z.string().nullable().optional(),
  validFraction: z.number().min(0).max(1),
  cloudFraction: z.number().min(0).max(1),
  usable: z.boolean(),
  unusableReason: z.string().nullable().optional(),
  sceneIds: z.array(z.string()).default([]),
  bandsUri: z.string().nullable().optional(),
  previewUri: z.string().nullable().optional(),
  previewBounds: z.any().nullable().optional(),
  provenance: ProvenanceSchema.optional(),
  status: ObservationStatusSchema,
  error: z.string().nullable().optional(),
  forestAreaHa: z.number().nullable().optional(),
  forestFraction: z.number().nullable().optional(),
  forestOverlayUri: z.string().nullable().optional(),
  densityOverlayUri: z.string().nullable().optional(),
  densityCogUri: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
  modelStatus: z.string().nullable().optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const DensitySampleResultSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  density: z.number().nullable(),
  isCloudOrNodata: z.boolean(),
  acquiredAt: z.string().optional(),
  modelName: z.string().optional(),
  modelStatus: z.string().optional(),
});
export type DensitySampleResult = z.infer<typeof DensitySampleResultSchema>;

export const TreeCoverSampleResultSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  treeCoverSharePercent: z.number().nullable(),
  isCovered: z.boolean(),
  source: z.string(),
  year: z.string(),
  reason: z.string().optional(),
});
export type TreeCoverSampleResult = z.infer<typeof TreeCoverSampleResultSchema>;

export const ModelVersionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  arch: z.string(),
  status: ModelStatusSchema,
  weightsUri: z.string().nullable().optional(),
  config: z.record(z.any()).optional(),
  trainRegions: z.any().optional(),
  metrics: z.record(z.any()).nullable().optional(),
  ece: z.number().nullable().optional(),
  gitSha: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type ModelVersion = z.infer<typeof ModelVersionSchema>;

export const ForestMaskSchema = z.object({
  id: z.string().uuid(),
  observationId: z.string().uuid(),
  modelVersionId: z.string().uuid(),
  forestAreaHa: z.number().nonnegative(),
  forestFraction: z.number().min(0).max(1),
  meanConfidence: z.number().min(0).max(1),
  validFraction: z.number().min(0).max(1),
  probUri: z.string().nullable().optional(),
  maskUri: z.string().nullable().optional(),
  overlayUri: z.string().nullable().optional(),
  densityOverlayUri: z.string().nullable().optional(),
  densityCogUri: z.string().nullable().optional(),
});
export type ForestMask = z.infer<typeof ForestMaskSchema>;

export const AnalysisParamsSchema = z.object({
  tHigh: z.number().default(0.70),
  tLow: z.number().default(0.30),
  minMappingUnitHa: z.number().default(0.50),
  minNdviDrop: z.number().default(0.15),
  minNbrDrop: z.number().default(0.10),
  seasonToleranceDays: z.number().default(45),
});
export type AnalysisParams = z.infer<typeof AnalysisParamsSchema>;

export const AnalysisSchema = z.object({
  id: z.string().uuid(),
  aoiId: z.string().uuid(),
  obsT0Id: z.string().uuid(),
  obsT1Id: z.string().uuid(),
  modelVersionId: z.string().uuid(),
  params: AnalysisParamsSchema,
  status: AnalysisStatusSchema,
  error: z.string().nullable().optional(),
  totalLossHa: z.number().nonnegative().nullable(),
  detectionCount: z.number().int().nonnegative().nullable(),
  warnings: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable().optional(),
  model: ModelVersionSchema.optional(),
  obsT0: ObservationSchema.optional(),
  obsT1: ObservationSchema.optional(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const DetectionSchema = z.object({
  id: z.string().uuid(),
  analysisId: z.string().uuid(),
  geom: z.any(), // GeoJSON Geometry
  centroid: z.tuple([z.number(), z.number()]), // [lon, lat]
  areaHa: z.number().positive(),
  meanPLoss: z.number().min(0).max(1),
  meanNdviDrop: z.number(),
  validFractionT0: z.number().min(0).max(1),
  validFractionT1: z.number().min(0).max(1),
  confirmedPersistent: z.boolean().nullable(),
  confidenceScore: z.number().min(0).max(1),
  confidenceClass: ConfidenceClassSchema,
  isCalibratedConfidence: z.boolean().default(false),
  explanation: z.string(),
  createdAt: z.string().datetime(),
});
export type Detection = z.infer<typeof DetectionSchema>;

export const DatasetSourceSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  version: z.string().nullable().optional(),
  licence: z.string(),
  attribution: z.string(),
  url: z.string().url(),
  description: z.string().optional(),
});
export type DatasetSource = z.infer<typeof DatasetSourceSchema>;

export const GeocodeResultSchema = z.object({
  label: z.string(),
  lat: z.number(),
  lon: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

// --- Timeseries Point ---
export const TimeseriesPointSchema = z.object({
  acquiredAt: z.string(),
  forestAreaHa: z.number().nonnegative(),
  forestFraction: z.number().min(0).max(1),
  usable: z.boolean(),
  modelStatus: ModelStatusSchema,
  modelVersion: z.string(),
  observationKind: ObservationKindSchema,
  lossIntervalHa: z.number().nullable().optional(),
});
export type TimeseriesPoint = z.infer<typeof TimeseriesPointSchema>;

// --- API Request/Response Schemas ---
export const RequestAnalysisBodySchema = z.object({
  t0: z.string().uuid(),
  t1: z.string().uuid(),
  modelVersionId: z.string().uuid().optional(),
  params: AnalysisParamsSchema.partial().optional(),
});
export type RequestAnalysisBody = z.infer<typeof RequestAnalysisBodySchema>;

export const CreateUserAoiBodySchema = z.object({
  name: z.string().min(3).max(100),
  geojson: z.any(),
});
export type CreateUserAoiBody = z.infer<typeof CreateUserAoiBodySchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
