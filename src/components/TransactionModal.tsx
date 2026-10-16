import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Category, TransactionType, Wallet } from '../types';
import { THEME } from '../constants';
import { financeService } from '../services/data/financeService';
import { useAuth } from '../context/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wallets: Wallet[];
}

export const TransactionModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
  wallets,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>('EGRESO');
  const [amountStr, setAmountStr] = useState('0');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountStr('0');
      setNotes('');
      loadCategories(type);
      if (wallets.length > 0 && !selectedWalletId) {
        setSelectedWalletId(wallets[0].id);
      }
    }
  }, [visible, type, wallets]);

  const loadCategories = async (txType: TransactionType) => {
    try {
      const cats = await financeService.getCategories(txType);
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategoryId(cats[0].id);
      }
    } catch (e) {
      console.error('[TransactionModal] Error loading categories', e);
    }
  };

  const handleKeyPress = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (val === '⌫') {
      if (amountStr.length <= 1) {
        setAmountStr('0');
      } else {
        setAmountStr(amountStr.slice(0, -1));
      }
      return;
    }

    if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(amountStr + '.');
      }
      return;
    }

    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      // Limit to 2 decimal places if dot is present
      const parts = amountStr.split('.');
      if (parts.length > 1 && parts[1].length >= 2) {
        return;
      }
      setAmountStr(amountStr + val);
    }
  };

  const handleSave = async () => {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      Alert.alert('Monto inválido', 'Por favor ingresa un monto mayor a 0');
      return;
    }

    if (!selectedCategoryId) {
      Alert.alert('Categoría requerida', 'Por favor selecciona una categoría');
      return;
    }

    const walletId = selectedWalletId || wallets[0]?.id || 'wallet_cash';
    const userId = user?.id || 'local_user';

    setIsSaving(true);
    try {
      await financeService.createTransaction({
        amount,
        categoryId: selectedCategoryId,
        walletId,
        notes,
        userId,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error al guardar', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header & Type Toggle */}
          <View style={styles.header}>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'EGRESO' && styles.typeBtnExpense]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setType('EGRESO');
                }}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    type === 'EGRESO' && styles.typeBtnTextActive,
                  ]}
                >
                  Gasto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'INGRESO' && styles.typeBtnIncome]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setType('INGRESO');
                }}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    type === 'INGRESO' && styles.typeBtnTextActive,
                  ]}
                >
                  Ingreso
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Amount Display */}
          <View style={styles.amountDisplay}>
            <Text style={styles.currencyPrefix}>$</Text>
            <Text
              style={[
                styles.amountValue,
                type === 'INGRESO' ? styles.incomeColor : styles.expenseColor,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountStr}
            </Text>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Category Icon Grid */}
            <Text style={styles.sectionLabel}>Selecciona Categoría</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected && {
                        borderColor: cat.color_hex,
                        backgroundColor: cat.color_hex + '20',
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedCategoryId(cat.id);
                    }}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon_identifier}</Text>
                    <Text
                      style={[
                        styles.categoryTitle,
                        isSelected && { color: cat.color_hex, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Wallet selection pills */}
            <Text style={styles.sectionLabel}>Billetera de Origen</Text>
            <View style={styles.walletRow}>
              {wallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.walletPill,
                    selectedWalletId === w.id && styles.walletPillActive,
                  ]}
                  onPress={() => setSelectedWalletId(w.id)}
                >
                  <Text
                    style={[
                      styles.walletPillText,
                      selectedWalletId === w.id && styles.walletPillTextActive,
                    ]}
                  >
                    {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note input */}
            <View style={styles.noteBox}>
              <TextInput
                style={styles.noteInput}
                placeholder="Nota o descripción opcional..."
                placeholderTextColor={THEME.colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Integrated High-Speed Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['.', '0', '⌫'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={styles.key}
                    onPress={() => handleKeyPress(k)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.keyText}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Guardando...' : '✓ Registrar Transacción'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  typeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  typeBtnExpense: {
    backgroundColor: THEME.colors.danger,
  },
  typeBtnIncome: {
    backgroundColor: THEME.colors.success,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  typeBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  amountDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    paddingVertical: 10,
  },
  currencyPrefix: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 44,
    fontWeight: '900',
  },
  incomeColor: {
    color: THEME.colors.success,
  },
  expenseColor: {
    color: THEME.colors.textPrimary,
  },
  scrollArea: {
    maxHeight: 180,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryCard: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    gap: 4,
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryTitle: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
  },
  walletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  walletPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  walletPillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  walletPillText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  walletPillTextActive: {
    color: '#fff',
  },
  noteBox: {
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  keypad: {
    gap: 6,
    marginVertical: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  key: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  saveButton: {
    height: 52,
    backgroundColor: THEME.colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
