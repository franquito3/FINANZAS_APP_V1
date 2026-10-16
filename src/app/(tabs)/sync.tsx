import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineSyncScreen } from '../../screens/OfflineSyncScreen';
import { THEME } from '../../constants';

export default function SyncRoute() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OfflineSyncScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
