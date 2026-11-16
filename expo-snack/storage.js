import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  INITIALIZED: '@bebebalm_pos_initialized_v1',
  INVENTORY: '@bebebalm_pos_inventory_v1',
  TICKETS: '@bebebalm_pos_tickets_v1',
  NEXT_TICKET_NUM: '@bebebalm_pos_next_ticket_v1',
};

export const DEMO_INVENTORY = [
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

export async function loadInitialData() {
  try {
    const initialized = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED);

    if (!initialized) {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.INITIALIZED, 'true'],
        [STORAGE_KEYS.INVENTORY, JSON.stringify(DEMO_INVENTORY)],
        [STORAGE_KEYS.TICKETS, JSON.stringify([])],
        [STORAGE_KEYS.NEXT_TICKET_NUM, '1001'],
      ]);
      return {
        inventory: DEMO_INVENTORY,
        tickets: [],
        nextTicketNumber: 1001,
      };
    }

    const [invRaw, ticketsRaw, nextTicketRaw] = await AsyncStorage.multiGet([
      STORAGE_KEYS.INVENTORY,
      STORAGE_KEYS.TICKETS,
      STORAGE_KEYS.NEXT_TICKET_NUM,
    ]);

    const inventory = invRaw[1] ? JSON.parse(invRaw[1]) : [];
    const tickets = ticketsRaw[1] ? JSON.parse(ticketsRaw[1]) : [];
    const nextTicketNumber = nextTicketRaw[1] ? parseInt(nextTicketRaw[1], 10) || 1001 : 1001;

    return { inventory, tickets, nextTicketNumber };
  } catch (err) {
    console.warn('AsyncStorage load error:', err);
    return {
      inventory: DEMO_INVENTORY,
      tickets: [],
      nextTicketNumber: 1001,
    };
  }
}

export async function saveInventory(inventory) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  } catch (err) {
    console.warn('AsyncStorage saveInventory error:', err);
  }
}

export async function saveTickets(tickets, nextTicketNumber) {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.TICKETS, JSON.stringify(tickets)],
      [STORAGE_KEYS.NEXT_TICKET_NUM, String(nextTicketNumber)],
    ]);
  } catch (err) {
    console.warn('AsyncStorage saveTickets error:', err);
  }
}

export async function resetToDemoData() {
  const freshDemo = DEMO_INVENTORY.map((item) => ({
    ...item,
    updatedAt: new Date().toISOString(),
  }));
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.INITIALIZED, 'true'],
    [STORAGE_KEYS.INVENTORY, JSON.stringify(freshDemo)],
    [STORAGE_KEYS.TICKETS, JSON.stringify([])],
    [STORAGE_KEYS.NEXT_TICKET_NUM, '1001'],
  ]);
  return {
    inventory: freshDemo,
    tickets: [],
    nextTicketNumber: 1001,
  };
}

export async function clearAllData() {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.INITIALIZED, 'true'],
    [STORAGE_KEYS.INVENTORY, JSON.stringify([])],
    [STORAGE_KEYS.TICKETS, JSON.stringify([])],
    [STORAGE_KEYS.NEXT_TICKET_NUM, '1001'],
  ]);
  return {
    inventory: [],
    tickets: [],
    nextTicketNumber: 1001,
  };
}
