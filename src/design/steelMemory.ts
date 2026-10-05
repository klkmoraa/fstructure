/** Se guarda la selección, nunca el resultado derivado ni una copia del modelo. */
export interface SteelMemoryItem {
  readonly memberId: string;
  readonly combinationId: string;
  readonly savedAt: string;
}
export const MAX_STEEL_REVIEWS = 60;
export const isSteelMemory = (value: unknown): value is SteelMemoryItem[] => Array.isArray(value)
  && value.length <= MAX_STEEL_REVIEWS && value.every((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return Object.keys(record).every((key) => ['memberId', 'combinationId', 'savedAt'].includes(key))
      && typeof record.memberId === 'string' && record.memberId.length <= 256
      && typeof record.combinationId === 'string' && record.combinationId.length > 0 && record.combinationId.length <= 256
      && typeof record.savedAt === 'string' && record.savedAt.length <= 32 && Number.isFinite(Date.parse(record.savedAt));
  }) && new Set(value.map((item) => JSON.stringify([item.memberId, item.combinationId]))).size === value.length;
