import { useState } from 'react';
import { Check, Copy, Download, Palette } from 'lucide-react';
import appJsRaw from '../../expo-snack/App.js?raw';
import themeJsRaw from '../../expo-snack/theme.js?raw';
import storageJsRaw from '../../expo-snack/storage.js?raw';
import scannerModalRaw from '../../expo-snack/components/ScannerModal.js?raw';
import receiptModalRaw from '../../expo-snack/components/TicketReceiptModal.js?raw';
import packageJsonRaw from '../../expo-snack/package.json?raw';

export interface ExpoFileSpec {
  id: string;
  filename: string;
  path: string;
  description: string;
  content: string;
}

export const EXPO_FILES: ExpoFileSpec[] = [
  {
    id: 'app',
    filename: 'App.js',
    path: 'App.js',
    description: 'Main 3-tab POS, Inventory Setup, and Sales History app',
    content: appJsRaw,
  },
  {
    id: 'theme',
    filename: 'theme.js',
    path: 'theme.js',
    description: 'Centralized Bebebalm theme palette extracted from sample.jpg',
    content: themeJsRaw,
  },
  {
    id: 'storage',
    filename: 'storage.js',
    path: 'storage.js',
    description: 'AsyncStorage persistence and 5 starter demo products',
    content: storageJsRaw,
  },
  {
    id: 'scanner',
    filename: 'ScannerModal.js',
    path: 'components/ScannerModal.js',
    description: 'expo-camera CameraView barcode scanner with torch & debounce',
    content: scannerModalRaw,
  },
  {
    id: 'receipt',
    filename: 'TicketReceiptModal.js',
    path: 'components/TicketReceiptModal.js',
    description: 'Purchase confirmation & ticket receipt drill-down modal',
    content: receiptModalRaw,
  },
  {
    id: 'pkg',
    filename: 'package.json',
    path: 'package.json',
    description: 'Expo Go & Expo Snack compatible dependencies',
    content: packageJsonRaw,
  },
];

const PALETTE_SWATCHES = [
  { name: 'Primary Navy', hex: '#0E2447', role: 'Wordmark, CTAs, high-contrast ink' },
  { name: 'Coastal Teal', hex: '#4FA8B8', role: 'Checkout actions & active accents' },
  { name: 'Brand Aqua', hex: '#8FD3DE', role: 'Header backdrop & scanner framing' },
  { name: 'Canvas Tint', hex: '#F2FAFC', role: 'Soft mobile screen background' },
  { name: 'Botanical Sage', hex: '#789854', role: 'In-stock status & coconut motif' },
  { name: 'Balm Yellow', hex: '#F2DA4E', role: 'Torch active & low-stock highlight' },
];

