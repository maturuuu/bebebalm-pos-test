// Centralized Bebebalm Theme extracted from sample.jpg
export const theme = {
  colors: {
    // Primary & Brand Identity (Deep Navy + Bebebalm Aqua)
    primary: '#0E2447',        // Deep Bebebalm wordmark navy
    primaryPressed: '#081730',
    secondary: '#4FA8B8',      // Rich coastal teal accent
    brandTint: '#8FD3DE',      // Signature Bebebalm pastel aqua backdrop
    skyAccent: '#A6D4EE',      // Round balm tin soft sky blue

    // Surfaces & Neutrals
    background: '#F2FAFC',     // Soft aqua-tinted neutral canvas
    surface: '#FFFFFF',        // Crisp white card surface
    surfaceAlt: '#E6F4F7',     // Soft aqua surface for inputs & rows
    border: '#CFE6EC',         // Gentle hairline border
    divider: '#E5F1F4',

    // Typography (WCAG AA high-contrast)
    textPrimary: '#0E2447',    // Deep navy primary text
    textSecondary: '#425E75',  // Muted slate-navy labels
    textMuted: '#6D889D',      // Helper captions & timestamps
    textOnPrimary: '#FFFFFF',

    // Botanical & Balm Accents (from sample.jpg)
    accentYellow: '#F2DA4E',   // ByeSpots sunny yellow
    accentYellowSoft: '#FEF7D4',
    accentLavender: '#9B6FD6', // Botanical lavender floral accent
    accentLavenderSoft: '#F3ECFC',
    accentSage: '#789854',     // Fuzzy coconut plush sage green

    // Color-coded Stock Status Pills
    stockInBg: '#E6F5EA',
    stockInText: '#266337',
    stockInBorder: '#BFE4CA',

    stockLowBg: '#FEF6D8',
    stockLowText: '#8A6200',
    stockLowBorder: '#F3DF93',

    stockOutBg: '#FDECEC',
    stockOutText: '#B42318',
    stockOutBorder: '#F9C5C3',

    // Semantic Alerts
    success: '#266337',
    danger: '#C62828',
    dangerSoft: '#FDECEC',
    overlay: 'rgba(14, 36, 71, 0.55)',
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
  },
  shadows: {
    card: {
      shadowColor: '#0E2447',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    floating: {
      shadowColor: '#0E2447',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};

export function getStockStatus(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) {
    return {
      label: 'Out of Stock',
      bg: theme.colors.stockOutBg,
      text: theme.colors.stockOutText,
      border: theme.colors.stockOutBorder,
      icon: 'close-circle',
    };
  }
  if (qty <= 5) {
    return {
      label: 'Low Stock',
      bg: theme.colors.stockLowBg,
      text: theme.colors.stockLowText,
      border: theme.colors.stockLowBorder,
      icon: 'alert-circle',
    };
  }
  return {
    label: 'In Stock',
    bg: theme.colors.stockInBg,
    text: theme.colors.stockInText,
    border: theme.colors.stockInBorder,
    icon: 'checkmark-circle',
  };
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `$${num.toFixed(2)}`;
}
