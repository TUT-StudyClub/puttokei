/**
 * OutputEditor の入力バリデーションと送信 UX を検証する。
 *
 * - 空 / 空白のみのときは送信ボタンを押しても onSubmit が呼ばれない (空送信防止)
 * - 送信中は onSubmit が呼ばれない (二重送信防止)
 * - 送信ボタンは 1 度押すと自動では再有効化されない (連打抑止)
 * - errorMessage を渡すと再送を促すメッセージと「再送する」ボタンが表示され、
 *   明示的な押下のみで再送される
 * - onSubmit は `content: 前後空白を除いた文字列` と `submitted_at: ISO8601` を渡す
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../../tamagui.config';
import { OutputEditor } from '../OutputEditor';

function renderEditor(ui: React.ReactElement) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}

describe('OutputEditor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T15:25:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('初期表示で文字数 0 / 上限を示す', () => {
    const { getByTestId } = renderEditor(
      <OutputEditor value="" onChange={jest.fn()} onSubmit={jest.fn()} isSubmitting={false} />,
    );
    expect(getByTestId('output-editor-count').props.children).toEqual([0, ' / ', 2000]);
  });

  it('value の長さに応じて文字数カウンタが更新される', () => {
    const { getByTestId } = renderEditor(
      <OutputEditor
        value="こんにちは"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        isSubmitting={false}
      />,
    );
    expect(getByTestId('output-editor-count').props.children).toEqual([5, ' / ', 2000]);
  });

  it('value が空のとき送信ボタンを押しても onSubmit は呼ばれない', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor value="" onChange={jest.fn()} onSubmit={onSubmit} isSubmitting={false} />,
    );

    fireEvent.press(getByTestId('output-editor-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('空白のみの入力でも送信は発火しない', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor
        value={'   \n  \n'}
        onChange={jest.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    fireEvent.press(getByTestId('output-editor-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('送信ボタン押下で trim 済み content と ISO8601 の submitted_at が渡される', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor
        value="   本文の内容   "
        onChange={jest.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    );

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });

    expect(onSubmit).toHaveBeenCalledWith({
      content: '本文の内容',
      submitted_at: '2026-04-10T15:25:00.000Z',
    });
  });

  it('送信ボタンを連打しても onSubmit は 1 度しか呼ばれない (連打抑止)', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor value="本文" onChange={jest.fn()} onSubmit={onSubmit} isSubmitting={false} />,
    );
    const button = getByTestId('output-editor-submit');

    act(() => {
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('isSubmitting=true のときは onSubmit が呼ばれず、Spinner が表示される (ラベル非表示)', () => {
    const onSubmit = jest.fn();
    const { getByTestId, queryByText } = renderEditor(
      <OutputEditor value="本文" onChange={jest.fn()} onSubmit={onSubmit} isSubmitting />,
    );

    expect(queryByText('送信する')).toBeNull();

    fireEvent.press(getByTestId('output-editor-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('errorMessage を渡すとエラー文と「再送する」ボタンが表示される', () => {
    const { getByTestId } = renderEditor(
      <OutputEditor
        value="本文"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        isSubmitting={false}
        errorMessage="送信に失敗しました。時間をおいて再度お試しください。"
      />,
    );
    expect(getByTestId('output-editor-error').props.children).toBe(
      '送信に失敗しました。時間をおいて再度お試しください。',
    );
    expect(getByTestId('output-editor-retry')).toBeTruthy();
  });

  it('errorMessage が無いときは「再送する」ボタンは表示されない', () => {
    const { queryByTestId } = renderEditor(
      <OutputEditor value="本文" onChange={jest.fn()} onSubmit={jest.fn()} isSubmitting={false} />,
    );
    expect(queryByTestId('output-editor-retry')).toBeNull();
  });

  it('「再送する」ボタンの押下で onSubmit が呼ばれる', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor
        value="本文"
        onChange={jest.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        errorMessage="送信に失敗しました。"
      />,
    );

    act(() => {
      fireEvent.press(getByTestId('output-editor-retry'));
    });

    expect(onSubmit).toHaveBeenCalledWith({
      content: '本文',
      submitted_at: '2026-04-10T15:25:00.000Z',
    });
  });

  it('送信中は「再送する」ボタンが表示されない', () => {
    const { queryByTestId } = renderEditor(
      <OutputEditor
        value="本文"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        isSubmitting
        errorMessage="送信に失敗しました。"
      />,
    );
    expect(queryByTestId('output-editor-retry')).toBeNull();
  });

  it('「送信する」を押した後は連打しても onSubmit は呼ばれず、「再送する」のみで再送できる', () => {
    const onSubmit = jest.fn();
    const { getByTestId, rerender } = renderEditor(
      <OutputEditor value="本文" onChange={jest.fn()} onSubmit={onSubmit} isSubmitting={false} />,
    );

    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // 親が「失敗」状態を反映してエラーメッセージを渡してくる
    rerender(
      <TamaguiProvider config={config} defaultTheme="light">
        <OutputEditor
          value="本文"
          onChange={jest.fn()}
          onSubmit={onSubmit}
          isSubmitting={false}
          errorMessage="送信に失敗しました。"
        />
      </TamaguiProvider>,
    );

    // 「送信する」ボタンを再度押しても発火しない
    act(() => {
      fireEvent.press(getByTestId('output-editor-submit'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // 「再送する」ボタンの明示操作のみ再送される
    act(() => {
      fireEvent.press(getByTestId('output-editor-retry'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('TextArea の onChangeText で onChange prop が呼ばれる', () => {
    const onChange = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor value="" onChange={onChange} onSubmit={jest.fn()} isSubmitting={false} />,
    );
    const textarea = getByTestId('output-editor-textarea');

    fireEvent.changeText(textarea, '追記');
    expect(onChange).toHaveBeenCalledWith('追記');
  });

  it('disabled=true のときは送信が発火しない', () => {
    const onSubmit = jest.fn();
    const { getByTestId } = renderEditor(
      <OutputEditor
        value="本文"
        onChange={jest.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        disabled
      />,
    );

    fireEvent.press(getByTestId('output-editor-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
