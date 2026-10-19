import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Category, Transaction, TransactionType, Wallet } from '../types';
import { THEME } from '../constants';
import { financeService } from '../services/data/financeService';
import { seedLocalDefaults } from '../services/data/seedData';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { LOCAL_DEMO_USER_ID } from '../utils/id';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type ModalMode = 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA';

interface Props {
  visible: boolean;
  initialType?: TransactionType;
  transactionToEdit?: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
  wallets: Wallet[];
}

// Exactly the 8 requested primary expense categories
const MAIN_EXPENSE_KEYS = [
  'alimentación',
  'transporte',
  'salud y farmacia',
  'educación',
  'ocio y salidas',
  'compras personales',
  'vivienda y servicios',
  'suscripciones',
];

const PRESET_COLORS = [
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#F43F5E',
  '#64748B',
];

/**
 * Maps category names to clean, minimalist Ionicons vector icons
 */
function getCategoryIconName(
  categoryName: string
): keyof typeof Ionicons.glyphMap {
  const norm = categoryName.trim().toLowerCase();
  if (norm.includes('aliment') || norm.includes('food')) return 'restaurant-outline';
  if (norm.includes('transporte')) return 'car-outline';
  if (norm.includes('salud') || norm.includes('farmacia')) return 'medkit-outline';
  if (norm.includes('educaci')) return 'school-outline';
  if (norm.includes('ocio') || norm.includes('salidas') || norm.includes('cine')) return 'film-outline';
  if (norm.includes('compra') || norm.includes('shopping')) return 'cart-outline';
  if (norm.includes('suscrip')) return 'phone-portrait-outline';
  if (norm.includes('vivienda') || norm.includes('servicios') || norm.includes('hogar')) return 'home-outline';
  if (norm.includes('deuda') || norm.includes('préstamo')) return 'card-outline';
  if (norm.includes('ahorro') || norm.includes('invers')) return 'trending-up-outline';
  if (norm.includes('sueldo')) return 'cash-outline';
  if (norm.includes('freelance')) return 'briefcase-outline';
  if (norm.includes('otro')) return 'ellipsis-horizontal-circle-outline';
  return 'apps-outline';
}

function formatDisplayDate(date: Date): string {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const formatted = date.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return isToday ? `Hoy, ${formatted}` : formatted;
}

