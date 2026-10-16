import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReportsScreen } from '../../screens/ReportsScreen';
import { THEME } from '../../constants';

export default function ReportsRoute() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ReportsScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
