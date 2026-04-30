import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import { SizableText } from 'tamagui';

const PRIMARY_COLOR = '#EC4899';
const PRIMARY_SOFT_COLOR = '#FBE4EF';
const ACTION_COLOR = '#4B5CFF';
const METHOD_ACTIVE_COLOR = '#2F2F2F';
const METHOD_INACTIVE_COLOR = '#777777';
const CAPTION_COLOR = '#777777';
const ERROR_COLOR = '#D92D20';

const INPUT_METHODS = ['text', 'image', 'voice'] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];

const INPUT_METHOD_LABELS: Record<InputMethod, string> = {
  text: 'テキスト',
  image: '画像',
  voice: '音声',
};

function InputMethodIcon({
  method,
  color,
  size = 18,
}: {
  method: InputMethod;
  color: string;
  size?: number;
}) {
  switch (method) {
    case 'text':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 18 L14 8 L16 10 L6 20 H4 Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M14 8 L17 5 L19 7 L16 10"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'image':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5 H20 V19 H4 Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={9} cy={10} r={1.6} stroke={color} strokeWidth={1.6} fill="none" />
          <Path
            d="M5 18 L10 13 L14 16 L17 13 L19 15"
            stroke={color}
            strokeWidth={1.6}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'voice':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4 C10.3 4 9 5.3 9 7 V12 C9 13.7 10.3 15 12 15 C13.7 15 15 13.7 15 12 V7 C15 5.3 13.7 4 12 4 Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M6 12 C6 15.3 8.7 18 12 18 C15.3 18 18 15.3 18 12"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M12 18 V21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
  }
}

type InputMethodTabsProps = {
  value: InputMethod;
  onChange: (method: InputMethod) => void;
};

export function InputMethodTabs({ value, onChange }: InputMethodTabsProps) {
  const isImagePanel = value === 'image';

  return (
    <View
      style={[styles.methodTabs, isImagePanel ? styles.methodTabsImagePanel : null]}
      testID="output-method-tabs"
    >
      {INPUT_METHODS.map((method) => {
        const isActive = method === value;
        const color = isActive ? METHOD_ACTIVE_COLOR : METHOD_INACTIVE_COLOR;
        return (
          <Pressable
            key={method}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(method)}
            style={[styles.methodTab, isActive ? styles.methodTabActive : null]}
            testID={`output-method-tab-${method}`}
          >
            <InputMethodIcon method={method} color={color} size={20} />
            <SizableText
              style={[styles.methodTabLabel, isActive ? styles.methodTabLabelActive : null]}
            >
              {INPUT_METHOD_LABELS[method]}
            </SizableText>
          </Pressable>
        );
      })}
    </View>
  );
}

