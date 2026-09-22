import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimeSpinner } from './TimeSpinner';
import { COLORS, FONTS } from '../../utils/constants';

interface TimePickerFieldProps {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}

// This file is deliberately NOT platform-split — only TimeSpinner (the
// actual picker widget) has native/.web variants. Splitting this whole
// component by platform once already caused the two copies to drift apart
// silently (a positioning fix landed in one file and never made it to the
// other), so the Modal/sheet chrome that's identical on every platform stays
// in one place; only the genuinely-different innermost widget is split.
// Modal renders through a top-level overlay everywhere (on web, through
// react-native-web's portal — see CLAUDE.md's patched dependencies section
// for the DOM bug already fixed there), so it's always fully visible and
// predictably positioned regardless of platform or where this component is
// mounted in the tree.
export function TimePickerField({ visible, value, onChange, onClose }: TimePickerFieldProps) {
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose}>
        {/* Its own SafeAreaView, not an inherited one — a Modal renders as a
            separate top-level layer outside the screen's own SafeAreaView,
            so the status-bar inset has to be applied again here. */}
        <SafeAreaView edges={['top']} style={styles.sheetWrap}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.action}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={[styles.action, styles.actionPrimary]}>Done</Text>
              </Pressable>
            </View>
            <TimeSpinner value={value} onChange={onChange} />
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(18, 33, 42, 0.4)',
    justifyContent: 'flex-start',
  },
  // Clears the search card above it (approximate — this component currently
  // has one caller, DirectionsView's top search card) rather than sitting
  // flush under the status bar.
  sheetWrap: {
    marginTop: 130,
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  action: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  actionPrimary: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
});
