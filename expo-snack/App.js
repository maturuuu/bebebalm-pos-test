import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme, formatCurrency, getStockStatus } from './theme';
import {
  clearAllData,
  loadInitialData,
  resetToDemoData,
  saveInventory,
  saveTickets,
} from './storage';
import ScannerModal from './components/ScannerModal';
import TicketReceiptModal from './components/TicketReceiptModal';

async function safeHaptic(kind = 'light') {
  try {
    if (kind === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Ignored when haptics are unavailable
  }
}

function StockPill({ stock }) {
  const status = getStockStatus(stock);
  return (
    <View
      style={[
        styles.stockPill,
        { backgroundColor: status.bg, borderColor: status.border },
      ]}
    >
      <Ionicons name={status.icon} size={13} color={status.text} />
      <Text style={[styles.stockPillText, { color: status.text }]}>
        {status.label} ({stock})
      </Text>
    </View>
  );
}

function PosAppContent() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'inventory' | 'tickets'

  // Persisted State
  const [inventory, setInventory] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [nextTicketNumber, setNextTicketNumber] = useState(1001);

  // POS Active Ticket State
  const [cart, setCart] = useState([]); // [{ itemId, name, sku, price, quantity }]
  const [posBanner, setPosBanner] = useState(null);
  const [manualPickerVisible, setManualPickerVisible] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  // Inventory Setup State
  const [inventorySearch, setInventorySearch] = useState('');
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');

  // Scanner Modal State
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerMode, setScannerMode] = useState('pos'); // 'pos' | 'sku'
  const [reopenItemModalAfterScan, setReopenItemModalAfterScan] = useState(false);

  // Receipt Modal State
  const [receiptTicket, setReceiptTicket] = useState(null);
  const [receiptIsNew, setReceiptIsNew] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await loadInitialData();
      setInventory(data.inventory);
      setTickets(data.tickets);
      setNextTicketNumber(data.nextTicketNumber);
      setLoading(false);
    })();
  }, []);

  const currentTicketLabel = `TKT-${nextTicketNumber}`;

  const cartSummary = useMemo(() => {
    let total = 0;
    let units = 0;
    for (const line of cart) {
      total += line.price * line.quantity;
      units += line.quantity;
    }
    return { total, units };
  }, [cart]);

  const filteredInventory = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
    );
  }, [inventory, inventorySearch]);

  const filteredManualItems = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
    );
  }, [inventory, manualSearch]);

  // Helper to update & persist inventory
  const updateInventoryState = (updater) => {
    setInventory((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveInventory(next);
      return next;
    });
  };

  // Add item to POS cart with stock validation
  const addItemToCart = (invItem) => {
    if (!invItem) return { status: 'not_found' };

    if (invItem.stock <= 0) {
      safeHaptic('warning');
      Alert.alert(
        'Out of Stock',
        `${invItem.name} currently has 0 units in stock. Restock it in the Inventory tab first.`
      );
      return {
        status: 'stock_limit',
        message: `${invItem.name} is out of stock (0 available).`,
      };
    }

    const existing = cart.find((c) => c.itemId === invItem.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > invItem.stock) {
      safeHaptic('warning');
      Alert.alert(
        'Stock Limit Reached',
        `Only ${invItem.stock} unit${invItem.stock === 1 ? '' : 's'} of ${invItem.name} available in stock.`
      );
      return {
        status: 'stock_limit',
        message: `Only ${invItem.stock} available for ${invItem.name}.`,
      };
    }

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.itemId === invItem.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...prev,
        {
          itemId: invItem.id,
          name: invItem.name,
          sku: invItem.sku,
          price: invItem.price,
          quantity: 1,
        },
      ];
    });

    setPosBanner({
      type: 'success',
      text: `Added ${invItem.name} (${formatCurrency(invItem.price)})`,
    });
    return { status: 'added', item: invItem };
  };

  const handleScanPosBarcode = (scannedCode) => {
    const match = inventory.find(
      (item) => item.sku.trim().toLowerCase() === scannedCode.trim().toLowerCase()
    );
    if (!match) {
      return { status: 'not_found' };
    }
    return addItemToCart(match);
  };

  const updateCartQuantity = (itemId, delta) => {
    const invItem = inventory.find((i) => i.id === itemId);
    const line = cart.find((c) => c.itemId === itemId);
    if (!line) return;

    const nextQty = line.quantity + delta;
    if (nextQty <= 0) {
      safeHaptic('light');
      setCart((prev) => prev.filter((c) => c.itemId !== itemId));
      return;
    }

    const maxStock = invItem ? invItem.stock : line.quantity;
    if (nextQty > maxStock) {
      safeHaptic('warning');
      Alert.alert(
        'Stock Limit Reached',
        `Only ${maxStock} unit${maxStock === 1 ? '' : 's'} available in inventory.`
      );
      return;
    }

    safeHaptic('light');
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, quantity: nextQty } : c))
    );
  };

  const removeCartItem = (itemId) => {
    safeHaptic('light');
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const handleCompletePurchase = () => {
    if (cart.length === 0) return;

    // Validate stock for all items before deducting
    for (const line of cart) {
      const invItem = inventory.find((i) => i.id === line.itemId);
      if (!invItem) {
        Alert.alert(
          'Item Unavailable',
          `${line.name} is no longer in inventory. Please remove it from the ticket.`
        );
        return;
      }
      if (line.quantity > invItem.stock) {
        Alert.alert(
          'Insufficient Stock',
          `Not enough stock for ${line.name}. Available: ${invItem.stock}, In Ticket: ${line.quantity}.`
        );
        return;
      }
    }

    // Deduct quantities from inventory
    const updatedInventory = inventory.map((invItem) => {
      const cartLine = cart.find((c) => c.itemId === invItem.id);
      if (!cartLine) return invItem;
      return {
        ...invItem,
        stock: Math.max(0, invItem.stock - cartLine.quantity),
        updatedAt: new Date().toISOString(),
      };
    });

    const completedTicket = {
      id: `ticket-${Date.now()}`,
      ticketNumber: currentTicketLabel,
      createdAt: new Date().toISOString(),
      itemCount: cartSummary.units,
      total: cartSummary.total,
      items: cart.map((c) => ({ ...c })),
    };

    const updatedTickets = [completedTicket, ...tickets];
    const updatedNextNumber = nextTicketNumber + 1;

    setInventory(updatedInventory);
    setTickets(updatedTickets);
    setNextTicketNumber(updatedNextNumber);
    setCart([]);
    setPosBanner(null);

    saveInventory(updatedInventory);
    saveTickets(updatedTickets, updatedNextNumber);

    safeHaptic('success');
    setReceiptIsNew(true);
    setReceiptTicket(completedTicket);
  };

  // Inventory Modal Handlers
  const openAddItemModal = (prefillSku = '') => {
    setEditingItemId(null);
    setFormName('');
    setFormSku(prefillSku);
    setFormPrice('');
    setFormStock('10');
    setItemModalVisible(true);
  };

  const openEditItemModal = (item) => {
    setEditingItemId(item.id);
    setFormName(item.name);
    setFormSku(item.sku);
    setFormPrice(String(item.price));
    setFormStock(String(item.stock));
    setItemModalVisible(true);
  };

  const handleSaveItem = () => {
    const cleanName = formName.trim();
    const cleanSku = formSku.trim();
    const parsedPrice = parseFloat(formPrice);
    const parsedStock = parseInt(formStock, 10);

    if (!cleanName) {
      Alert.alert('Missing Name', 'Please enter an Item Name.');
      return;
    }
    if (!cleanSku) {
      Alert.alert('Missing SKU', 'Please enter or scan a SKU / Barcode.');
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid unit price (e.g. 12.50).');
      return;
    }
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity (0 or more).');
      return;
    }

    const duplicateSku = inventory.find(
      (i) =>
        i.sku.trim().toLowerCase() === cleanSku.toLowerCase() &&
        i.id !== editingItemId
    );
    if (duplicateSku) {
      Alert.alert(
        'Duplicate SKU',
        `SKU "${cleanSku}" is already assigned to "${duplicateSku.name}".`
      );
      return;
    }

    if (editingItemId) {
      updateInventoryState((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                name: cleanName,
                sku: cleanSku,
                price: parsedPrice,
                stock: parsedStock,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      // Sync updated name/price in active cart if present
      setCart((prev) =>
        prev.map((line) =>
          line.itemId === editingItemId
            ? {
                ...line,
                name: cleanName,
                sku: cleanSku,
                price: parsedPrice,
                quantity: Math.min(line.quantity, Math.max(1, parsedStock)),
              }
            : line
        )
      );
    } else {
      const newItem = {
        id: `item-${Date.now()}`,
        name: cleanName,
        sku: cleanSku,
        price: parsedPrice,
        stock: parsedStock,
        updatedAt: new Date().toISOString(),
      };
      updateInventoryState((prev) => [newItem, ...prev]);
    }

    safeHaptic('success');
    setItemModalVisible(false);
  };

  const adjustInventoryStock = (itemId, delta) => {
    safeHaptic('light');
    updateInventoryState((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              stock: Math.max(0, item.stock + delta),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  };

  const confirmDeleteItem = (item) => {
    Alert.alert(
      'Delete Product',
      `Remove "${item.name}" from your inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            updateInventoryState((prev) => prev.filter((i) => i.id !== item.id));
            setCart((prev) => prev.filter((c) => c.itemId !== item.id));
            safeHaptic('light');
          },
        },
      ]
    );
  };

  const handleResetDemo = () => {
    Alert.alert(
      'Reset Demo Inventory',
      'Restore the 5 sample Bebebalm products and clear sales history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Demo',
          onPress: async () => {
            const data = await resetToDemoData();
            setInventory(data.inventory);
            setTickets(data.tickets);
            setNextTicketNumber(data.nextTicketNumber);
            setCart([]);
            setPosBanner(null);
            safeHaptic('success');
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Saved Data',
      'Remove all inventory items and purchase history from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const data = await clearAllData();
            setInventory(data.inventory);
            setTickets(data.tickets);
            setNextTicketNumber(data.nextTicketNumber);
            setCart([]);
            setPosBanner(null);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Bebebalm POS...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" backgroundColor={theme.colors.brandTint} />

      {/* Brand Header */}
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.brandWordmark}>Bebebalm</Text>
          <Text style={styles.brandTagline}>Natural Skin Rescue · Mobile POS</Text>
        </View>
        <View style={styles.headerTicketBadge}>
          <Text style={styles.headerTicketLabel}>
            {activeTab === 'pos'
              ? currentTicketLabel
              : activeTab === 'inventory'
              ? `${inventory.length} SKUs`
              : `${tickets.length} Tickets`}
          </Text>
        </View>
      </View>

      {/* Main Active Screen */}
      <View style={styles.content}>
        {activeTab === 'pos' && (
          <View style={styles.screenWrap}>
            {/* POS Action Strip */}
            <View style={styles.posActionsCard}>
              <TouchableOpacity
                style={styles.scanPrimaryBtn}
                onPress={() => {
                  setScannerMode('pos');
                  setReopenItemModalAfterScan(false);
                  setScannerVisible(true);
                }}
                activeOpacity={0.88}
              >
                <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
                <Text style={styles.scanPrimaryBtnText}>Scan Barcode</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => {
                  setManualSearch('');
                  setManualPickerVisible(true);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="search-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.browseBtnText}>Browse</Text>
              </TouchableOpacity>
            </View>

            {posBanner && (
              <View style={styles.posConfirmBanner}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.colors.stockInText}
                />
                <Text style={styles.posConfirmText} numberOfLines={1}>
                  {posBanner.text}
                </Text>
                <TouchableOpacity
                  onPress={() => setPosBanner(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={theme.colors.stockInText} />
                </TouchableOpacity>
              </View>
            )}

            {/* Active Ticket Header */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Active Ticket · {currentTicketLabel}</Text>
              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Clear Ticket', 'Remove all items from this ticket?', [
                      { text: 'Keep', style: 'cancel' },
                      {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: () => {
                          setCart([]);
                          setPosBanner(null);
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.clearLink}>Clear Cart</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="cart-outline" size={34} color={theme.colors.secondary} />
                </View>
                <Text style={styles.emptyTitle}>Ticket Ready</Text>
                <Text style={styles.emptySub}>
                  Tap "Scan Barcode" to ring up products with your camera, or tap "Browse" to pick items manually.
                </Text>
              </View>
            ) : (
              <FlatList
                data={cart}
                keyExtractor={(item) => item.itemId}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                renderItem={({ item }) => {
                  const inv = inventory.find((i) => i.id === item.itemId);
                  const available = inv ? inv.stock : item.quantity;
                  return (
                    <View style={styles.cartCard}>
                      <View style={styles.cartTop}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.cartItemName}>{item.name}</Text>
                          <Text style={styles.cartItemMeta}>
                            SKU {item.sku} · {formatCurrency(item.price)} each · {available} in stock
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => removeCartItem(item.itemId)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={theme.colors.danger}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.cartBottom}>
                        <View style={styles.qtyStepper}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateCartQuantity(item.itemId, -1)}
                          >
                            <Ionicons name="remove" size={18} color={theme.colors.primary} />
                          </TouchableOpacity>
                          <Text style={styles.qtyValue}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => updateCartQuantity(item.itemId, 1)}
                          >
                            <Ionicons name="add" size={18} color={theme.colors.primary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.cartSubtotal}>
                          {formatCurrency(item.price * item.quantity)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Checkout Summary Footer */}
            <View style={styles.checkoutBar}>
              <View style={styles.checkoutTotalCol}>
                <Text style={styles.checkoutLabel}>
                  Total ({cartSummary.units}{' '}
                  {cartSummary.units === 1 ? 'item' : 'items'})
                </Text>
                <Text style={styles.checkoutAmount}>
                  {formatCurrency(cartSummary.total)}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.completeBtn,
                  cart.length === 0 && styles.completeBtnDisabled,
                ]}
                disabled={cart.length === 0}
                onPress={handleCompletePurchase}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.completeBtnText}>Complete Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.screenWrap}>
            {/* Search & Add Row */}
            <View style={styles.inventoryToolbar}>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={theme.colors.textMuted}
                />
                <TextInput
                  style={styles.searchInput}
                  value={inventorySearch}
                  onChangeText={setInventorySearch}
                  placeholder="Search by product name or SKU..."
                  placeholderTextColor={theme.colors.textMuted}
                />
                {inventorySearch.length > 0 && (
                  <TouchableOpacity onPress={() => setInventorySearch('')}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => openAddItemModal('')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Sample Data Controls */}
            <View style={styles.demoBar}>
              <Text style={styles.demoBarLabel}>
                {filteredInventory.length} product
                {filteredInventory.length === 1 ? '' : 's'} shown
              </Text>
              <View style={styles.demoActions}>
                <TouchableOpacity onPress={handleResetDemo} style={styles.demoLinkBtn}>
                  <Text style={styles.demoLinkText}>Reset Demo</Text>
                </TouchableOpacity>
                <Text style={styles.demoDivider}>·</Text>
                <TouchableOpacity onPress={handleClearAll} style={styles.demoLinkBtn}>
                  <Text style={[styles.demoLinkText, { color: theme.colors.danger }]}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Inventory List */}
            {filteredInventory.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="cube-outline" size={34} color={theme.colors.secondary} />
                </View>
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptySub}>
                  {inventorySearch
                    ? 'Try a different search term or clear your filter.'
                    : 'Tap "+ Add" to register your first SKU, or tap "Reset Demo" to load starter Bebebalm items.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredInventory}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                renderItem={({ item }) => (
                  <View style={styles.invCard}>
                    <View style={styles.invCardTop}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.invName}>{item.name}</Text>
                        <Text style={styles.invSku}>SKU: {item.sku}</Text>
                      </View>
                      <Text style={styles.invPrice}>{formatCurrency(item.price)}</Text>
                    </View>

                    <View style={styles.invCardBottom}>
                      <StockPill stock={item.stock} />

                      <View style={styles.invControls}>
                        <TouchableOpacity
                          style={styles.stockMiniBtn}
                          onPress={() => adjustInventoryStock(item.id, -1)}
                        >
                          <Ionicons name="remove" size={16} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stockMiniBtn}
                          onPress={() => adjustInventoryStock(item.id, 1)}
                        >
                          <Ionicons name="add" size={16} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editMiniBtn}
                          onPress={() => openEditItemModal(item)}
                        >
                          <Ionicons
                            name="create-outline"
                            size={17}
                            color={theme.colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteMiniBtn}
                          onPress={() => confirmDeleteItem(item)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={17}
                            color={theme.colors.danger}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        )}

        {activeTab === 'tickets' && (
          <View style={styles.screenWrap}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Completed Purchase Tickets</Text>
              <Text style={styles.sectionMeta}>
                {tickets.length} {tickets.length === 1 ? 'sale' : 'sales'}
              </Text>
            </View>

            {tickets.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name="receipt-outline"
                    size={34}
                    color={theme.colors.secondary}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Completed Tickets Yet</Text>
                <Text style={styles.emptySub}>
                  Completed sales from the POS tab appear here with full itemized receipts.
                </Text>
              </View>
            ) : (
              <FlatList
                data={tickets}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                renderItem={({ item }) => {
                  const dateLabel = new Date(item.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <TouchableOpacity
                      style={styles.ticketCard}
                      onPress={() => {
                        setReceiptIsNew(false);
                        setReceiptTicket(item);
                      }}
                      activeOpacity={0.82}
                    >
                      <View style={styles.ticketIconWrap}>
                        <Ionicons
                          name="receipt-outline"
                          size={22}
                          color={theme.colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
                        <Text style={styles.ticketMeta}>
                          {dateLabel} · {item.itemCount}{' '}
                          {item.itemCount === 1 ? 'unit' : 'units'}
                        </Text>
                      </View>
                      <View style={styles.ticketRight}>
                        <Text style={styles.ticketTotal}>
                          {formatCurrency(item.total)}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={theme.colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}
      </View>

      {/* Lightweight, Reliable Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('pos')}
          activeOpacity={0.8}
        >
          <View style={styles.tabIconWrap}>
            <Ionicons
              name={activeTab === 'pos' ? 'cart' : 'cart-outline'}
              size={22}
              color={
                activeTab === 'pos' ? theme.colors.primary : theme.colors.textMuted
              }
            />
            {cartSummary.units > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{cartSummary.units}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'pos' && styles.tabLabelActive,
            ]}
          >
            POS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('inventory')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'inventory' ? 'cube' : 'cube-outline'}
            size={22}
            color={
              activeTab === 'inventory'
                ? theme.colors.primary
                : theme.colors.textMuted
            }
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'inventory' && styles.tabLabelActive,
            ]}
          >
            Inventory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('tickets')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'tickets' ? 'receipt' : 'receipt-outline'}
            size={22}
            color={
              activeTab === 'tickets'
                ? theme.colors.primary
                : theme.colors.textMuted
            }
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'tickets' && styles.tabLabelActive,
            ]}
          >
            Tickets
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Item Picker Modal (POS Fallback) */}
      <Modal
        visible={manualPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setManualPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Browse Products</Text>
              <TouchableOpacity
                onPress={() => setManualPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { marginBottom: 12 }]}>
              <Ionicons
                name="search-outline"
                size={18}
                color={theme.colors.textMuted}
              />
              <TextInput
                style={styles.searchInput}
                value={manualSearch}
                onChangeText={setManualSearch}
                placeholder="Search item name or SKU..."
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <FlatList
              data={filteredManualItems}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No matching products in inventory.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    const res = addItemToCart(item);
                    if (res.status === 'added') {
                      safeHaptic('success');
                      setManualPickerVisible(false);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerMeta}>
                      SKU {item.sku} · {item.stock} available
                    </Text>
                  </View>
                  <View style={styles.pickerRight}>
                    <Text style={styles.pickerPrice}>
                      {formatCurrency(item.price)}
                    </Text>
                    <Ionicons
                      name="add-circle"
                      size={24}
                      color={
                        item.stock > 0
                          ? theme.colors.secondary
                          : theme.colors.textMuted
                      }
                    />
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Add / Edit Inventory Item Modal */}
      <Modal
        visible={itemModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setItemModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.formSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItemId ? 'Edit Product' : 'Add Product'}
              </Text>
              <TouchableOpacity
                onPress={() => setItemModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={styles.textInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Bebebalm Natural Skin Rescue Tin"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.inputLabel}>SKU / Barcode</Text>
              <View style={styles.skuInputRow}>
                <TextInput
                  style={styles.skuTextInput}
                  value={formSku}
                  onChangeText={setFormSku}
                  placeholder="Enter or scan barcode"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.scanSkuBtn}
                  onPress={() => {
                    setItemModalVisible(false);
                    setReopenItemModalAfterScan(true);
                    setScannerMode('sku');
                    setScannerVisible(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.scanSkuBtnText}>Scan SKU</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit Price ($)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    placeholder="14.50"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Stock Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formStock}
                    onChangeText={setFormStock}
                    placeholder="10"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveItemBtn}
                onPress={handleSaveItem}
                activeOpacity={0.88}
              >
                <Ionicons name="save-outline" size={19} color="#FFFFFF" />
                <Text style={styles.saveItemBtnText}>
                  {editingItemId ? 'Save Changes' : 'Save Product'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Camera Barcode Scanner Modal */}
      <ScannerModal
        visible={scannerVisible}
        mode={scannerMode}
        onClose={() => {
          setScannerVisible(false);
          if (reopenItemModalAfterScan) {
            setReopenItemModalAfterScan(false);
            setItemModalVisible(true);
          }
        }}
        onScanPosBarcode={handleScanPosBarcode}
        onScanSkuBarcode={(code) => {
          setFormSku(code);
          if (reopenItemModalAfterScan) {
            setReopenItemModalAfterScan(false);
            setItemModalVisible(true);
          }
        }}
        onQuickAddUnknownSku={(code) => {
          setScannerVisible(false);
          setReopenItemModalAfterScan(false);
          setActiveTab('inventory');
          openAddItemModal(code);
        }}
      />

      {/* Ticket Receipt Confirmation / History Modal */}
      <TicketReceiptModal
        visible={Boolean(receiptTicket)}
        ticket={receiptTicket}
        isNewPurchase={receiptIsNew}
        onClose={() => setReceiptTicket(null)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PosAppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.brandTint,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0,
  },
  appHeader: {
    backgroundColor: theme.colors.brandTint,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWordmark: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    opacity: 0.78,
    marginTop: 1,
  },
  headerTicketBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    ...theme.shadows.card,
  },
  headerTicketLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  screenWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  posActionsCard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  scanPrimaryBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...theme.shadows.floating,
  },
  scanPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  browseBtn: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  browseBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  posConfirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.stockInBg,
    borderColor: theme.colors.stockInBorder,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  posConfirmText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.stockInText,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  clearLink: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  cartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cartTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cartItemMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radii.md,
    padding: 4,
    gap: 6,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  cartSubtotal: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  checkoutTotalCol: {
    paddingLeft: 4,
  },
  checkoutLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  checkoutAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  completeBtn: {
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeBtnDisabled: {
    backgroundColor: '#BDD8DF',
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  inventoryToolbar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 8,
  },
  addBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  demoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  demoBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  demoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoLinkBtn: {
    paddingVertical: 4,
  },
  demoLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.secondary,
  },
  demoDivider: {
    color: theme.colors.textMuted,
  },
  invCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  invCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  invSku: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  invPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  invCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
  },
  stockPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  invControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.accentYellowSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteMiniBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  ticketIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  ticketMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  ticketRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrap: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  formSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerEmpty: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    paddingVertical: 24,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  pickerName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  pickerMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pickerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    minHeight: 48,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  skuInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 48,
  },
  skuTextInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingVertical: 10,
  },
  scanSkuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radii.sm,
  },
  scanSkuBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveItemBtn: {
    marginTop: 22,
    marginBottom: 10,
    minHeight: 52,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveItemBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
