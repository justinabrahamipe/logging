// Shared zod helpers for entity schemas.
// All schemas in lib/schemas/ should import these instead of redefining.

import { z } from "zod";

// Treat empty strings/nulls coming from form inputs as "field not provided".
// Used as a preprocess step on number/string fields so zod doesn't reject "".
export const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const numField = () => z.preprocess(blankToUndefined, z.number().optional());
export const nullableNumField = () => z.preprocess(blankToUndefined, z.number().nullable().optional());
export const intField = () => z.preprocess(blankToUndefined, z.number().int().nullable().optional());
export const strField = () => z.preprocess(blankToUndefined, z.string().optional());
export const nullableStrField = () => z.preprocess(blankToUndefined, z.string().nullable().optional());