export default function ExpoCodePanel() {
  const [selectedFileId, setSelectedFileId] = useState<string>('app');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile =
    EXPO_FILES.find((f) => f.id === selectedFileId) || EXPO_FILES[0];

  const handleCopy = async (file: ExpoFileSpec) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownload = (file: ExpoFileSpec) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Brand Palette & Reference Section */}
      <section
        id="brand-palette"
        className="bg-white rounded-2xl border border-[#CFE6EC] p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E5F1F4]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#425E75]">
              <Palette className="w-4 h-4 text-[#4FA8B8]" />
              <span>Theme Extraction</span>
              <span aria-hidden="true">·</span>
              <span>sample.jpg</span>
            </div>
            <h2 className="text-xl font-bold text-[#0E2447] mt-1">
              Bebebalm Visual System
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/sample_91fc6344.jpg"
              alt="Bebebalm Natural Skin Rescue reference image"
              referrerPolicy="no-referrer"
              className="w-28 h-14 object-cover rounded-xl border border-[#CFE6EC]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-5">
          {PALETTE_SWATCHES.map((swatch) => (
            <div
              key={swatch.hex}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F2FAFC] border border-[#E5F1F4]"
            >
              <span
                className="w-9 h-9 rounded-lg shrink-0 border border-black/10"
                style={{ backgroundColor: swatch.hex }}
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0E2447] truncate">
                  {swatch.name}
                </p>
                <p className="text-[11px] font-mono text-[#425E75]">
                  {swatch.hex}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Expo Snack Code Browser */}
      <section
        id="expo-code"
        className="bg-white rounded-2xl border border-[#CFE6EC] overflow-hidden"
      >
        <div className="p-5 border-b border-[#E5F1F4] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E2447]">
              Expo Snack Ready Source Files
            </h2>
            <p className="text-xs text-[#425E75] mt-0.5">
              Uses <code className="font-mono">expo-camera</code> CameraView,{' '}
              <code className="font-mono">AsyncStorage</code>,{' '}
              <code className="font-mono">expo-haptics</code>, and{' '}
              <code className="font-mono">@expo/vector-icons</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload(activeFile)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#CFE6EC] bg-[#F2FAFC] text-xs font-semibold text-[#0E2447] hover:bg-[#E6F4F7] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {activeFile.filename}</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(activeFile)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E2447] text-white text-xs font-semibold hover:bg-[#081730] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {copiedId === activeFile.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#F2DA4E]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy {activeFile.filename}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* File Selector Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F2FAFC] border-b border-[#E5F1F4] overflow-x-auto">
          {EXPO_FILES.map((file) => {
            const isActive = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedFileId(file.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#0E2447] text-white'
                    : 'text-[#425E75] hover:bg-white hover:text-[#0E2447]'
                }`}
              >
                {file.path}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-2.5 bg-white border-b border-[#E5F1F4] flex items-center justify-between text-xs text-[#425E75]">
          <span>{activeFile.description}</span>
          <span className="font-mono tabular-nums">
            {activeFile.content.split('\n').length} lines
          </span>
        </div>

        <div className="bg-[#081730] text-[#E6F4F7] p-5 overflow-auto max-h-[480px]">
          <pre className="text-xs leading-relaxed font-mono whitespace-pre">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </section>

      {/* Expo Go Android Run Guide */}
      <section
        id="android-setup"
        className="bg-white rounded-2xl border border-[#CFE6EC] p-6"
      >
        <h3 className="text-base font-bold text-[#0E2447] mb-3">
          Running in Expo Snack &amp; Expo Go on Android
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-[#425E75]">
          <div className="p-4 rounded-xl bg-[#F2FAFC] border border-[#E5F1F4]">
            <p className="text-xs font-bold text-[#0E2447] mb-1">
              01. Create Snack Files
            </p>
            <p className="text-xs leading-relaxed">
              Copy <code className="font-mono text-[#0E2447]">App.js</code>,{' '}
              <code className="font-mono text-[#0E2447]">theme.js</code>,{' '}
              <code className="font-mono text-[#0E2447]">storage.js</code>, and
              the <code className="font-mono text-[#0E2447]">components/</code>{' '}
              folder into a new Expo Snack.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F2FAFC] border border-[#E5F1F4]">
            <p className="text-xs font-bold text-[#0E2447] mb-1">
              02. Sync Dependencies
            </p>
            <p className="text-xs leading-relaxed">
              Paste the <code className="font-mono text-[#0E2447]">package.json</code>{' '}
              dependencies (<code className="font-mono text-[#0E2447]">expo-camera</code>,{' '}
              <code className="font-mono text-[#0E2447]">async-storage</code>,{' '}
              <code className="font-mono text-[#0E2447]">expo-haptics</code>).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F2FAFC] border border-[#E5F1F4]">
            <p className="text-xs font-bold text-[#0E2447] mb-1">
              03. Scan QR in Expo Go
            </p>
            <p className="text-xs leading-relaxed">
              Open Expo Go on Android, scan the Snack QR code, and tap{' '}
              <strong>Grant Camera Permission</strong> to test live EAN-13/UPC
              barcode scanning.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