function AddImageIcon({ color = METHOD_ACTIVE_COLOR }: { color?: string }) {
  return (
    <Svg width={42} height={42} viewBox="0 0 48 48" fill="none">
      <Path
        d="M9 12 H32 C34.2 12 36 13.8 36 16 V20"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12 V34 C9 36.2 10.8 38 13 38 H34 C36.2 38 38 36.2 38 34 V27"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={18} cy={21} r={3.5} stroke={color} strokeWidth={3} />
      <Path
        d="M12 35 L22 25 L29 31 L33 27 L38 32"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M39 8 V20" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Path d="M33 14 H45" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

type ImageOutputPanelProps = {
  imageUris: string[];
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onPickFromLibrary: () => void;
  onTakePhoto: () => void;
};

export function ImageOutputPanel({
  imageUris,
  isMenuOpen,
  onToggleMenu,
  onPickFromLibrary,
  onTakePhoto,
}: ImageOutputPanelProps) {
  return (
    <View style={styles.imageOutputPanel} testID="output-image-panel">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.imageGrid}
      >
        {imageUris.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            accessibilityLabel={`撮影済み画像${index + 1}`}
            resizeMode="cover"
            source={{ uri }}
            style={styles.imageThumbnail}
            testID={`output-image-thumbnail-${index}`}
          />
        ))}
        <View style={styles.imageAddColumn}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="画像を追加"
            accessibilityState={{ expanded: isMenuOpen }}
            onPress={onToggleMenu}
            style={({ pressed }) => [
              styles.imageAddButton,
              isMenuOpen ? styles.imageAddButtonActive : null,
              pressed ? styles.buttonPressed : null,
            ]}
            testID="output-image-add-button"
          >
            <AddImageIcon />
          </Pressable>
          {isMenuOpen ? (
            <View style={styles.imageAddMenu} testID="output-image-add-menu">
              <View style={styles.imageAddMenuArrow} />
              <Pressable
                accessibilityRole="menuitem"
                onPress={onPickFromLibrary}
                style={({ pressed }) => [
                  styles.imageAddMenuItem,
                  pressed ? styles.imageAddMenuItemPressed : null,
                ]}
                testID="output-image-add-menu-library"
              >
                <SizableText style={styles.imageAddMenuItemText}>写真アルバムから選択</SizableText>
              </Pressable>
              <View style={styles.imageAddMenuDivider} />
              <Pressable
                accessibilityRole="menuitem"
                onPress={onTakePhoto}
                style={({ pressed }) => [
                  styles.imageAddMenuItem,
                  pressed ? styles.imageAddMenuItemPressed : null,
                ]}
                testID="output-image-add-menu-camera"
              >
                <SizableText style={styles.imageAddMenuItemText}>写真を撮影</SizableText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

type ImageSubmissionFooterProps = {
  errorMessage?: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export function ImageSubmissionFooter({
  errorMessage,
  isSubmitting,
  onSubmit,
}: ImageSubmissionFooterProps) {
  return (
    <View style={styles.imageSubmissionFooter}>
      <SizableText style={styles.imageSubmissionNote} testID="output-image-submit-note">
        提出後も時間内であれば編集できます
      </SizableText>
      {errorMessage ? (
        <SizableText style={styles.imageSubmissionError} testID="output-image-submit-error">
          {errorMessage}
        </SizableText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.imageSubmitButton,
          pressed ? styles.buttonPressed : null,
          isSubmitting ? styles.imageSubmitButtonDisabled : null,
        ]}
        testID="output-image-submit"
      >
        <SizableText style={styles.imageSubmitButtonText}>
          {isSubmitting ? '提出中...' : '提出する'}
        </SizableText>
      </Pressable>
    </View>
  );
}

type VoiceRecognitionPanelProps = {
  isRecognizing: boolean;
  statusMessage: string;
  errorMessage?: string | null;
  interimTranscript: string;
  onStart: () => void;
  onStop: () => void;
};

export function VoiceRecognitionPanel({
  isRecognizing,
  statusMessage,
  errorMessage,
  interimTranscript,
  onStart,
  onStop,
}: VoiceRecognitionPanelProps) {
  return (
    <View style={styles.voicePanel} testID="output-voice-panel">
      <View style={styles.voicePanelHeader}>
        <View style={[styles.voicePulse, isRecognizing ? styles.voicePulseActive : null]}>
          <InputMethodIcon method="voice" color={isRecognizing ? '#FFFFFF' : PRIMARY_COLOR} />
        </View>
        <SizableText style={styles.voiceStatus} testID="output-voice-status">
          {statusMessage}
        </SizableText>
      </View>

      {interimTranscript ? (
        <View style={styles.voiceInterimBox} testID="output-voice-interim">
          <SizableText style={styles.voiceInterimText}>{interimTranscript}</SizableText>
        </View>
      ) : null}

      {errorMessage ? (
        <SizableText style={styles.voiceError} testID="output-voice-error">
          {errorMessage}
        </SizableText>
      ) : null}

      <View style={styles.voiceActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isRecognizing }}
          disabled={isRecognizing}
          onPress={onStart}
          style={({ pressed }) => [
            styles.voiceActionButton,
            isRecognizing ? styles.voiceActionButtonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
          testID="output-voice-start"
        >
          <SizableText style={styles.voiceActionButtonText}>開始</SizableText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !isRecognizing }}
          disabled={!isRecognizing}
          onPress={onStop}
          style={({ pressed }) => [
            styles.voiceActionButton,
            styles.voiceStopButton,
            !isRecognizing ? styles.voiceActionButtonDisabled : null,
            pressed ? styles.buttonPressed : null,
          ]}
          testID="output-voice-stop"
        >
          <SizableText style={styles.voiceActionButtonText}>停止</SizableText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  methodTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#EDEDED',
  },
  methodTabsImagePanel: {
    marginHorizontal: 0,
  },
  methodTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  methodTabActive: {
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  methodTabLabel: {
    color: METHOD_INACTIVE_COLOR,
    fontSize: 13,
    fontWeight: '600',
  },
  methodTabLabelActive: {
    color: METHOD_ACTIVE_COLOR,
    fontWeight: '700',
  },
  voicePanel: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PRIMARY_SOFT_COLOR,
    backgroundColor: '#FFF7FB',
  },
  voicePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voicePulse: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: PRIMARY_SOFT_COLOR,
  },
  voicePulseActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  voiceStatus: {
    flex: 1,
    color: METHOD_ACTIVE_COLOR,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  voiceInterimBox: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  voiceInterimText: {
    color: CAPTION_COLOR,
    fontSize: 13,
    lineHeight: 20,
  },
  voiceError: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
  },
  voiceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  voiceActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: ACTION_COLOR,
  },
  voiceStopButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  voiceActionButtonDisabled: {
    opacity: 0.45,
  },
  voiceActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  imageOutputPanel: {
    minHeight: 244,
  },
  imageGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  imageThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  imageAddColumn: {
    alignItems: 'stretch',
    gap: 10,
  },
  imageAddButton: {
    width: 76,
    height: 76,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#DADADA',
  },
  imageAddButtonActive: {
    borderColor: '#4B8BF5',
  },
  imageAddMenu: {
    position: 'relative',
    alignSelf: 'stretch',
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#D9D9D9',
  },
  imageAddMenuArrow: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#D9D9D9',
    transform: [{ rotate: '45deg' }],
  },
  imageAddMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAddMenuItemPressed: {
    opacity: 0.6,
  },
  imageAddMenuItemText: {
    color: '#2F2F2F',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  imageAddMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
    backgroundColor: '#9A9A9A',
  },
  imageSubmissionFooter: {
    gap: 14,
    paddingHorizontal: 24,
  },
  imageSubmissionNote: {
    color: '#8A8A8A',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  imageSubmissionError: {
    color: ERROR_COLOR,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  imageSubmitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    borderRadius: 20,
    backgroundColor: ACTION_COLOR,
  },
  imageSubmitButtonDisabled: {
    opacity: 0.62,
  },
  imageSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
