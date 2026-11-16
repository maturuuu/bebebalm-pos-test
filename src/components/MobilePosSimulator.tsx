import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Flashlight,
  HelpCircle,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { CartLine, CompletedTicket, InventoryItem, TabKey } from '../types/pos';

const STORAGE_KEYS = {
  INITIALIZED: 'bebebalm_web_initialized_v1',
  INVENTORY: 'bebebalm_web_inventory_v1',
  TICKETS: 'bebebalm_web_tickets_v1',
  NEXT_TICKET: 'bebebalm_web_next_ticket_v1',
};

const DEMO_PRODUCTS: InventoryItem[] = [
  {
    id: 'item-1',
    name: 'Bebebalm Natural Skin Rescue Tin',
    sku: '8901234500112',
    price: 14.5,
    stock: 18,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-2',
    name: 'Bebebalm Clarifying Shampoo Bar (60g)',
    sku: '8901234500228',
    price: 12.0,
    stock: 14,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-3',
    name: 'Bebebalm ByeSpots Rescue Stick',
    sku: '8901234500334',
    price: 9.75,
    stock: 4,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-4',
    name: 'Bebebalm Natural Skin Soother Balm',
    sku: '8901234500440',
    price: 11.25,
    stock: 22,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'item-5',
    name: 'Bebebalm Coconut Plush Gift Bundle',
    sku: '8901234500556',
    price: 28.0,
    stock: 0,
    updatedAt: new Date().toISOString(),
  },
];

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function getStockBadge(stock: number) {
  if (stock <= 0) {
    return {
      label: `Out of Stock (${stock})`,
      bg: '#FDECEC',
      text: '#B42318',
      border: '#F9C5C3',
      Icon: XCircle,
    };
  }
  if (stock <= 5) {
    return {
      label: `Low Stock (${stock})`,
      bg: '#FEF6D8',
      text: '#8A6200',
      border: '#F3DF93',
      Icon: AlertCircle,
    };
  }
  return {
    label: `In Stock (${stock})`,
    bg: '#E6F5EA',
    text: '#266337',
    border: '#BFE4CA',
    Icon: CheckCircle2,
  };
}

