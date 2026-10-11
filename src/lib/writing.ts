import type { CharacterJson } from 'hanzi-writer';

export interface WritingAssessment { strokeCount: number; totalMistakes: number; usedHint: boolean }
export interface WritingResult extends WritingAssessment { character: string; durationMs: number }
const dataCache = new Map<string, Promise<CharacterJson>>();
export function validateWriting(result: WritingAssessment) {
  if (!Number.isInteger(result.strokeCount) || result.strokeCount < 1
    || !Number.isInteger(result.totalMistakes) || result.totalMistakes < 0 || typeof result.usedHint !== 'boolean') {
    throw new Error('Kết quả viết không hợp lệ.');
  }
}
export function loadStrokeData(character: string): Promise<CharacterJson> {
  if (!dataCache.has(character)) {
    // Dữ liệu nét được build tại chỗ; không tải CDN để quiz vẫn hoạt động offline.
    const loading = fetch(`/data/strokes/${encodeURIComponent(character)}.json`).then(async response => {
      if (!response.ok) throw new Error(`Chưa tải được mẫu nét cho chữ ${character}. Hãy kết nối mạng và thử lại.`);
      const data = await response.json() as CharacterJson;
      if (!data.strokes?.length || data.medians?.length !== data.strokes.length) throw new Error('Mẫu nét không hợp lệ.');
      return data;
    }).catch(error => { dataCache.delete(character); throw error; });
    dataCache.set(character, loading);
  }
  return dataCache.get(character)!;
}