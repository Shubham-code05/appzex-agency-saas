export type FieldErrors = Record<string, string[] | undefined>;

/** Uniform return shape for Server Actions consumed by client components. */
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };
