export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  updatedAt: string;
}

export interface CartLine {
  itemId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export interface CompletedTicket {
  id: string;
  ticketNumber: string;
  createdAt: string;
  itemCount: number;
  total: number;
  items: CartLine[];
}

export type TabKey = 'pos' | 'inventory' | 'tickets';
