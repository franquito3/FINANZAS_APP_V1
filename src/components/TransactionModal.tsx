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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Category, TransactionType, Wallet } from '../types';
import { THEME } from '../constants';
import { financeService } from '../services/data/financeService';
import { useAuth } from '../context/AuthContext';
import { LOCAL_DEMO_USER_ID } from '../utils/id';

interface Props {
  visible: boolean;
  initialType?: TransactionType;
  onClose: () => void;
  onSuccess: () => void;
  wallets: Wallet[];
}

export const TransactionModal: React.FC<Props> = ({
  visible,
  initialType = 'EGRESO',
  onClose,
  onSuccess,
  wallets,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('0');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setType(initialType);
      setAmountStr('0');
      setNotes('');
      loadCategories(initialType);
      if (wallets.length > 0 && !selectedWalletId) {
        setSelectedWalletId(wallets[0].id);
      }
    }
  }, [visible, initialType, wallets]);

  useEffect(() => {
    if (visible) {
      loadCategories(type);
    }
  }, [type]);

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
    Haptics.selectionAsync();

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

    const walletId = selectedWalletId || wallets[0]?.id;
    if (!walletId) {
      Alert.alert('Billetera requerida', 'No se encontró una billetera activa.');
      return;
    }
    const userId = user?.id || LOCAL_DEMO_USER_ID;

    setIsSaving(true);
    try {
      await financeService.createTransaction({
        amount,
        categoryId: selectedCategoryId,
        walletId,
        notes,
        userId,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        <LinearGradient
          colors={['#070D2D', '#161D65', '#351875']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 0.6 }}
          style={styles.modalContainer}
        >
          {/* Top Hero Header & Liquid Glass Amount Display */}
          <View style={styles.heroHeader}>
            <View style={styles.headerTopRow}>
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
                    − Gasto
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
                    + Ingreso
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  onClose();
                }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Liquid Glass Amount Box */}
            <View style={styles.glassAmountCard}>
              <Text style={styles.glassAmountLabel}>
                {type === 'INGRESO' ? 'MONTO DE INGRESO' : 'MONTO DE GASTO'}
              </Text>
              <View style={styles.amountDisplay}>
                <Text style={styles.currencyPrefix}>S/.</Text>
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
            </View>
          </View>

          {/* White Bottom Sheet (borderTopRadius: 32) */}
          <View style={styles.whiteSheet}>
            <View style={styles.sheetHandle} />

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
                          backgroundColor: cat.color_hex + '18',
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedCategoryId(cat.id);
                      }}
                    >
                      <View
                        style={[
                          styles.categoryAvatar,
                          { backgroundColor: cat.color_hex },
                        ]}
                      >
                        <Text style={styles.categoryIcon}>{cat.icon_identifier}</Text>
                      </View>
                      <Text
                        style={[
                          styles.categoryTitle,
                          isSelected && { color: '#0F172A', fontWeight: '800' },
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
              <Text style={styles.sectionLabel}>Billetera</Text>
              <View style={styles.walletRow}>
                {wallets.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletPill,
                      selectedWalletId === w.id && styles.walletPillActive,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedWalletId(w.id);
                    }}
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
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1E40AF', '#3B1877']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Guardando...' : '✓ Registrar Transacción'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 45, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: '94%',
  },
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  typeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 11,
  },
  typeBtnExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
  },
  typeBtnIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  glassAmountCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.55)',
    alignItems: 'center',
  },
  glassAmountLabel: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  amountDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    marginRight: 6,
  },
  amountValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  incomeColor: {
    color: '#34D399',
  },
  expenseColor: {
    color: '#FFFFFF',
  },
  whiteSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 10,
  },
  scrollArea: {
    maxHeight: 175,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  categoryCard: {
    width: '31%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    gap: 5,
  },
  categoryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryTitle: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  walletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  walletPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  walletPillActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  walletPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  walletPillTextActive: {
    color: '#FFFFFF',
  },
  noteBox: {
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  keypad: {
    gap: 6,
    marginVertical: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  key: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  saveButton: {
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  saveGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
