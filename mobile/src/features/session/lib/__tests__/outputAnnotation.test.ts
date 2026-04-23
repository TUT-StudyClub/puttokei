import { buildOutputSegments } from '@/features/session/lib/outputAnnotation';

describe('buildOutputSegments', () => {
  it('corrections が空のときは本文をひと塊の plain として返す', () => {
    const segments = buildOutputSegments('明智光秀は本能寺の変で死んだ', []);
    expect(segments).toEqual([{ type: 'plain', text: '明智光秀は本能寺の変で死んだ' }]);
  });

  it('target_text に一致する部分を correction として切り出し、残りを plain にする', () => {
    const segments = buildOutputSegments('明智光秀は本能寺の変で死んだ', [
      {
        target_text: '明智光秀',
        correct_text: '織田信長は本能寺の変で死んだ',
        explanation: '本能寺の変で死亡したのは織田信長です。',
      },
    ]);
    expect(segments).toEqual([
      { type: 'correction', text: '明智光秀', correctionIndex: 0 },
      { type: 'plain', text: 'は本能寺の変で死んだ' },
    ]);
  });

  it('同じ target_text が複数回現れたら全て correction としてマークする', () => {
    const segments = buildOutputSegments('AはBでありAでもある', [
      {
        target_text: 'A',
        correct_text: 'C',
        explanation: 'A は誤りです。',
      },
    ]);
    expect(segments).toEqual([
      { type: 'correction', text: 'A', correctionIndex: 0 },
      { type: 'plain', text: 'はBであり' },
      { type: 'correction', text: 'A', correctionIndex: 0 },
      { type: 'plain', text: 'でもある' },
    ]);
  });

  it('複数 correction が重なるときは先に現れた長い方を優先する', () => {
    const segments = buildOutputSegments('織田信長を討った', [
      {
        target_text: '織田信長',
        correct_text: '本能寺で自害',
        explanation: '人物名が違います。',
      },
      {
        target_text: '信長',
        correct_text: '正しい表記',
        explanation: '別表記の指摘。',
      },
    ]);
    expect(segments).toEqual([
      { type: 'correction', text: '織田信長', correctionIndex: 0 },
      { type: 'plain', text: 'を討った' },
    ]);
  });

  it('target_text が見つからない correction は無視する', () => {
    const segments = buildOutputSegments('明智光秀は本能寺の変で死んだ', [
      {
        target_text: '徳川家康',
        correct_text: '織田信長',
        explanation: '本文に存在しない指摘。',
      },
    ]);
    expect(segments).toEqual([{ type: 'plain', text: '明智光秀は本能寺の変で死んだ' }]);
  });
});
