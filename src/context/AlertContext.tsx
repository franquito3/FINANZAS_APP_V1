import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export type AlertType = 'success' | 'warning' | 'error' | 'confirm' | 'info';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  buttons?: AlertButton[];
}

interface AlertContextValue {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextValue>({
  showAlert: () => {},
  hideAlert: () => {},
});

export const useAlert = () => useContext(AlertContext);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showAlert = useCallback((options: AlertOptions) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAlertConfig(options);
    setVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setAlertConfig(null);
    }, 250);
  }, []);

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cb = alertConfig?.onConfirm;
    hideAlert();
    if (cb) cb();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cb = alertConfig?.onCancel;
    hideAlert();
    if (cb) cb();
  };

  const type = alertConfig?.type || 'info';

  const iconDetails = {
    success: {
      name: 'checkmark-circle' as const,
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.12)',
    },
    warning: {
      name: 'warning' as const,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.12)',
    },
    error: {
      name: 'alert-circle' as const,
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.12)',
    },
    confirm: {
      name: 'help-circle' as const,
      color: '#6366F1',
      bg: 'rgba(99, 102, 241, 0.12)',
    },
    info: {
      name: 'information-circle' as const,
      color: '#3B82F6',
      bg: 'rgba(59, 130, 246, 0.12)',
    },
  }[type];

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      {visible && alertConfig && (
        <Modal
          visible={visible}
          transparent={true}
          animationType="none"
          statusBarTranslucent={true}
          onRequestClose={hideAlert}
        >
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(140)}
            style={styles.overlay}
          >
            {/* Blurred backdrop */}
            <TouchableWithoutFeedback onPress={type === 'confirm' ? undefined : hideAlert}>
              <View style={StyleSheet.absoluteFill}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.backdropDim} />
              </View>
            </TouchableWithoutFeedback>

            {/* Alert Dialog Card */}
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.card}
            >
              {/* Top Icon Badge */}
              <View style={[styles.iconWrap, { backgroundColor: iconDetails.bg }]}>
                <Ionicons name={iconDetails.name} size={34} color={iconDetails.color} />
              </View>

              {/* Title & Message */}
              <Text style={styles.title}>{alertConfig.title}</Text>
              {!!alertConfig.message && (
                <Text style={styles.message}>{alertConfig.message}</Text>
              )}

            {/* Actions */}
            {alertConfig?.buttons && alertConfig.buttons.length > 0 ? (
              <View style={alertConfig.buttons.length > 1 ? styles.actionsRow : { width: '100%' }}>
                {alertConfig.buttons.map((btn, idx) => {
                  const isDestructive = btn.style === 'destructive';
                  const isCancel = btn.style === 'cancel';
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.btn,
                        alertConfig.buttons!.length > 1 ? { flex: 1 } : { width: '100%' },
                        isDestructive ? styles.destructiveBtn : isCancel ? styles.cancelBtn : styles.confirmBtn,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        hideAlert();
                        btn.onPress?.();
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.confirmBtnText,
                          isCancel && styles.cancelBtnText,
                          isDestructive && styles.destructiveBtnText,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : type === 'confirm' ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={handleCancel}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>
                    {alertConfig?.cancelText || 'Cancelar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>
                    {alertConfig?.confirmText || 'Confirmar'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btn, styles.singleBtn]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.singleBtnText}>
                  {alertConfig?.confirmText || 'Entendido'}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
      )}
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdropDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  singleBtn: {
    width: '100%',
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  singleBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  destructiveBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  destructiveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
