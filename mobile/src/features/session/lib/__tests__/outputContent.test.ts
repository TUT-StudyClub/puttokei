import {
  appendTranscriptToContent,
  buildImageOutputContent,
} from '@/features/session/lib/outputContent';

describe('outputContent', () => {
  it('画像 URI を提出本文に変換する', () => {
    expect(buildImageOutputContent(['file://a.jpg', 'file://b.jpg'])).toBe(
      [
        '画像でアウトプットしました。撮影した学習内容の画像を提出しました。（2枚）',
        '画像1: file://a.jpg',
        '画像2: file://b.jpg',
      ].join('\n'),
    );
  });

  it('画像提出本文を最大長で切り詰める', () => {
    const content = buildImageOutputContent(Array.from({ length: 220 }, (_, i) => `file://${i}`));

    expect(content.length).toBeLessThanOrEqual(2000);
  });

  it('音声認識結果を本文末尾に追記し、重複 final transcript は増やさない', () => {
    expect(appendTranscriptToContent('既存本文  \n', ' 追加文 ')).toBe('既存本文\n追加文');
    expect(appendTranscriptToContent('既存本文\n追加文', '追加文')).toBe('既存本文\n追加文');
    expect(appendTranscriptToContent('', ' 追加文 ')).toBe('追加文');
  });
});
