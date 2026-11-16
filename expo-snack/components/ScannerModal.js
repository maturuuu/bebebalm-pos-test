import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme, formatCurrency } from '../theme';

const SUPPORTED_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'qr',
];

const SCAN_COOLDOWN_MS = 1800;

async function triggerHaptic(type = 'success') {
  try {
    if (type === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (type === 'light') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // Haptics safely ignored on unsupported simulators/web
  }
}

export default function ScannerModal({
  visible,
  mode = 'pos', // 'pos' | 'sku'
  onClose,
  onScanPosBarcode,
  onScanSkuBarcode,
  onQuickAddUnknownSku,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState(null);
  const [unknownCode, setUnknownCode] = useState(null);

  const lastScanRef = useRef({ code: '', timestamp: 0 });
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setTorchEnabled(false);
      setFeedbackBanner(null);
      setUnknownCode(null);
      lastScanRef.current = { code: '', timestamp: 0 };
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    }
  }, [visible]);

  const showTimedBanner = (banner) => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    setFeedbackBanner(banner);
    bannerTimerRef.current = setTimeout(() => {
      setFeedbackBanner(null);
    }, 2600);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (!data || unknownCode) return;

    const cleanCode = String(data).trim();
    const now = Date.now();
    const elapsed = now - lastScanRef.current.timestamp;

    // Debounce / cooldown so a single barcode isn't scanned multiple times per second
    if (
      elapsed < SCAN_COOLDOWN_MS &&
      (lastScanRef.current.code === cleanCode || elapsed < 900)
    ) {
      return;
    }

    lastScanRef.current = { code: cleanCode, timestamp: now };

    if (mode === 'sku') {
      triggerHaptic('success');
      onScanSkuBarcode?.(cleanCode);
      onClose?.();
      return;
    }

    // POS Mode
    const result = onScanPosBarcode?.(cleanCode);
    if (!result) return;

    if (result.status === 'added') {
      triggerHaptic('success');
      showTimedBanner({
        type: 'success',
        title: `Added +1 ${result.item.name}`,
        subtitle: `SKU ${result.item.sku} · ${formatCurrency(result.item.price)}`,
      });
    } else if (result.status === 'stock_limit') {
      triggerHaptic('warning');
      showTimedBanner({
        type: 'warning',
        title: 'Stock Limit Reached',
        subtitle: result.message,
      });
    } else if (result.status === 'not_found') {
      triggerHaptic('warning');
      setUnknownCode(cleanCode);
    }
  };

  const renderPermissionState = () => {
    if (!permission) {
      return (
        <View style={styles.permissionCard}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
          <Text style={styles.permissionTitle}>Checking Camera Access...</Text>
        </View>
      );
    }

    return (
      <View style={styles.permissionCard}>
        <View style={styles.permissionIconWrap}>
          <Ionicons name="camera-outline" size={38} color={theme.colors.primary} />
        </View>
        <Text style={styles.permissionTitle}>Camera Permission Needed</Text>
        <Text style={styles.permissionBody}>
          {permission.canAskAgain === false
            ? 'Camera access was denied. Please enable Camera permission for Expo Go in your Android device settings to scan product barcodes.'
            : 'Allow camera access to scan retail barcodes (EAN-13, UPC, Code 128, QR) directly into your ticket or inventory.'}
        </Text>
        {permission.canAskAgain !== false && (
          <TouchableOpacity
            style={styles.grantBtn}
            onPress={() => requestPermission()}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.cancelPermissionBtn}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelPermissionText}>Close Scanner</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission || !permission.granted ? (
          <View style={styles.permissionScreen}>{renderPermissionState()}</View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              enableTorch={torchEnabled}
              onBarcodeScanned={unknownCode ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: SUPPORTED_BARCODE_TYPES,
              }}
            />

            {/* Dark translucent framing overlay */}
            <View style={styles.overlay} pointerEvents="box-none">
              {/* Top Controls */}
              <View style={styles.topBar}>
                <TouchableOpacity
                  style={styles.iconCircleBtn}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.modePill}>
                  <Ionicons
                    name={mode === 'sku' ? 'pricetag-outline' : 'barcode-outline'}
                    size={16}
                    color={theme.colors.accentYellow}
                  />
                  <Text style={styles.modePillText}>
                    {mode === 'sku' ? 'Scan Product SKU' : 'POS Barcode Scanner'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.iconCircleBtn,
                    torchEnabled && styles.torchActiveBtn,
                  ]}
                  onPress={() => {
                    triggerHaptic('light');
                    setTorchEnabled((prev) => !prev);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={torchEnabled ? 'flash' : 'flash-outline'}
                    size={22}
                    color={torchEnabled ? theme.colors.primary : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </View>

              {/* Center Framing Guide */}
              <View style={styles.reticleContainer} pointerEvents="none">
                <View style={styles.reticleBox}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <View style={styles.scanLine} />
                </View>
                <Text style={styles.reticleHint}>
                  Align barcode inside the frame
                </Text>
              </View>

              {/* Bottom Feedback / Action Area */}
              <View style={styles.bottomArea}>
                {feedbackBanner && !unknownCode && (
                  <View
                    style={[
                      styles.feedbackBanner,
                      feedbackBanner.type === 'warning'
                        ? styles.feedbackWarning
                        : styles.feedbackSuccess,
                    ]}
                  >
                    <Ionicons
                      name={
                        feedbackBanner.type === 'warning'
                          ? 'alert-circle'
                          : 'checkmark-circle'
                      }
                      size={24}
                      color={
                        feedbackBanner.type === 'warning'
                          ? theme.colors.stockLowText
                          : theme.colors.stockInText
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.feedbackTitle,
                          {
                            color:
                              feedbackBanner.type === 'warning'
                                ? theme.colors.stockLowText
                                : theme.colors.stockInText,
                          },
                        ]}
                      >
                        {feedbackBanner.title}
                      </Text>
                      <Text style={styles.feedbackSub}>{feedbackBanner.subtitle}</Text>
                    </View>
                  </View>
                )}

                {unknownCode ? (
                  <View style={styles.unknownCard}>
                    <View style={styles.unknownHeader}>
                      <View style={styles.unknownIconWrap}>
                        <Ionicons
                          name="help-circle-outline"
                          size={26}
                          color={theme.colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.unknownTitle}>Barcode Not in Inventory</Text>
                        <Text style={styles.unknownCodeText}>SKU: {unknownCode}</Text>
                      </View>
                    </View>
                    <Text style={styles.unknownDesc}>
                      No saved product matches this barcode yet. Add it now so you can ring it up immediately.
                    </Text>
                    <View style={styles.unknownActions}>
                      <TouchableOpacity
                        style={styles.rescanBtn}
                        onPress={() => {
                          setUnknownCode(null);
                          lastScanRef.current = { code: '', timestamp: 0 };
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.rescanBtnText}>Scan Again</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addInventoryBtn}
                        onPress={() => {
                          const code = unknownCode;
                          setUnknownCode(null);
                          onQuickAddUnknownSku?.(code);
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.addInventoryBtnText}>
                          Add This Item to Inventory
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={onClose}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.doneBtnText}>
                      {mode === 'sku' ? 'Cancel Scan' : 'Done Scanning'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071426',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.floating,
  },
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 22,
  },
  grantBtn: {
    width: '100%',
    minHeight: 50,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelPermissionBtn: {
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelPermissionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  cameraWrapper: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 42 : 56,
    paddingBottom: 32,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(7, 20, 38, 0.28)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(14, 36, 71, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  torchActiveBtn: {
    backgroundColor: theme.colors.accentYellow,
    borderColor: theme.colors.accentYellow,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 36, 71, 0.82)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(143, 211, 222, 0.35)',
  },
  modePillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 268,
    height: 170,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: theme.colors.brandTint,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    width: '86%',
    height: 2,
    backgroundColor: theme.colors.accentYellow,
    opacity: 0.9,
  },
  reticleHint: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(14, 36, 71, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
  },
  bottomArea: {
    gap: 12,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: theme.colors.stockInBg,
    borderColor: theme.colors.stockInBorder,
  },
  feedbackWarning: {
    backgroundColor: theme.colors.stockLowBg,
    borderColor: theme.colors.stockLowBorder,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  unknownCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 18,
    ...theme.shadows.floating,
  },
  unknownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  unknownIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentYellowSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unknownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  unknownCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.secondary,
    marginTop: 2,
  },
  unknownDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
  unknownActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rescanBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescanBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  addInventoryBtn: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  addInventoryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  doneBtn: {
    minHeight: 50,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
