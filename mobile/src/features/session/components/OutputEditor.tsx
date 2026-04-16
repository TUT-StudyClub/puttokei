/**
 * アウトプット入力エディター。
 *
 * セッションのアウトプットフェーズで、ユーザーが理解した内容を自由記述する UI。
 * 制御コンポーネントとして `value` / `onChange` / `onSubmit` を受け取り、
 * 親 (OutputScreen) が送信状態・エラー状態を管理する。
 *
 * UX 要件 (Issue #42):
 * - 空送信を防ぐ: `content.trim()` が空のときは送信ボタンを disabled にする
 * - 送信中の二重送信防止: `isSubmitting` で disabled + Spinner 表示
 * - 連打抑止: 「送信する」ボタンは 1 度押すと disable のままになる。
 *   失敗時に表示される「再送する」ボタンを明示的に押した場合のみ再送する。
 *   (送信成功時は親が画面遷移するため自動リセットは不要)
 * - 文字数カウンタを表示し、上限 (`maxLength`) に近づくと視覚で分かる
 */
import { useRef, useState } from 'react';
import { Spinner, Button, SizableText, TextArea, XStack, YStack } from 'tamagui';

export type OutputEditorSubmitPayload = {
  content: string;
  submitted_at: string;
};

export type OutputEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (payload: OutputEditorSubmitPayload) => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
  disabled?: boolean;
  maxLength?: number;
};

const DEFAULT_MAX_LENGTH = 2000;

export function OutputEditor({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
  disabled = false,
  maxLength = DEFAULT_MAX_LENGTH,
}: OutputEditorProps) {
  // 「送信する」を一度押したら true。連打抑止のため、その後の自動再有効化は行わず、
  // 失敗時は別途表示される「再送する」ボタンの明示操作のみで再送する。
  // ref と state を併用しているのは、ref で同一 tick 内の連打を同期的にガードしつつ、
  // state でボタンの disabled 表示を再レンダリングへ反映するため。
  const hasAttemptedRef = useRef(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const trimmed = value.trim();
  const isEmpty = trimmed.length === 0;
  const isOverMax = value.length > maxLength;
  const cannotSubmit = isEmpty || isOverMax || isSubmitting || disabled;
  const submitDisabled = cannotSubmit || hasAttempted;
  const showRetryButton = Boolean(errorMessage) && !isSubmitting;

  const buildPayload = (): OutputEditorSubmitPayload => ({
    content: trimmed,
    submitted_at: new Date().toISOString(),
  });

  const handleSubmit = () => {
    if (cannotSubmit || hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;
    setHasAttempted(true);
    onSubmit(buildPayload());
  };

  const handleRetry = () => {
    if (cannotSubmit) return;
    onSubmit(buildPayload());
  };

  return (
    <YStack gap="$2" width="100%">
      <TextArea
        testID="output-editor-textarea"
        placeholder="学んだ内容を自分の言葉で書いてください"
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        editable={!isSubmitting && !disabled}
        minHeight={160}
      />

      <XStack justifyContent="space-between" alignItems="center">
        <SizableText
          testID="output-editor-count"
          size="$2"
          color={isOverMax ? '$red10' : '$color10'}
        >
          {value.length} / {maxLength}
        </SizableText>
        {errorMessage ? (
          <SizableText
            testID="output-editor-error"
            color="$red10"
            size="$2"
            flex={1}
            marginLeft="$3"
          >
            {errorMessage}
          </SizableText>
        ) : null}
      </XStack>

      <Button
        testID="output-editor-submit"
        onPress={handleSubmit}
        disabled={submitDisabled}
        themeInverse
      >
        {isSubmitting ? <Spinner /> : '送信する'}
      </Button>

      {showRetryButton ? (
        <Button testID="output-editor-retry" onPress={handleRetry} disabled={cannotSubmit}>
          再送する
        </Button>
      ) : null}
    </YStack>
  );
}