export default function MobilePosSimulator() {
  const [activeTab, setActiveTab] = useState<TabKey>('pos');

  // Persisted State
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
        localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(DEMO_PRODUCTS));
        localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.NEXT_TICKET, '1001');
        return DEMO_PRODUCTS;
      }
      const raw = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return DEMO_PRODUCTS;
    }
  });

  const [tickets, setTickets] = useState<CompletedTicket[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [nextTicketNumber, setNextTicketNumber] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NEXT_TICKET);
      return raw ? parseInt(raw, 10) || 1001 : 1001;
    } catch {
      return 1001;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    } catch {
      // Ignore storage quota errors
    }
  }, [inventory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
      localStorage.setItem(STORAGE_KEYS.NEXT_TICKET, String(nextTicketNumber));
    } catch {
      // Ignore storage quota errors
    }
  }, [tickets, nextTicketNumber]);

  // Active Ticket State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [banner, setBanner] = useState<{ type: 'success' | 'warning'; text: string } | null>(
    null
  );
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  // Inventory Search & Modal Form
  const [inventorySearch, setInventorySearch] = useState('');
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('10');
  const [formError, setFormError] = useState<string | null>(null);

  // Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'pos' | 'sku'>('pos');
  const [reopenItemModal, setReopenItemModal] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scannerBanner, setScannerBanner] = useState<{
    type: 'success' | 'warning';
    title: string;
    subtitle: string;
  } | null>(null);
  const [unknownSku, setUnknownSku] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptTicket, setReceiptTicket] = useState<CompletedTicket | null>(null);
  const [receiptIsNew, setReceiptIsNew] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

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
      (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }, [inventory, inventorySearch]);

  const filteredManualItems = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }, [inventory, manualSearch]);

  // Stop live webcam stream when scanner closes
  useEffect(() => {
    if (!scannerOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setTorchOn(false);
      setScannerBanner(null);
      setUnknownSku(null);
      setCameraError(null);
      lastScanRef.current = { code: '', time: 0 };
    }
  }, [scannerOpen]);

  // Optional live camera + BarcodeDetector loop when user clicks "Grant Camera Permission"
  useEffect(() => {
    if (!scannerOpen || !cameraGranted) return;

    let cancelled = false;
    let rafId = 0;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Live webcam preview unavailable here. Use Quick Test Barcodes below.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const BarcodeDetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (opts: { formats: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;

        if (BarcodeDetectorCtor) {
          const detector = new BarcodeDetectorCtor({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const tick = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              if (videoRef.current.readyState >= 2) {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0 && codes[0].rawValue) {
                  processScannedCode(codes[0].rawValue);
                }
              }
            } catch {
              // Ignore transient frame decode error
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        }
      } catch {
        setCameraError('Camera access blocked or unavailable. Use Quick Test Barcodes below.');
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen, cameraGranted]);

  const addItemToCart = (item: InventoryItem) => {
    if (item.stock <= 0) {
      setBanner({
        type: 'warning',
        text: `${item.name} is out of stock (0 available).`,
      });
      return {
        status: 'stock_limit' as const,
        message: `${item.name} is out of stock (0 available).`,
      };
    }

    const existing = cart.find((c) => c.itemId === item.id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty + 1 > item.stock) {
      setBanner({
        type: 'warning',
        text: `Only ${item.stock} unit${item.stock === 1 ? '' : 's'} of ${item.name} in stock.`,
      });
      return {
        status: 'stock_limit' as const,
        message: `Only ${item.stock} available for ${item.name}.`,
      };
    }

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.itemId === item.id);
      if (idx >= 0) {
        return prev.map((line, i) =>
          i === idx ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: 1,
        },
      ];
    });

    setBanner({
      type: 'success',
      text: `Added ${item.name} (${formatMoney(item.price)})`,
    });
    return { status: 'added' as const, item };
  };

  const processScannedCode = (rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode || unknownSku) return;

    const now = Date.now();
    const elapsed = now - lastScanRef.current.time;
    if (
      elapsed < 1800 &&
      (lastScanRef.current.code === cleanCode || elapsed < 750)
    ) {
      return;
    }
    lastScanRef.current = { code: cleanCode, time: now };

    if (scannerMode === 'sku') {
      setFormSku(cleanCode);
      setScannerOpen(false);
      if (reopenItemModal) {
        setReopenItemModal(false);
        setItemModalOpen(true);
      }
      return;
    }

    const match = inventory.find(
      (i) => i.sku.trim().toLowerCase() === cleanCode.toLowerCase()
    );
    if (!match) {
      setUnknownSku(cleanCode);
      return;
    }

    const result = addItemToCart(match);
    if (result.status === 'added') {
      setScannerBanner({
        type: 'success',
        title: `Added +1 ${match.name}`,
        subtitle: `SKU ${match.sku} · ${formatMoney(match.price)}`,
      });
    } else if (result.status === 'stock_limit') {
      setScannerBanner({
        type: 'warning',
        title: 'Stock Limit Reached',
        subtitle: result.message,
      });
    }
  };

  const updateCartQty = (itemId: string, delta: number) => {
    const inv = inventory.find((i) => i.id === itemId);
    const line = cart.find((c) => c.itemId === itemId);
    if (!line) return;

    const nextQty = line.quantity + delta;
    if (nextQty <= 0) {
      setCart((prev) => prev.filter((c) => c.itemId !== itemId));
      return;
    }

    const maxStock = inv ? inv.stock : line.quantity;
    if (nextQty > maxStock) {
      setBanner({
        type: 'warning',
        text: `Only ${maxStock} unit${maxStock === 1 ? '' : 's'} available in inventory.`,
      });
      return;
    }

    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, quantity: nextQty } : c))
    );
  };

  const handleCompletePurchase = () => {
    if (cart.length === 0) return;

    for (const line of cart) {
      const inv = inventory.find((i) => i.id === line.itemId);
      if (!inv || line.quantity > inv.stock) {
        setBanner({
          type: 'warning',
          text: `Insufficient stock for ${line.name}.`,
        });
        return;
      }
    }

    setInventory((prev) =>
      prev.map((inv) => {
        const line = cart.find((c) => c.itemId === inv.id);
        if (!line) return inv;
        return {
          ...inv,
          stock: Math.max(0, inv.stock - line.quantity),
          updatedAt: new Date().toISOString(),
        };
      })
    );

    const newTicket: CompletedTicket = {
      id: `ticket-${Date.now()}`,
      ticketNumber: currentTicketLabel,
      createdAt: new Date().toISOString(),
      itemCount: cartSummary.units,
      total: cartSummary.total,
      items: cart.map((c) => ({ ...c })),
    };

    setTickets((prev) => [newTicket, ...prev]);
    setNextTicketNumber((n) => n + 1);
    setCart([]);
    setBanner(null);
    setReceiptIsNew(true);
    setReceiptTicket(newTicket);
  };

  const openAddModal = (prefillSku = '') => {
    setEditingItemId(null);
    setFormName('');
    setFormSku(prefillSku);
    setFormPrice('');
    setFormStock('10');
    setFormError(null);
    setItemModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setFormName(item.name);
    setFormSku(item.sku);
    setFormPrice(String(item.price));
    setFormStock(String(item.stock));
    setFormError(null);
    setItemModalOpen(true);
  };

  const handleSaveItem = () => {
    const cleanName = formName.trim();
    const cleanSku = formSku.trim();
    const parsedPrice = parseFloat(formPrice);
    const parsedStock = parseInt(formStock, 10);

    if (!cleanName) return setFormError('Please enter an Item Name.');
    if (!cleanSku) return setFormError('Please enter or scan a SKU / Barcode.');
    if (Number.isNaN(parsedPrice) || parsedPrice < 0)
      return setFormError('Please enter a valid unit price.');
    if (Number.isNaN(parsedStock) || parsedStock < 0)
      return setFormError('Please enter a valid stock quantity.');

    const duplicate = inventory.find(
      (i) =>
        i.sku.trim().toLowerCase() === cleanSku.toLowerCase() &&
        i.id !== editingItemId
    );
    if (duplicate) {
      return setFormError(`SKU "${cleanSku}" already belongs to "${duplicate.name}".`);
    }

    if (editingItemId) {
      setInventory((prev) =>
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
      const created: InventoryItem = {
        id: `item-${Date.now()}`,
        name: cleanName,
        sku: cleanSku,
        price: parsedPrice,
        stock: parsedStock,
        updatedAt: new Date().toISOString(),
      };
      setInventory((prev) => [created, ...prev]);
    }

    setItemModalOpen(false);
  };

  const handleResetDemo = () => {
    setInventory(
      DEMO_PRODUCTS.map((p) => ({ ...p, updatedAt: new Date().toISOString() }))
    );
    setTickets([]);
    setNextTicketNumber(1001);
    setCart([]);
    setBanner({ type: 'success', text: 'Demo Bebebalm inventory restored.' });
  };

  const handleClearAll = () => {
    setInventory([]);
    setTickets([]);
    setNextTicketNumber(1001);
    setCart([]);
    setBanner(null);
  };

  return (
    <div className="mx-auto w-full max-w-[392px] rounded-[38px] border-[8px] border-[#0E2447] bg-[#8FD3DE] shadow-2xl overflow-hidden relative flex flex-col h-[760px]">
      {/* Android Status Bar Simulation */}
      <div className="bg-[#8FD3DE] px-6 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-bold text-[#0E2447] shrink-0">
        <span className="tabular-nums">9:41</span>
        <div className="w-16 h-3.5 rounded-full bg-[#0E2447]/15" />
        <span>Expo Go</span>
      </div>

      {/* Bebebalm Brand Header */}
      <div className="bg-[#8FD3DE] px-4 pt-1 pb-3.5 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#0E2447] leading-tight tracking-tight">
            Bebebalm
          </h2>
          <p className="text-[11px] font-semibold text-[#0E2447]/80">
            Natural Skin Rescue · Mobile POS
          </p>
        </div>
        <div className="bg-white px-3 py-1.5 rounded-full shadow-sm">
          <span className="text-xs font-extrabold text-[#0E2447] tabular-nums">
            {activeTab === 'pos'
              ? currentTicketLabel
              : activeTab === 'inventory'
              ? `${inventory.length} SKUs`
              : `${tickets.length} Tickets`}
          </span>
        </div>
      </div>

      {/* Main Content Surface */}
      <div className="flex-1 bg-[#F2FAFC] rounded-t-[24px] overflow-hidden flex flex-col min-h-0">
        {/* TAB 1: POS / CHECKOUT */}
        {activeTab === 'pos' && (
          <div className="flex-1 flex flex-col p-3.5 min-h-0">
            <div className="flex gap-2.5 mb-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScannerMode('pos');
                  setReopenItemModal(false);
                  setScannerOpen(true);
                }}
                className="flex-1 min-h-[48px] rounded-2xl bg-[#0E2447] hover:bg-[#081730] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
              >
                <Barcode className="w-5 h-5" />
                <span>Scan Barcode</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualSearch('');
                  setManualPickerOpen(true);
                }}
                className="min-h-[48px] px-4 rounded-2xl bg-white border border-[#CFE6EC] hover:bg-[#E6F4F7] text-[#0E2447] font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Browse</span>
              </button>
            </div>

            {banner && (
              <div
                className={`mb-2.5 px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-semibold shrink-0 ${
                  banner.type === 'warning'
                    ? 'bg-[#FEF6D8] border-[#F3DF93] text-[#8A6200]'
                    : 'bg-[#E6F5EA] border-[#BFE4CA] text-[#266337]'
                }`}
              >
                {banner.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span className="flex-1 truncate">{banner.text}</span>
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  className="p-0.5 cursor-pointer"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-sm font-extrabold text-[#0E2447]">
                Active Ticket · {currentTicketLabel}
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setBanner(null);
                  }}
                  className="text-xs font-bold text-[#C62828] cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-0">
              {cart.length === 0 ? (
                <div className="h-full min-h-[220px] bg-white rounded-2xl border border-[#CFE6EC] p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-[#E6F4F7] flex items-center justify-center mb-3">
                    <ShoppingCart className="w-7 h-7 text-[#4FA8B8]" />
                  </div>
                  <p className="text-base font-extrabold text-[#0E2447]">
                    Ticket Ready
                  </p>
                  <p className="text-xs text-[#425E75] mt-1 leading-relaxed max-w-[230px]">
                    Tap <strong>Scan Barcode</strong> to ring up products, or tap{' '}
                    <strong>Browse</strong> to pick items manually.
                  </p>
                </div>
              ) : (
                cart.map((line) => {
                  const inv = inventory.find((i) => i.id === line.itemId);
                  const available = inv ? inv.stock : line.quantity;
                  return (
                    <div
                      key={line.itemId}
                      className="bg-white rounded-2xl border border-[#CFE6EC] p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0E2447] leading-snug">
                            {line.name}
                          </p>
                          <p className="text-[11px] text-[#425E75] mt-0.5 tabular-nums">
                            SKU {line.sku} · {formatMoney(line.price)} each ·{' '}
                            {available} in stock
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) =>
                              prev.filter((c) => c.itemId !== line.itemId)
                            )
                          }
                          className="w-8 h-8 rounded-lg bg-[#FDECEC] text-[#C62828] flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E5F1F4]">
                        <div className="flex items-center gap-1.5 bg-[#E6F4F7] p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => updateCartQty(line.itemId, -1)}
                            className="w-8 h-8 rounded-lg bg-white text-[#0E2447] flex items-center justify-center cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-extrabold text-[#0E2447] tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(line.itemId, 1)}
                            className="w-8 h-8 rounded-lg bg-white text-[#0E2447] flex items-center justify-center cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-base font-extrabold text-[#0E2447] tabular-nums">
                          {formatMoney(line.price * line.quantity)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Checkout Footer */}
            <div className="mt-2.5 bg-white rounded-2xl border border-[#CFE6EC] p-3 flex items-center justify-between gap-3 shadow-sm shrink-0">
              <div>
                <p className="text-[11px] font-semibold text-[#6D889D]">
                  Total ({cartSummary.units}{' '}
                  {cartSummary.units === 1 ? 'item' : 'items'})
                </p>
                <p className="text-xl font-extrabold text-[#0E2447] tabular-nums">
                  {formatMoney(cartSummary.total)}
                </p>
              </div>
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCompletePurchase}
                className={`min-h-[46px] px-4 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  cart.length === 0
                    ? 'bg-[#BDD8DF] cursor-not-allowed'
                    : 'bg-[#4FA8B8] hover:bg-[#3f91a0] cursor-pointer'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Purchase</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY SETUP */}
        {activeTab === 'inventory' && (
          <div className="flex-1 flex flex-col p-3.5 min-h-0">
            <div className="flex gap-2 mb-2 shrink-0">
              <div className="flex-1 min-h-[44px] bg-white rounded-xl border border-[#CFE6EC] px-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-[#6D889D] shrink-0" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search product or SKU..."
                  className="w-full text-xs text-[#0E2447] bg-transparent outline-none"
                />
                {inventorySearch && (
                  <button
                    type="button"
                    onClick={() => setInventorySearch('')}
                    className="text-[#6D889D] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => openAddModal('')}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#0E2447] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] mb-2 px-0.5 shrink-0">
              <span className="font-semibold text-[#6D889D] tabular-nums">
                {filteredInventory.length} product
                {filteredInventory.length === 1 ? '' : 's'} shown
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="font-bold text-[#4FA8B8] cursor-pointer"
                >
                  Reset Demo
                </button>
                <span className="text-[#6D889D]">·</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="font-bold text-[#C62828] cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-0">
              {filteredInventory.length === 0 ? (
                <div className="h-full min-h-[220px] bg-white rounded-2xl border border-[#CFE6EC] p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-[#E6F4F7] flex items-center justify-center mb-3">
                    <Package className="w-7 h-7 text-[#4FA8B8]" />
                  </div>
                  <p className="text-base font-extrabold text-[#0E2447]">
                    No Products Found
                  </p>
                  <p className="text-xs text-[#425E75] mt-1">
                    Tap <strong>+ Add</strong> to register a SKU, or tap{' '}
                    <strong>Reset Demo</strong> to restore starter items.
                  </p>
                </div>
              ) : (
                filteredInventory.map((item) => {
                  const badge = getStockBadge(item.stock);
                  const BadgeIcon = badge.Icon;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-[#CFE6EC] p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0E2447] leading-snug">
                            {item.name}
                          </p>
                          <p className="text-[11px] font-mono text-[#425E75] mt-0.5">
                            SKU: {item.sku}
                          </p>
                        </div>
                        <span className="text-sm font-extrabold text-[#0E2447] tabular-nums shrink-0">
                          {formatMoney(item.price)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#E5F1F4]">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border tabular-nums"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            borderColor: badge.border,
                          }}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setInventory((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? { ...i, stock: Math.max(0, i.stock - 1) }
                                    : i
                                )
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-[#E6F4F7] text-[#0E2447] flex items-center justify-center cursor-pointer"
                            aria-label="Decrease stock"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setInventory((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? { ...i, stock: i.stock + 1 }
                                    : i
                                )
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-[#E6F4F7] text-[#0E2447] flex items-center justify-center cursor-pointer"
                            aria-label="Increase stock"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="w-8 h-8 rounded-lg bg-[#FEF7D4] text-[#0E2447] flex items-center justify-center cursor-pointer"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInventory((prev) =>
                                prev.filter((i) => i.id !== item.id)
                              );
                              setCart((prev) =>
                                prev.filter((c) => c.itemId !== item.id)
                              );
                            }}
                            className="w-8 h-8 rounded-lg bg-[#FDECEC] text-[#C62828] flex items-center justify-center cursor-pointer"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TICKETS (SALES HISTORY) */}
        {activeTab === 'tickets' && (
          <div className="flex-1 flex flex-col p-3.5 min-h-0">
            <div className="flex items-center justify-between mb-2.5 shrink-0">
              <span className="text-sm font-extrabold text-[#0E2447]">
                Completed Purchase Tickets
              </span>
              <span className="text-xs font-semibold text-[#6D889D] tabular-nums">
                {tickets.length} {tickets.length === 1 ? 'sale' : 'sales'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-0">
              {tickets.length === 0 ? (
                <div className="h-full min-h-[240px] bg-white rounded-2xl border border-[#CFE6EC] p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-[#E6F4F7] flex items-center justify-center mb-3">
                    <Receipt className="w-7 h-7 text-[#4FA8B8]" />
                  </div>
                  <p className="text-base font-extrabold text-[#0E2447]">
                    No Completed Tickets Yet
                  </p>
                  <p className="text-xs text-[#425E75] mt-1 leading-relaxed max-w-[230px]">
                    Completed sales from the POS tab appear here with full
                    itemized receipts.
                  </p>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const dateLabel = new Date(ticket.createdAt).toLocaleString(
                    [],
                    {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => {
                        setReceiptIsNew(false);
                        setReceiptTicket(ticket);
                      }}
                      className="w-full text-left bg-white rounded-2xl border border-[#CFE6EC] p-3.5 flex items-center gap-3 shadow-sm hover:bg-[#F8FCFD] transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-[#0E2447]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-[#0E2447]">
                          {ticket.ticketNumber}
                        </p>
                        <p className="text-[11px] text-[#425E75] truncate tabular-nums">
                          {dateLabel} · {ticket.itemCount}{' '}
                          {ticket.itemCount === 1 ? 'unit' : 'units'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-extrabold text-[#0E2447] tabular-nums">
                          {formatMoney(ticket.total)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#6D889D]" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="bg-white border-t border-[#CFE6EC] px-2 py-1.5 grid grid-cols-3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('pos')}
          className="min-h-[48px] flex flex-col items-center justify-center relative cursor-pointer"
        >
          <div className="relative">
            <ShoppingCart
              className={`w-5 h-5 ${
                activeTab === 'pos' ? 'text-[#0E2447]' : 'text-[#6D889D]'
              }`}
            />
            {cartSummary.units > 0 && (
              <span className="absolute -top-1.5 -right-3 min-w-[17px] h-[17px] rounded-full bg-[#4FA8B8] text-white text-[10px] font-extrabold flex items-center justify-center px-1 tabular-nums">
                {cartSummary.units}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] mt-0.5 ${
              activeTab === 'pos'
                ? 'font-extrabold text-[#0E2447]'
                : 'font-semibold text-[#6D889D]'
            }`}
          >
            POS
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className="min-h-[48px] flex flex-col items-center justify-center cursor-pointer"
        >
          <Package
            className={`w-5 h-5 ${
              activeTab === 'inventory' ? 'text-[#0E2447]' : 'text-[#6D889D]'
            }`}
          />
          <span
            className={`text-[11px] mt-0.5 ${
              activeTab === 'inventory'
                ? 'font-extrabold text-[#0E2447]'
                : 'font-semibold text-[#6D889D]'
            }`}
          >
            Inventory
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className="min-h-[48px] flex flex-col items-center justify-center cursor-pointer"
        >
          <Receipt
            className={`w-5 h-5 ${
              activeTab === 'tickets' ? 'text-[#0E2447]' : 'text-[#6D889D]'
            }`}
          />
          <span
            className={`text-[11px] mt-0.5 ${
              activeTab === 'tickets'
                ? 'font-extrabold text-[#0E2447]'
                : 'font-semibold text-[#6D889D]'
            }`}
          >
            Tickets
          </span>
        </button>
      </div>

      {/* Manual Item Picker Overlay */}
      {manualPickerOpen && (
        <div className="absolute inset-0 z-30 bg-[#0E2447]/55 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-4 max-h-[80%] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-[#0E2447]">
                Browse Products
              </h3>
              <button
                type="button"
                onClick={() => setManualPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-[#E6F4F7] flex items-center justify-center text-[#0E2447] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="min-h-[42px] bg-[#F2FAFC] rounded-xl border border-[#CFE6EC] px-3 flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-[#6D889D]" />
              <input
                type="text"
                value={manualSearch}
                onChange={(e) => setManualSearch(e.target.value)}
                placeholder="Search name or SKU..."
                className="w-full text-xs text-[#0E2447] bg-transparent outline-none"
              />
            </div>
            <div className="overflow-y-auto space-y-2">
              {filteredManualItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const res = addItemToCart(item);
                    if (res.status === 'added') setManualPickerOpen(false);
                  }}
                  className="w-full text-left py-2.5 border-b border-[#E5F1F4] flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0E2447] truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-[#425E75] tabular-nums">
                      SKU {item.sku} · {item.stock} available
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-extrabold text-[#0E2447] tabular-nums">
                      {formatMoney(item.price)}
                    </span>
                    <Plus
                      className={`w-4 h-4 ${
                        item.stock > 0 ? 'text-[#4FA8B8]' : 'text-[#6D889D]'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Form Overlay */}
      {itemModalOpen && (
        <div className="absolute inset-0 z-30 bg-[#0E2447]/55 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-4 max-h-[88%] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-[#0E2447]">
                {editingItemId ? 'Edit Product' : 'Add Product'}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#E6F4F7] flex items-center justify-center text-[#0E2447] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-[#FDECEC] text-[#B42318] text-xs font-semibold">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#0E2447] mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Bebebalm Skin Rescue Tin"
                  className="w-full min-h-[44px] rounded-xl bg-[#F2FAFC] border border-[#CFE6EC] px-3 text-xs text-[#0E2447] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0E2447] mb-1">
                  SKU / Barcode
                </label>
                <div className="flex items-center rounded-xl bg-[#F2FAFC] border border-[#CFE6EC] pl-3 pr-1.5 min-h-[44px]">
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="Enter or scan barcode"
                    className="flex-1 text-xs font-mono text-[#0E2447] bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setItemModalOpen(false);
                      setReopenItemModal(true);
                      setScannerMode('sku');
                      setScannerOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0E2447] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan SKU</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#0E2447] mb-1">
                    Unit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="14.50"
                    className="w-full min-h-[44px] rounded-xl bg-[#F2FAFC] border border-[#CFE6EC] px-3 text-xs text-[#0E2447] outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0E2447] mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="10"
                    className="w-full min-h-[44px] rounded-xl bg-[#F2FAFC] border border-[#CFE6EC] px-3 text-xs text-[#0E2447] outline-none tabular-nums"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveItem}
                className="w-full min-h-[46px] rounded-xl bg-[#0E2447] text-white text-sm font-bold cursor-pointer mt-2"
              >
                {editingItemId ? 'Save Changes' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Overlay */}
      {scannerOpen && (
        <div className="absolute inset-0 z-40 bg-[#071426] flex flex-col">
          {!cameraGranted ? (
            <div className="flex-1 bg-[#F2FAFC] p-5 flex items-center justify-center">
              <div className="bg-white rounded-3xl p-5 border border-[#CFE6EC] text-center shadow-lg">
                <div className="w-14 h-14 rounded-full bg-[#E6F4F7] mx-auto mb-3 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-[#0E2447]" />
                </div>
                <h4 className="text-base font-extrabold text-[#0E2447]">
                  Camera Permission Needed
                </h4>
                <p className="text-xs text-[#425E75] mt-1.5 leading-relaxed">
                  Allow camera access to scan EAN-13, UPC, Code 128, and QR
                  barcodes directly into your ticket or inventory.
                </p>
                <button
                  type="button"
                  onClick={() => setCameraGranted(true)}
                  className="mt-4 w-full min-h-[46px] rounded-xl bg-[#0E2447] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Grant Camera Permission</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannerOpen(false);
                    if (reopenItemModal) {
                      setReopenItemModal(false);
                      setItemModalOpen(true);
                    }
                  }}
                  className="mt-2 w-full min-h-[40px] text-xs font-semibold text-[#425E75] cursor-pointer"
                >
                  Close Scanner
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative flex flex-col justify-between p-4 text-white overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-[#071426]/45" />

              {/* Top Controls */}
              <div className="relative z-10 flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setScannerOpen(false);
                    if (reopenItemModal) {
                      setReopenItemModal(false);
                      setItemModalOpen(true);
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-[#0E2447]/80 border border-white/20 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <span className="px-3 py-1.5 rounded-full bg-[#0E2447]/85 border border-[#8FD3DE]/40 text-xs font-bold">
                  {scannerMode === 'sku'
                    ? 'Scan Product SKU'
                    : 'POS Barcode Scanner'}
                </span>

                <button
                  type="button"
                  onClick={() => setTorchOn((v) => !v)}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center cursor-pointer ${
                    torchOn
                      ? 'bg-[#F2DA4E] text-[#0E2447] border-[#F2DA4E]'
                      : 'bg-[#0E2447]/80 text-white border-white/20'
                  }`}
                  aria-label="Toggle flashlight"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              </div>

              {/* Framing Guide */}
              <div className="relative z-10 flex flex-col items-center my-2">
                <div className="w-60 h-32 rounded-xl border-2 border-[#8FD3DE] relative flex items-center justify-center bg-white/5">
                  <div className="w-[84%] h-[2px] bg-[#F2DA4E]" />
                </div>
                <p className="mt-2 text-[11px] font-semibold bg-[#0E2447]/75 px-3 py-1 rounded-full">
                  {cameraError || 'Align barcode inside the frame'}
                </p>
              </div>

              {/* Interactive Simulated Barcode Triggers for Preview Testing */}
              <div className="relative z-10 space-y-2">
                {scannerBanner && !unknownSku && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs ${
                      scannerBanner.type === 'warning'
                        ? 'bg-[#FEF6D8] border-[#F3DF93] text-[#8A6200]'
                        : 'bg-[#E6F5EA] border-[#BFE4CA] text-[#266337]'
                    }`}
                  >
                    <p className="font-bold">{scannerBanner.title}</p>
                    <p className="text-[11px]">{scannerBanner.subtitle}</p>
                  </div>
                )}

                {unknownSku ? (
                  <div className="bg-white text-[#0E2447] rounded-2xl p-3.5 shadow-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <HelpCircle className="w-5 h-5 text-[#4FA8B8]" />
                      <div>
                        <p className="text-xs font-extrabold">
                          Barcode Not in Inventory
                        </p>
                        <p className="text-[11px] font-mono text-[#4FA8B8]">
                          SKU: {unknownSku}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUnknownSku(null);
                          lastScanRef.current = { code: '', time: 0 };
                        }}
                        className="px-3 min-h-[38px] rounded-lg bg-[#E6F4F7] text-[#0E2447] text-xs font-bold cursor-pointer"
                      >
                        Scan Again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const code = unknownSku;
                          setUnknownSku(null);
                          setScannerOpen(false);
                          setReopenItemModal(false);
                          setActiveTab('inventory');
                          openAddModal(code);
                        }}
                        className="flex-1 min-h-[38px] rounded-lg bg-[#0E2447] text-white text-xs font-bold cursor-pointer"
                      >
                        Add This Item to Inventory
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0E2447]/90 border border-white/15 rounded-2xl p-2.5">
                    <p className="text-[10px] font-bold text-[#8FD3DE] mb-1.5">
                      Quick Test Scans (Preview Simulator)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {inventory.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => processScannedCode(item.sku)}
                          className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-mono text-white cursor-pointer"
                        >
                          {item.sku.slice(-5)} · {item.name.split(' ')[1]}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => processScannedCode('8909999000777')}
                        className="px-2 py-1 rounded-lg bg-[#F2DA4E]/90 text-[#0E2447] text-[10px] font-bold cursor-pointer"
                      >
                        Unknown SKU
                      </button>
                    </div>
                  </div>
                )}

                {!unknownSku && (
                  <button
                    type="button"
                    onClick={() => {
                      setScannerOpen(false);
                      if (reopenItemModal) {
                        setReopenItemModal(false);
                        setItemModalOpen(true);
                      }
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-white text-[#0E2447] text-xs font-extrabold cursor-pointer"
                  >
                    {scannerMode === 'sku' ? 'Cancel Scan' : 'Done Scanning'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ticket Receipt Modal */}
      {receiptTicket && (
        <div className="absolute inset-0 z-40 bg-[#0E2447]/55 flex items-center justify-center p-4">
          <div className="w-full bg-white rounded-3xl p-5 shadow-2xl max-h-[85%] flex flex-col">
            <div className="text-center mb-3">
              <div
                className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  receiptIsNew ? 'bg-[#E6F5EA]' : 'bg-[#E6F4F7]'
                }`}
              >
                {receiptIsNew ? (
                  <CheckCircle2 className="w-6 h-6 text-[#266337]" />
                ) : (
                  <Receipt className="w-6 h-6 text-[#0E2447]" />
                )}
              </div>
              <h3 className="text-lg font-extrabold text-[#0E2447]">
                {receiptIsNew
                  ? 'Purchase Complete!'
                  : `Ticket ${receiptTicket.ticketNumber}`}
              </h3>
              <p className="text-xs text-[#425E75]">
                {receiptIsNew
                  ? `${receiptTicket.ticketNumber} saved & inventory updated`
                  : new Date(receiptTicket.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="border-y border-[#E5F1F4] py-3 space-y-2 overflow-y-auto max-h-[210px]">
              {receiptTicket.items.map((line) => (
                <div
                  key={line.itemId}
                  className="flex items-start justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#0E2447]">{line.name}</p>
                    <p className="text-[11px] text-[#425E75] tabular-nums">
                      SKU {line.sku} · {line.quantity} ×{' '}
                      {formatMoney(line.price)}
                    </p>
                  </div>
                  <span className="font-bold text-[#0E2447] tabular-nums shrink-0">
                    {formatMoney(line.quantity * line.price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-bold text-[#0E2447]">Total Paid</p>
                <p className="text-[11px] text-[#6D889D] tabular-nums">
                  {receiptTicket.itemCount}{' '}
                  {receiptTicket.itemCount === 1 ? 'unit' : 'units'}
                </p>
              </div>
              <span className="text-xl font-extrabold text-[#0E2447] tabular-nums">
                {formatMoney(receiptTicket.total)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setReceiptTicket(null)}
              className="w-full min-h-[46px] rounded-xl bg-[#0E2447] text-white text-xs font-bold cursor-pointer"
            >
              {receiptIsNew ? 'Start New Ticket' : 'Close Receipt'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