export const TransactionModal: React.FC<Props> = ({
  visible,
  initialType = 'INGRESO',
  transactionToEdit = null,
  onClose,
  onSuccess,
  wallets,
}) => {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const amountInputRef = useRef<any>(null);

  const [mode, setMode] = useState<ModalMode>(initialType === 'EGRESO' ? 'EGRESO' : 'INGRESO');
  const [amountStr, setAmountStr] = useState('');
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // New category creation modal states
  const [isAddCatModalVisible, setIsAddCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);

  // Initialize wallets
  useEffect(() => {
    if (wallets.length > 0) {
      if (!selectedWalletId) setSelectedWalletId(wallets[0].id);
      if (!fromWalletId) setFromWalletId(wallets[0].id);
      if (!toWalletId) setToWalletId(wallets.length > 1 ? wallets[1].id : wallets[0].id);
    }
  }, [wallets]);

  // Load and order categories from SQLite
  const loadCategories = useCallback(async () => {
    try {
      await seedLocalDefaults(user?.id);
      const [inc, exp] = await Promise.all([
        financeService.getCategories('INGRESO'),
        financeService.getCategories('EGRESO'),
      ]);

      // Requirement: "Sueldo" MUST be in first position (index 0) for income
      const sortedInc = [...inc].sort((a, b) => {
        const isASueldo = a.name.toLowerCase().includes('sueldo');
        const isBSueldo = b.name.toLowerCase().includes('sueldo');
        if (isASueldo) return -1;
        if (isBSueldo) return 1;
        if (a.name.toLowerCase() === 'otros') return 1;
        if (b.name.toLowerCase() === 'otros') return -1;
        return a.name.localeCompare(b.name);
      });

      // Filter out "Ahorro e Inversión" and deduplicate aliases
      const uniqueExpMap = new Map<string, Category>();
      for (const cat of exp) {
        const norm = cat.name.trim().toLowerCase();
        if (norm.includes('ahorro') || norm.includes('inversión')) continue;

        let canonicalKey = norm;
        if (norm === 'salud') canonicalKey = 'salud y farmacia';
        else if (norm === 'ocio') canonicalKey = 'ocio y salidas';
        else if (norm === 'food' || norm === 'comida') canonicalKey = 'alimentación';
        else if (norm === 'vivienda') canonicalKey = 'vivienda y servicios';
        else if (norm === 'shopping' || norm === 'compras') canonicalKey = 'compras personales';
        else if (norm === 'transporte' || norm === 'transport') canonicalKey = 'transporte';
        else if (norm === 'educación' || norm === 'education') canonicalKey = 'educación';

        if (!uniqueExpMap.has(canonicalKey) || cat.name.length > uniqueExpMap.get(canonicalKey)!.name.length) {
          uniqueExpMap.set(canonicalKey, cat);
        }
      }

      const filteredExp = Array.from(uniqueExpMap.values());

      setIncomeCategories(sortedInc);
      setExpenseCategories(filteredExp);

      return { sortedInc, filteredExp };
    } catch (err) {
      console.error('[TransactionModal] Error loading categories:', err);
      return { sortedInc: [], filteredExp: [] };
    }
  }, [user?.id]);

  // Reset state and select initial default on open (or preload if editing)
  useEffect(() => {
    if (!visible) return;

    if (transactionToEdit) {
      const editMode: ModalMode =
        transactionToEdit.category_type === 'INGRESO' ? 'INGRESO' : 'EGRESO';
      setMode(editMode);
      setAmountStr(transactionToEdit.amount ? String(transactionToEdit.amount) : '');
      setCustomCategoryName('');
      setNotes(transactionToEdit.notes || '');
      setSelectedWalletId(transactionToEdit.wallet_id || (wallets[0]?.id ?? ''));
      setSelectedCategoryId(transactionToEdit.category_id || '');
      setTransactionDate(
        transactionToEdit.transaction_date
          ? new Date(transactionToEdit.transaction_date)
          : new Date()
      );
      loadCategories();

      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 250);
      return () => clearTimeout(timer);
    }

    const startMode: ModalMode = initialType === 'EGRESO' ? 'EGRESO' : 'INGRESO';
    setMode(startMode);
    setAmountStr('');
    setCustomCategoryName('');
    setNotes('');
    setTransactionDate(new Date());

    if (wallets.length > 0) {
      setSelectedWalletId(wallets[0].id);
      setFromWalletId(wallets[0].id);
      setToWalletId(wallets.length > 1 ? wallets[1].id : wallets[0].id);
    }

    loadCategories().then(({ sortedInc, filteredExp }) => {
      if (startMode === 'INGRESO') {
        // "Sueldo" is guaranteed at index 0
        setSelectedCategoryId(sortedInc[0]?.id || '');
      } else if (startMode === 'EGRESO') {
        // Requirement: "Otros" must be selected by default when entering Gasto
        const otrosCat = filteredExp.find((c) => c.name.toLowerCase() === 'otros');
        setSelectedCategoryId(otrosCat ? otrosCat.id : filteredExp[0]?.id || '');
      }
    });

    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, [visible, initialType, transactionToEdit, loadCategories, wallets]);

  // Categorize expenses into: 1 single grid list (all predefined + custom) and "Otros"
  const { gridExpenseCategories, otrosExpenseCategory } = useMemo(() => {
    const gridList: Category[] = [];
    let otrosCat: Category | null = null;

    for (const cat of expenseCategories) {
      const norm = cat.name.trim().toLowerCase();
      if (norm === 'otros') {
        otrosCat = cat;
      } else {
        gridList.push(cat);
      }
    }

    // Sort grid list: main primary categories first in order, then custom categories
    gridList.sort((a, b) => {
      const idxA = MAIN_EXPENSE_KEYS.findIndex((k) => a.name.toLowerCase().includes(k) || k.includes(a.name.toLowerCase()));
      const idxB = MAIN_EXPENSE_KEYS.findIndex((k) => b.name.toLowerCase().includes(k) || k.includes(b.name.toLowerCase()));
      if (idxA >= 0 && idxB >= 0) return idxA - idxB;
      if (idxA >= 0) return -1;
      if (idxB >= 0) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      gridExpenseCategories: gridList,
      otrosExpenseCategory: otrosCat,
    };
  }, [expenseCategories]);

  // Handle mode change with instant memory switch & default selection
  const handleModeChange = (newMode: ModalMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(newMode);

    if (newMode === 'INGRESO') {
      // Index 0 is Sueldo
      setSelectedCategoryId(incomeCategories[0]?.id || '');
    } else if (newMode === 'EGRESO') {
      // Requirement: "Otros" selected by default
      const otros = expenseCategories.find((c) => c.name.toLowerCase() === 'otros');
      setSelectedCategoryId(otros ? otros.id : expenseCategories[0]?.id || '');
    }
  };

  // Check if currently selected category is "Otros"
  const currentCategory = useMemo(() => {
    const all = [...incomeCategories, ...expenseCategories];
    return all.find((c) => c.id === selectedCategoryId);
  }, [selectedCategoryId, incomeCategories, expenseCategories]);

  const isOtrosSelected = currentCategory?.name.trim().toLowerCase() === 'otros';

  const handleSwapWallets = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFromWalletId(toWalletId);
    setToWalletId(fromWalletId);
  };

  // Format and validate native numeric input
  const handleAmountChange = (text: string) => {
    let cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 2);
    }
    setAmountStr(cleaned);
  };

  // Check if a category is part of the default system categories
  const isSystemCategory = (name: string): boolean => {
    const norm = name.trim().toLowerCase();
    return (
      norm === 'alimentación' ||
      norm === 'transporte' ||
      norm === 'salud y farmacia' ||
      norm === 'educación' ||
      norm === 'ocio y salidas' ||
      norm === 'shopping' ||
      norm === 'compras personales' ||
      norm === 'compras' ||
      norm === 'vivienda y servicios' ||
      norm === 'suscripciones' ||
      norm === 'deudas y préstamos' ||
      norm === 'otros' ||
      norm === 'sueldo' ||
      norm === 'freelance' ||
      norm === 'inversión'
    );
  };

  // Long press on category: only user-created categories can be deleted
  const handleCategoryLongPress = async (cat: Category) => {
    if (!cat || !cat.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Requirement: System base categories CANNOT be deleted
    if (isSystemCategory(cat.name)) {
      showAlert({
        title: 'Categoría predefinida',
        message: `"${cat.name}" es una categoría base del sistema y no se puede eliminar.`,
        type: 'info',
        confirmText: 'Entendido',
      });
      return;
    }

    try {
      const count = await financeService.getCategoryTransactionsCount(cat.id);

      if (count > 0) {
        // Requirement: If count > 0 -> "No se puede eliminar", "Esta categoría tiene movimientos registrados en tu historial."
        showAlert({
          title: 'No se puede eliminar',
          message: 'Esta categoría tiene movimientos registrados en tu historial.',
          type: 'warning',
          confirmText: 'Entendido',
        });
      } else {
        // Requirement: If count === 0 -> Confirm delete for custom category
        showAlert({
          title: '¿Eliminar categoría?',
          message: `¿Estás seguro de que deseas eliminar la categoría "${cat.name}"?`,
          type: 'confirm',
          buttons: [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: async () => {
                try {
                  await financeService.deleteCategory(cat.id);
                  await loadCategories();
                  showAlert({
                    title: 'Categoría eliminada',
                    message: `La categoría "${cat.name}" fue eliminada con éxito.`,
                    type: 'success',
                  });
                } catch (err: any) {
                  showAlert({
                    title: 'Error al eliminar',
                    message: err.message || String(err),
                    type: 'error',
                  });
                }
              },
            },
          ],
        });
      }
    } catch (err: any) {
      showAlert({
        title: 'Error de validación',
        message: err.message || String(err),
        type: 'error',
      });
    }
  };

  // Save new custom category to SQLite
  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      showAlert({
        title: 'Nombre requerido',
        message: 'Por favor ingresa un nombre para la nueva categoría.',
        type: 'warning',
      });
      return;
    }

    try {
      const userId = user?.id || LOCAL_DEMO_USER_ID;
      const newId = await financeService.createCategory({
        name: trimmed,
        color_hex: newCatColor,
        icon_identifier: 'apps-outline',
        type: 'EGRESO',
        userId,
      });

      setNewCatName('');
      setIsAddCatModalVisible(false);
      await loadCategories();
      setSelectedCategoryId(newId);

      showAlert({
        title: 'Categoría creada',
        message: `Se ha registrado "${trimmed}" correctamente.`,
        type: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error al crear',
        message: err.message || String(err),
        type: 'error',
      });
    }
  };

  // Main Submit handler
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      showAlert({
        title: 'Monto inválido',
        message: 'Por favor ingresa un monto mayor a 0.',
        type: 'warning',
      });
      amountInputRef.current?.focus();
      return;
    }

    const userId = user?.id || LOCAL_DEMO_USER_ID;
    setIsSaving(true);

    try {
      if (transactionToEdit) {
        if (!selectedCategoryId) {
          showAlert({
            title: 'Categoría requerida',
            message: 'Por favor selecciona una categoría.',
            type: 'warning',
          });
          setIsSaving(false);
          return;
        }

        const walletId = selectedWalletId || wallets[0]?.id;
        if (!walletId) {
          showAlert({
            title: 'Billetera requerida',
            message: 'No se encontró una billetera activa.',
            type: 'warning',
          });
          setIsSaving(false);
          return;
        }

        const trimmedCustom = customCategoryName.trim();
        const trimmedNotes = notes.trim();
        let finalNotes = trimmedNotes;
        if (isOtrosSelected && trimmedCustom) {
          finalNotes = trimmedNotes ? `${trimmedCustom} • ${trimmedNotes}` : trimmedCustom;
        }

        await financeService.updateTransaction(transactionToEdit.id, {
          amount,
          category_id: selectedCategoryId,
          wallet_id: walletId,
          notes: finalNotes,
          transaction_date: transactionDate.toISOString(),
        });
      } else if (mode === 'TRANSFERENCIA') {
        if (!fromWalletId || !toWalletId) {
          showAlert({
            title: 'Cuentas requeridas',
            message: 'Selecciona la cuenta de origen y destino.',
            type: 'warning',
          });
          setIsSaving(false);
          return;
        }
        if (fromWalletId === toWalletId) {
          showAlert({
            title: 'Cuentas iguales',
            message: 'La cuenta origen y destino deben ser distintas.',
            type: 'warning',
          });
          setIsSaving(false);
          return;
        }

        await financeService.createTransfer({
          fromWalletId,
          toWalletId,
          amount,
          notes: notes.trim(),
          userId,
          date: transactionDate.toISOString(),
        });
      } else {
        if (!selectedCategoryId) {
          showAlert({
            title: 'Categoría requerida',
            message: 'Por favor selecciona una categoría.',
            type: 'warning',
          });
          setIsSaving(false);
          return;
        }

        const walletId = selectedWalletId || wallets[0]?.id;
        if (!walletId) {
          showAlert({
            title: 'Billetera requerida',
            message: 'No se encontró una billetera activa.',
            type: 'warning',
          });
          setIsSaving(false);
          return;
        }

        const trimmedCustom = customCategoryName.trim();
        const trimmedNotes = notes.trim();
        let finalNotes = trimmedNotes;
        if (isOtrosSelected && trimmedCustom) {
          finalNotes = trimmedNotes ? `${trimmedCustom} • ${trimmedNotes}` : trimmedCustom;
        }

        await financeService.createTransaction({
          amount,
          categoryId: selectedCategoryId,
          walletId,
          notes: finalNotes,
          userId,
          date: transactionDate.toISOString(),
        });
      }

      Keyboard.dismiss();
      onSuccess();
      onClose();
    } catch (err: any) {
      showAlert({
        title: transactionToEdit ? 'Error al actualizar' : 'Error al registrar',
        message: err.message || String(err),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const heroLabel =
    transactionToEdit
      ? mode === 'INGRESO'
        ? 'EDITAR INGRESO'
        : 'EDITAR GASTO'
      : mode === 'INGRESO'
      ? 'MONTO DE INGRESO'
      : mode === 'EGRESO'
      ? 'MONTO DE GASTO'
      : 'MONTO A TRANSFERIR';

  const amountColorStyle =
    mode === 'INGRESO'
      ? styles.incomeColor
      : mode === 'EGRESO'
      ? styles.expenseColor
      : styles.transferColor;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.fullScreenWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#070D2D', '#161D65', '#351875']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 0.45 }}
          style={styles.gradientContainer}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {/* Top Hero Header: Mode Switchers + Close Button + Amount Input */}
            <View style={styles.heroHeader}>
              <View style={styles.headerTopRow}>
                {transactionToEdit ? (
                  <View style={styles.editingBadge}>
                    <Ionicons name="pencil" size={15} color="#FFFFFF" />
                    <Text style={styles.editingBadgeText}>
                      {mode === 'INGRESO' ? 'Editando Ingreso' : 'Editando Gasto'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.typeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.typeBtn,
                        styles.typeBtnIncomeBase,
                        mode === 'INGRESO' && styles.typeBtnIncomeActive,
                      ]}
                      onPress={() => handleModeChange('INGRESO')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          mode === 'INGRESO' ? styles.typeBtnTextActive : styles.typeBtnTextIncome,
                        ]}
                      >
                        + Ingreso
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeBtn,
                        styles.typeBtnExpenseBase,
                        mode === 'EGRESO' && styles.typeBtnExpenseActive,
                      ]}
                      onPress={() => handleModeChange('EGRESO')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          mode === 'EGRESO' ? styles.typeBtnTextActive : styles.typeBtnTextExpense,
                        ]}
                      >
                        − Gasto
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.typeBtn,
                        styles.typeBtnTransferBase,
                        mode === 'TRANSFERENCIA' && styles.typeBtnTransferActive,
                      ]}
                      onPress={() => handleModeChange('TRANSFERENCIA')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          mode === 'TRANSFERENCIA'
                            ? styles.typeBtnTextActive
                            : styles.typeBtnTextTransfer,
                        ]}
                      >
                        ⇄ Transf.
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Native Interactive Amount Input Card */}
              <View style={styles.glassAmountCard}>
                <Text style={styles.glassAmountLabel}>{heroLabel}</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>S/.</Text>
                  <TextInput
                    ref={amountInputRef}
                    style={[styles.nativeAmountInput, amountColorStyle]}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    keyboardType="decimal-pad"
                    value={amountStr}
                    onChangeText={handleAmountChange}
                    selectTextOnFocus
                    returnKeyType="done"
                    maxLength={12}
                  />
                </View>
              </View>
            </View>

            {/* White Body Container */}
            <View style={styles.whiteBody}>
              <View style={styles.sheetHandle} />

              {/* Scrollable Middle Content */}
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollAreaContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View key={mode}>
                  {mode === 'TRANSFERENCIA' ? (
                    /* Transfer Mode: Source & Destination Wallets */
                    <View style={styles.transferContainer}>
                      <Text style={styles.sectionLabel}>Transferencia Interna entre Cuentas</Text>

                      <View style={styles.transferCardsWrap}>
                        {/* Source Wallet */}
                        <View style={styles.transferWalletBlock}>
                          <Text style={styles.transferBlockLabel}>Origen (Desde)</Text>
                          <View style={styles.walletRow}>
                            {wallets.map((w) => {
                              const isSelected = fromWalletId === w.id;
                              return (
                                <TouchableOpacity
                                  key={`from-${w.id}`}
                                  style={[styles.walletPill, isSelected && styles.walletPillActive]}
                                  onPress={() => setFromWalletId(w.id)}
                                >
                                  <Text
                                    style={[
                                      styles.walletPillText,
                                      isSelected && styles.walletPillTextActive,
                                    ]}
                                  >
                                    {w.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>

                        {/* Swap Button */}
                        <TouchableOpacity
                          style={styles.swapBtn}
                          onPress={handleSwapWallets}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.swapBtnText}>⇅ Intercambiar Cuentas</Text>
                        </TouchableOpacity>

                        {/* Destination Wallet */}
                        <View style={styles.transferWalletBlock}>
                          <Text style={styles.transferBlockLabel}>Destino (Hacia)</Text>
                          <View style={styles.walletRow}>
                            {wallets.map((w) => {
                              const isSelected = toWalletId === w.id;
                              return (
                                <TouchableOpacity
                                  key={`to-${w.id}`}
                                  style={[
                                    styles.walletPill,
                                    isSelected && styles.walletPillTransferActive,
                                  ]}
                                  onPress={() => setToWalletId(w.id)}
                                >
                                  <Text
                                    style={[
                                      styles.walletPillText,
                                      isSelected && styles.walletPillTextActive,
                                    ]}
                                  >
                                    {w.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : mode === 'INGRESO' ? (
                    /* Income Categories: "Sueldo" is guaranteed at Index 0 */
                    <>
                      <Text style={styles.sectionLabel}>Categoría de Ingreso</Text>
                      <View style={styles.categoryGrid}>
                        {incomeCategories.map((cat) => {
                          const isSelected = selectedCategoryId === cat.id;
                          const iconName = getCategoryIconName(cat.name);

                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.categoryCard,
                                isSelected && {
                                  borderColor: cat.color_hex,
                                  backgroundColor: cat.color_hex + '14',
                                  borderWidth: 1.8,
                                },
                              ]}
                              onPress={() => setSelectedCategoryId(cat.id)}
                              onLongPress={() => handleCategoryLongPress(cat)}
                              activeOpacity={0.75}
                            >
                              <View
                                style={[
                                  styles.categoryAvatar,
                                  {
                                    backgroundColor: isSelected
                                      ? cat.color_hex + '28'
                                      : cat.color_hex + '18',
                                  },
                                ]}
                              >
                                <Ionicons name={iconName} size={19} color={cat.color_hex} />
                              </View>
                              <Text
                                style={[
                                  styles.categoryTitle,
                                  isSelected && {
                                    color: '#0F172A',
                                    fontWeight: '700',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : (
                    /* GASTOS: Cuadrícula Única + Divisor + Fila Inferior ("Otros" y "+ Agregar") */
                    <>
                      {/* 1. Un solo contenedor / cuadrícula donde se muestren todas las categorías de gasto juntas */}
                      <View style={styles.categoryGrid}>
                        {gridExpenseCategories.map((cat) => {
                          const isSelected = selectedCategoryId === cat.id;
                          const iconName = getCategoryIconName(cat.name);

                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.categoryCard,
                                isSelected && {
                                  borderColor: cat.color_hex,
                                  backgroundColor: cat.color_hex + '14',
                                  borderWidth: 1.8,
                                },
                              ]}
                              onPress={() => setSelectedCategoryId(cat.id)}
                              onLongPress={() => handleCategoryLongPress(cat)}
                              activeOpacity={0.75}
                            >
                              <View
                                style={[
                                  styles.categoryAvatar,
                                  {
                                    backgroundColor: isSelected
                                      ? cat.color_hex + '28'
                                      : cat.color_hex + '18',
                                  },
                                ]}
                              >
                                <Ionicons name={iconName} size={19} color={cat.color_hex} />
                              </View>
                              <Text
                                style={[
                                  styles.categoryTitle,
                                  isSelected && {
                                    color: '#0F172A',
                                    fontWeight: '700',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* 2. Un margen vertical / separador sutil */}
                      <View style={styles.sectionDivider} />

                      {/* 3. En la fila inferior, de forma independiente, únicamente: "Otros" y "+ Agregar" */}
                      <View style={styles.categoryGrid}>
                        {/* "Otros" Category (Selected by default) */}
                        {otrosExpenseCategory && (
                          <TouchableOpacity
                            key={otrosExpenseCategory.id}
                            style={[
                              styles.categoryCard,
                              selectedCategoryId === otrosExpenseCategory.id && {
                                borderColor: otrosExpenseCategory.color_hex,
                                backgroundColor: otrosExpenseCategory.color_hex + '14',
                                borderWidth: 1.8,
                              },
                            ]}
                            onPress={() => setSelectedCategoryId(otrosExpenseCategory.id)}
                            onLongPress={() => handleCategoryLongPress(otrosExpenseCategory)}
                            activeOpacity={0.75}
                          >
                            <View
                              style={[
                                styles.categoryAvatar,
                                {
                                  backgroundColor:
                                    selectedCategoryId === otrosExpenseCategory.id
                                      ? otrosExpenseCategory.color_hex + '28'
                                      : otrosExpenseCategory.color_hex + '18',
                                },
                              ]}
                            >
                              <Ionicons
                                name="ellipsis-horizontal-circle-outline"
                                size={19}
                                color={otrosExpenseCategory.color_hex}
                              />
                            </View>
                            <Text
                              style={[
                                styles.categoryTitle,
                                selectedCategoryId === otrosExpenseCategory.id && {
                                  color: '#0F172A',
                                  fontWeight: '700',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {otrosExpenseCategory.name}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* "+ Agregar" Button */}
                        <TouchableOpacity
                          style={[styles.categoryCard, styles.addCategoryCard]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsAddCatModalVisible(true);
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={styles.addCategoryAvatar}>
                            <Ionicons name="add" size={20} color="#4F46E5" />
                          </View>
                          <Text style={styles.addCategoryTitle}>+ Agregar</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Conditional Custom Name Input when "Otros" is selected */}
                  {isOtrosSelected && (
                    <View style={styles.customCategoryBox}>
                      <Text style={styles.customCategoryLabel}>
                        Concepto o nombre para &quot;Otros&quot; (opcional)
                      </Text>
                      <TextInput
                        style={styles.customCategoryInput}
                        placeholder="Ej. Regalo, Suscripción, Imprevisto..."
                        placeholderTextColor={THEME.colors.textSecondary}
                        value={customCategoryName}
                        onChangeText={setCustomCategoryName}
                      />
                    </View>
                  )}

                  {/* Interactive Date Selector */}
                  <View style={styles.dateSelectorSection}>
                    <Text style={styles.sectionLabel}>Fecha de la Transacción</Text>
                    <TouchableOpacity
                      style={styles.dateSelectorChip}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowDatePicker(true);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={styles.dateSelectorLeft}>
                        <View style={styles.calendarIconCircle}>
                          <Ionicons name="calendar-outline" size={17} color="#4F46E5" />
                        </View>
                        <Text style={styles.dateSelectorText}>
                          {formatDisplayDate(transactionDate)}
                        </Text>
                      </View>
                      <View style={styles.dateChangeBadge}>
                        <Text style={styles.dateChangeText}>Cambiar</Text>
                        <Ionicons name="chevron-forward" size={13} color="#6366F1" />
                      </View>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
                        <DateTimePicker
                          value={transactionDate}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          maximumDate={new Date()}
                          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                            if (Platform.OS === 'android') {
                              setShowDatePicker(false);
                            }
                            if (event.type === 'set' && selectedDate) {
                              setTransactionDate(selectedDate);
                            } else if (Platform.OS === 'ios' && selectedDate) {
                              setTransactionDate(selectedDate);
                            }
                          }}
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity
                            style={styles.iosDoneButton}
                            onPress={() => setShowDatePicker(false)}
                          >
                            <Text style={styles.iosDoneText}>Listo</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Wallet selection pills */}
                  {mode !== 'TRANSFERENCIA' && (
                    <>
                      <Text style={styles.sectionLabel}>Billetera / Cuenta</Text>
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
                    </>
                  )}

                  {/* Note input */}
                  <Text style={styles.sectionLabel}>Nota o Descripción</Text>
                  <View style={styles.noteBox}>
                    <TextInput
                      style={styles.noteInput}
                      placeholder={
                        mode === 'TRANSFERENCIA'
                          ? 'Nota de transferencia (opcional)...'
                          : 'Nota o descripción adicional (opcional)...'
                      }
                      placeholderTextColor={THEME.colors.textSecondary}
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </View>
                </View>
              </ScrollView>

              {/* 4. Sticky Footer with Action Button */}
              <View style={styles.stickyFooter}>
                <TouchableOpacity
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      mode === 'TRANSFERENCIA'
                        ? ['#4338CA', '#6366F1']
                        : mode === 'INGRESO'
                        ? ['#059669', '#10B981']
                        : ['#DC2626', '#EF4444']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveGradient}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSaving
                        ? 'Procesando...'
                        : transactionToEdit
                        ? '✓ Guardar Cambios'
                        : mode === 'TRANSFERENCIA'
                        ? '✓ Realizar Transferencia'
                        : '✓ Registrar Transacción'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>

      {/* Modal for "+ Agregar" Category */}
      <Modal
        visible={isAddCatModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddCatModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.addCatModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.addCatCard}>
            <View style={styles.addCatHeader}>
              <Text style={styles.addCatTitle}>Nueva Categoría</Text>
              <TouchableOpacity
                onPress={() => setIsAddCatModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.addCatSubLabel}>Nombre de la categoría</Text>
            <TextInput
              style={styles.addCatInput}
              placeholder="Ej. Gimnasio, Mascotas, etc."
              placeholderTextColor="#94A3B8"
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus={true}
            />

            <Text style={styles.addCatSubLabel}>Color distintivo</Text>
            <View style={styles.colorPickerRow}>
              {PRESET_COLORS.map((color) => {
                const isSelected = newCatColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorDot,
                      { backgroundColor: color },
                      isSelected && styles.colorDotSelected,
                    ]}
                    onPress={() => setNewCatColor(color)}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.createCatBtn}
              onPress={handleCreateCategory}
              activeOpacity={0.8}
            >
              <Text style={styles.createCatBtnText}>✓ Guardar Categoría</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenWrapper: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    gap: 4,
  },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnIncomeBase: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  typeBtnIncomeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.90)',
    borderColor: '#34D399',
  },
  typeBtnExpenseBase: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  typeBtnExpenseActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.90)',
    borderColor: '#F87171',
  },
  typeBtnTransferBase: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  typeBtnTransferActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.90)',
    borderColor: '#A5B4FC',
  },
  typeBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  typeBtnTextIncome: {
    color: '#34D399',
  },
  typeBtnTextExpense: {
    color: '#F87171',
  },
  typeBtnTextTransfer: {
    color: '#A5B4FC',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  glassAmountCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  glassAmountLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(226, 232, 240, 0.75)',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  nativeAmountInput: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    minWidth: 150,
    textAlign: 'center',
    paddingVertical: 0,
  },
  incomeColor: {
    color: '#34D399',
  },
  expenseColor: {
    color: '#F87171',
  },
  transferColor: {
    color: '#818CF8',
  },
  whiteBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  scrollArea: {
    flex: 1,
  },
  scrollAreaContent: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 10,
  },
  categoryCard: {
    width: '48.5%',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  categoryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  addCategoryCard: {
    borderStyle: 'dashed',
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  addCategoryAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  customCategoryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customCategoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  customCategoryInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  transferContainer: {
    marginBottom: 12,
  },
  transferCardsWrap: {
    gap: 10,
  },
  transferWalletBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transferBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  swapBtn: {
    alignSelf: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  swapBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  walletRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  walletPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  walletPillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  walletPillTransferActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  walletPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  walletPillTextActive: {
    color: '#1E1B4B',
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  noteInput: {
    fontSize: 12.5,
    color: '#0F172A',
  },
  stickyFooter: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  /* Add Category Modal */
  addCatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  addCatCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  addCatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addCatTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  addCatSubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  addCatInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  colorPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: '#0F172A',
    transform: [{ scale: 1.15 }],
  },
  createCatBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createCatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  /* Date Selector & Editing Styles */
  dateSelectorSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  dateSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSelectorText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  dateChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dateChangeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  iosPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  iosDoneButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  iosDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  editingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
