import { z } from "zod";

/**
 * The profile contract (ADR-6). Every field a rule can reference is declared once here,
 * with the kind of value it holds. Personal attributes are stored as bands, never raw
 * values (security baseline §5). Adding a field is backwards compatible; removing or
 * renaming one requires migrating the rules that reference it.
 */

export const PROFILE_SCHEMA_VERSION = 1;

export const LEGAL_FORMS = [
  "none",
  "auto_entrepreneur",
  "sarl",
  "sarl_au",
  "sa",
  "snc",
  "cooperative",
  "association",
  "other",
] as const;

export const AGE_BANDS = ["18_25", "26_35", "36_45", "46_plus"] as const;

/** The 12 regions of the 2015 territorial division. */
export const REGIONS = [
  "tanger-tetouan-al-hoceima",
  "oriental",
  "fes-meknes",
  "rabat-sale-kenitra",
  "beni-mellal-khenifra",
  "casablanca-settat",
  "marrakech-safi",
  "draa-tafilalet",
  "souss-massa",
  "guelmim-oued-noun",
  "laayoune-sakia-el-hamra",
  "dakhla-oued-ed-dahab",
] as const;

export const SECTORS = [
  "agriculture",
  "agrifood",
  "fishing",
  "industry",
  "crafts",
  "construction",
  "commerce",
  "services",
  "digital",
  "tourism",
  "transport_logistics",
  "health",
  "education",
  "energy_environment",
  "culture_sport",
  "other",
] as const;

export const EMPLOYEE_BANDS = ["0", "1_9", "10_49", "50_199", "200_plus"] as const;

/** Annual revenue in MAD. Boundaries follow Maroc PME's TPE / PE / ME thresholds. */
export const REVENUE_BANDS = ["none", "lt_1m", "1m_10m", "10m_50m", "50m_200m", "gt_200m"] as const;

/** Amount of funding sought, in MAD. */
export const AMOUNT_BANDS = ["lt_100k", "100k_500k", "500k_1m", "1m_5m", "gt_5m"] as const;

export const PURPOSES = [
  "create",
  "equip",
  "expand",
  "innovate",
  "digitalise",
  "export",
  "working_capital",
] as const;

export type FieldSpec =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "integer"; min: number; max: number }
  | { kind: "boolean" }
  | { kind: "enum_set"; values: readonly string[] };

export const FIELD_SPECS = {
  legal_form: { kind: "enum", values: LEGAL_FORMS },
  company_age_months: { kind: "integer", min: 0, max: 1200 },
  founder_age_band: { kind: "enum", values: AGE_BANDS },
  is_mre: { kind: "boolean" },
  region: { kind: "enum", values: REGIONS },
  is_rural: { kind: "boolean" },
  sector: { kind: "enum", values: SECTORS },
  employees_band: { kind: "enum", values: EMPLOYEE_BANDS },
  revenue_band: { kind: "enum", values: REVENUE_BANDS },
  need_amount_band: { kind: "enum", values: AMOUNT_BANDS },
  need_purposes: { kind: "enum_set", values: PURPOSES },
  is_innovative: { kind: "boolean" },
} as const satisfies Record<string, FieldSpec>;

export type ProfileField = keyof typeof FIELD_SPECS;

export const PROFILE_FIELDS = Object.keys(FIELD_SPECS) as ProfileField[];

export function isProfileField(value: string): value is ProfileField {
  return Object.hasOwn(FIELD_SPECS, value);
}

/** Every field is optional: the wizard is short and profiles are incomplete by design (ADR-3). */
export const profileDataSchema = z.object({
  legal_form: z.enum(LEGAL_FORMS).optional(),
  company_age_months: z.number().int().min(0).max(1200).optional(),
  founder_age_band: z.enum(AGE_BANDS).optional(),
  is_mre: z.boolean().optional(),
  region: z.enum(REGIONS).optional(),
  is_rural: z.boolean().optional(),
  sector: z.enum(SECTORS).optional(),
  employees_band: z.enum(EMPLOYEE_BANDS).optional(),
  revenue_band: z.enum(REVENUE_BANDS).optional(),
  need_amount_band: z.enum(AMOUNT_BANDS).optional(),
  need_purposes: z
    .array(z.enum(PURPOSES))
    .refine((values) => new Set(values).size === values.length, "Duplicate purposes")
    .optional(),
  is_innovative: z.boolean().optional(),
});

export type ProfileData = z.infer<typeof profileDataSchema>;

// Compile-time guarantee that the Zod schema and FIELD_SPECS declare the same fields.
type SchemaKeys = keyof ProfileData;
type KeysMatch = [Exclude<SchemaKeys, ProfileField>, Exclude<ProfileField, SchemaKeys>] extends [
  never,
  never,
]
  ? true
  : never;
export const PROFILE_KEYS_MATCH_SPECS: KeysMatch = true;
