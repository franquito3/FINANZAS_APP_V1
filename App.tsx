import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { validateEnv } from './src/config/env';
import { AuthProvider } from './src/context/AuthContext';
import { AuthScreen } from './src/screens';

export default function App() {
  useEffect(() => {
    validateEnv();
  }, []);

  return (
    <AuthProvider>
      <View style={styles.container}>
        <AuthScreen />
        <StatusBar style="dark" />
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
