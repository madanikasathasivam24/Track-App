import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetFlatList, BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import { COLORS } from '../../utils/constants';

interface BottomSheetListProps<T> {
  data: T[];
  renderItem: (item: T) => React.ReactElement;
  keyExtractor: (item: T) => string;
  snapPoints?: (string | number)[];
}

// Draggable/expandable bottom sheet for member-style lists. Full data wiring
// (live member rows, etc.) lands with LiveMapScreen — this is the reusable shell.
function BottomSheetListInner<T>(
  { data, renderItem, keyExtractor, snapPoints }: BottomSheetListProps<T>,
  ref: React.Ref<BottomSheetFlatListMethods>
) {
  const points = useMemo(() => snapPoints ?? ['20%', '55%', '90%'], [snapPoints]);

  return (
    <BottomSheet snapPoints={points} index={0} backgroundStyle={styles.background} handleIndicatorStyle={styles.handle}>
      <BottomSheetFlatList
        ref={ref}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => renderItem(item)}
        contentContainerStyle={styles.content}
      />
    </BottomSheet>
  );
}

export const BottomSheetList = forwardRef(BottomSheetListInner) as <T>(
  props: BottomSheetListProps<T> & { ref?: React.Ref<BottomSheetFlatListMethods> }
) => React.ReactElement;

const styles = StyleSheet.create({
  background: {
    backgroundColor: COLORS.surface,
  },
  handle: {
    backgroundColor: COLORS.border,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
