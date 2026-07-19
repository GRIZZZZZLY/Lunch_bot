/**
 * Shared serialization utility for JSON responses.
 * Handles BigInt, Prisma Decimal, and Date values recursively.
 */

/**
 * Recursively converts BigInt, Prisma Decimal, and Date values
 * in an object so it can be safely serialized to JSON.
 */
export function serializeBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle Prisma Decimal objects (have toNumber() method and {s,e,d} shape)
  if (
    typeof obj === 'object' &&
    typeof (obj as any).toNumber === 'function' &&
    's' in (obj) &&
    'e' in (obj) &&
    'd' in (obj)
  ) {
    return (obj as any).toNumber();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt((obj as Record<string, unknown>)[key]);
      }
    }
    return result;
  }

  return obj;
}
