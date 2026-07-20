const CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const ANGLE_BRACKETS = /[<>]/g;

export function sanitizeText(
  value: unknown,
  options: {
    maxLength?: number;
    multiline?: boolean;
  } = {},
): string {
  const {
    maxLength = 255,
    multiline = false,
  } = options;

  const source =
    typeof value === "string"
      ? value
      : String(value ?? "");

  return source
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(ANGLE_BRACKETS, "")
    .replace(
      multiline ? /\r\n?/g : /[\r\n\t]+/g,
      multiline ? "\n" : " ",
    )
    .trim()
    .slice(0, maxLength);
}

export function sanitizeNullableText(
  value: unknown,
  options?: {
    maxLength?: number;
    multiline?: boolean;
  },
): string | null {
  const result = sanitizeText(value, options);

  return result.length > 0 ? result : null;
}

export function sanitizePhone(
  value: unknown,
): string {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 15);
}

export function sanitizeInstagram(
  value: unknown,
): string | null {
  const result = sanitizeText(value, {
    maxLength: 50,
  })
    .replace(
      /^https?:\/\/(www\.)?instagram\.com\//i,
      "",
    )
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._]/g, "");

  return result || null;
}

export function sanitizeColor(
  value: unknown,
  fallback: string,
): string {
  const color = String(value ?? "").trim();

  return /^#[0-9a-fA-F]{6}$/.test(color)
    ? color
    : fallback;
}

export function sanitizeSlug(
  value: unknown,
): string {
  return sanitizeText(value, {
    maxLength: 80,
  })
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function sanitizeNonNegativeNumber(
  value: unknown,
  options: {
    nullable?: boolean;
    max?: number;
  } = {},
): number | null {
  const {
    nullable = false,
    max = 999999999,
  } = options;

  if (
    nullable &&
    (value === "" ||
      value === null ||
      value === undefined)
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return nullable ? null : 0;
  }

  return Math.min(
    Math.max(number, 0),
    max,
  );
}

export function sanitizeInteger(
  value: unknown,
  max = 999999,
): number {
  return Math.trunc(
    sanitizeNonNegativeNumber(value, {
      max,
    }) ?? 0,
  );
}