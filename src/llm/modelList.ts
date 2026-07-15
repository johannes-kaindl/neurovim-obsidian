/** Pure parsing of an OpenAI-compatible GET /v1/models response body. */
export function extractModelIds(body: unknown): string[] {
  const data = (body as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => (m !== null && typeof m === 'object' && typeof (m as { id?: unknown }).id === 'string'
      ? (m as { id: string }).id
      : null))
    .filter((id): id is string => id !== null);
}
