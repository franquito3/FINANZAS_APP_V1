import React, { useMemo, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Slot, usePathname, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Wallet, FileText, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DashboardMetrics } from '../../components/DashboardMetrics';
import { TransactionModal } from '../../components/TransactionModal';
import {
  FinanceShellProvider,
  useFinanceShell,
} from '../../context/FinanceShellContext';
import { useAuth } from '../../context/AuthContext';
import { useSyncStatus } from '../../hooks/useSyncStatus';

const ACTIVE_VIOLET = '#7C3AED';
const INACTIVE_GRAY = '#94A3B8';

function AppShellContent() {
  const pathname = usePathname();
  const { user } = useAuth();
  const syncStatus = useSyncStatus();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['56%', '100%'], []);

  const userPhoto = (user?.user_metadata?.avatar_url || user?.user_metadata?.picture) as string | undefined;
  const userInitial = ((user?.user_metadata?.full_name || user?.email || 'U')[0] || 'U').toUpperCase();

  const {
    summary,
    wallets,
    selectedWalletId,
    setSelectedWalletId,
    refreshData,
    openTransactionModal,
    closeTransactionModal,
    isModalOpen,
    modalInitialType,
    editingTransaction,
  } = useFinanceShell();

  const isFinanzas = pathname === '/' || pathname === '/index';
  const isReportes = pathname.startsWith('/reports');
  const isSesion = pathname.startsWith('/auth');

  const handleTabPress = (targetPath: '/' | '/reports' | '/auth', isCurrent: boolean) => {
    if (isCurrent) return;
    // Strategic haptic: subtle Light impact when changing tabs
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(targetPath);
  };

  return (
    <LinearGradient
      colors={['#070D2D', '#161D65', '#351875']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 0.55 }}
      style={styles.rootGradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Main area above bottom tab bar */}
        <View style={styles.shellBody}>
          {/* 1. Persistent Global Top Header + Liquid Glass Balance Card */}
          <View style={styles.persistentHero}>
            <View style={styles.header}>
              <View>
                <Text style={styles.brandTitle}>ProyectoX</Text>
                <Text style={styles.brandSubtitle}>Finanzas</Text>
              </View>

              {user ? (
                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace('/auth');
                  }}
                  activeOpacity={0.8}
                >
                  {userPhoto ? (
                    <Image source={{ uri: userPhoto }} style={styles.profileAvatar} />
                  ) : (
                    <View style={styles.profileInitial}>
                      <Text style={styles.profileInitialText}>{userInitial}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.loginPill}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.replace('/auth');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-circle-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.loginPillText}>Iniciar sesión</Text>
                </TouchableOpacity>
              )}
            </View>

            <DashboardMetrics
              summary={summary}
              wallets={wallets}
              selectedWalletId={selectedWalletId}
              onSelectWallet={setSelectedWalletId}
              onQuickAction={openTransactionModal}
            />
          </View>

          {/* 2. Draggable Bottom Sheet (@gorhom/bottom-sheet) */}
          <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            enablePanDownToClose={false}
            enableDynamicSizing={false}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.sheetHandleIndicator}
            style={styles.bottomSheetShadow}
          >
            <View style={styles.sheetContentContainer}>
              <Slot />
            </View>
          </BottomSheet>
        </View>

        {/* 3. Modern 3-Tab Bottom Navigation Bar (Finanzas, Reportes, Sesión) */}
        <SafeAreaView edges={['bottom']} style={styles.tabBarSafeWrapper}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('/', isFinanzas)}
              activeOpacity={0.75}
            >
              <Wallet
                size={22}
                color={isFinanzas ? ACTIVE_VIOLET : INACTIVE_GRAY}
                strokeWidth={isFinanzas ? 2.4 : 1.9}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFinanzas ? ACTIVE_VIOLET : INACTIVE_GRAY },
                  isFinanzas && styles.tabLabelActive,
                ]}
              >
                Finanzas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('/reports', isReportes)}
              activeOpacity={0.75}
            >
              <FileText
                size={22}
                color={isReportes ? ACTIVE_VIOLET : INACTIVE_GRAY}
                strokeWidth={isReportes ? 2.4 : 1.9}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isReportes ? ACTIVE_VIOLET : INACTIVE_GRAY },
                  isReportes && styles.tabLabelActive,
                ]}
              >
                Reportes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => handleTabPress('/auth', isSesion)}
              activeOpacity={0.75}
            >
              <ShieldCheck
                size={22}
                color={isSesion ? ACTIVE_VIOLET : INACTIVE_GRAY}
                strokeWidth={isSesion ? 2.4 : 1.9}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isSesion ? ACTIVE_VIOLET : INACTIVE_GRAY },
                  isSesion && styles.tabLabelActive,
                ]}
              >
                Sesión
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaView>

      {/* 4. Full-Screen Transaction Modal accessible from the persistent header */}
      <TransactionModal
        visible={isModalOpen}
        initialType={modalInitialType}
        transactionToEdit={editingTransaction}
        onClose={closeTransactionModal}
        onSuccess={refreshData}
        wallets={wallets}
      />
    </LinearGradient>
  );
}

export default function TabsLayout() {
  return (
    <FinanceShellProvider>
      <AppShellContent />
    </FinanceShellProvider>
  );
}

const styles = StyleSheet.create({
  rootGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  shellBody: {
    flex: 1,
  },
  persistentHero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  brandSubtitle: {
    fontSize: 21,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: -0.2,
    lineHeight: 25,
  },
  profileBtn: {
    borderRadius: 19,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  profileInitial: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitialText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  loginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    marginTop: 2,
  },
  loginPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  sheetHandleIndicator: {
    backgroundColor: '#CBD5E1',
    width: 42,
    height: 5,
    borderRadius: 3,
  },
  bottomSheetShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 14,
  },
  sheetContentContainer: {
    flex: 1,
  },
  tabBarSafeWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tabBar: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingBottom: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
});
