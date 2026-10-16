import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { THEME } from '../../constants';

export default function DashboardRoute() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DashboardScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
