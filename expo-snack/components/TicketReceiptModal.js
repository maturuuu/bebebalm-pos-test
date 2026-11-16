import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, formatCurrency } from '../theme';

export default function TicketReceiptModal({
  visible,
  ticket,
  isNewPurchase = false,
  onClose,
}) {
  if (!ticket) return null;

  const formattedDate = new Date(ticket.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View
              style={[
                styles.badgeCircle,
                isNewPurchase ? styles.badgeSuccess : styles.badgeNeutral,
              ]}
            >
              <Ionicons
                name={isNewPurchase ? 'checkmark-done' : 'receipt-outline'}
                size={28}
                color={isNewPurchase ? theme.colors.stockInText : theme.colors.primary}
              />
            </View>
            <Text style={styles.title}>
              {isNewPurchase ? 'Purchase Complete!' : `Ticket ${ticket.ticketNumber}`}
            </Text>
            <Text style={styles.subtitle}>
              {isNewPurchase
                ? `${ticket.ticketNumber} saved & inventory updated`
                : formattedDate}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Ticket #</Text>
            <Text style={styles.metaValue}>{ticket.ticketNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date & Time</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
            {ticket.items.map((item) => (
              <View key={item.id || item.sku} style={styles.lineItem}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    SKU {item.sku} · {item.quantity} × {formatCurrency(item.price)}
                  </Text>
                </View>
                <Text style={styles.itemSubtotal}>
                  {formatCurrency(item.quantity * item.price)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalItemsCount}>
                {ticket.itemCount} {ticket.itemCount === 1 ? 'unit' : 'units'}
              </Text>
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(ticket.total)}</Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeBtnText}>
              {isNewPurchase ? 'Start New Ticket' : 'Close Receipt'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 22,
    ...theme.shadows.floating,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.stockInBg,
  },
  badgeNeutral: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: 14,
  },
  itemsScroll: {
    maxHeight: 240,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  itemMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  totalItemsCount: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  closeBtn: {
    minHeight: 50,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
