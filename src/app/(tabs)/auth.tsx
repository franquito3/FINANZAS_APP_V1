import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthScreen } from '../../screens/AuthScreen';
import { THEME } from '../../constants';

export default function AuthRoute() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AuthScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
