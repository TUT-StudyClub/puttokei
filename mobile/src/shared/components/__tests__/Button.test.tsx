/**
 * Button が Tamagui の Provider 配下でレンダリングできることを確認する最低限のテスト。
 * 後続 Epic で variant / interaction のテストを追加する。
 */
import { act, cleanup, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';

import config from '../../../../tamagui.config';
import { Button } from '../Button';

describe('Button', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('children を表示する', () => {
    const { getByText } = render(
      <TamaguiProvider config={config} defaultTheme="light">
        <Button testID="primary-button">送信</Button>
      </TamaguiProvider>,
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(getByText('送信')).toBeTruthy();
  });
});
