import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';

export const EmptyTransactions: React.FC = () => {
  return (
    <View style={styles.emptyContainer}>
      <Image
        source={require('../../assets/images/empty_state.png')}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>Aún no hay movimientos</Text>
      <Text style={styles.emptySubtitle}>
        Toca + Ingreso o - Gasto arriba para registrar tu primera transacción.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  emptyImage: {
    width: '75%',
    maxWidth: 240,
    aspectRatio: 16 / 9,
    maxHeight: 145,
  },
  emptyTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 280,
  },
});
