import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import appJsRaw from '../expo-snack/App.js?raw';
import MobilePosSimulator from './components/MobilePosSimulator';
import ExpoCodePanel from './components/ExpoCodePanel';

export default function App() {
  const [copiedApp, setCopiedApp] = useState(false);

  const handleQuickCopyApp = async () => {
    try {
      await navigator.clipboard.writeText(appJsRaw);
      setCopiedApp(true);
      setTimeout(() => setCopiedApp(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="min-h-screen bg-[#F2FAFC] text-[#0E2447]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#F2FAFC]/90 backdrop-blur-md border-b border-[#CFE6EC]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#interactive-preview"
            className="text-lg font-extrabold tracking-tight text-[#0E2447] whitespace-nowrap shrink-0"
          >
            Bebebalm POS
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#425E75]">
            <a
              href="#interactive-preview"
              className="hover:text-[#0E2447] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Interactive Preview
            </a>
            <a
              href="#brand-palette"
              className="hover:text-[#0E2447] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Brand Palette
            </a>
            <a
              href="#expo-code"
              className="hover:text-[#0E2447] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Expo Snack Code
            </a>
            <a
              href="#android-setup"
              className="hover:text-[#0E2447] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Android Setup
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleQuickCopyApp}
              className="px-4 py-2 min-h-[40px] rounded-xl bg-[#0E2447] hover:bg-[#081730] text-white text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedApp ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#F2DA4E]" />
                  <span>Copied App.js</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy App.js</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold text-[#425E75] mb-2">
            React Native · Expo Go Android · Barcode Checkout &amp; Local Inventory
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0E2447] tracking-tight text-balance">
            Mobile Point-of-Sale &amp; Inventory Studio
          </h1>
          <p className="text-sm sm:text-base text-[#425E75] mt-2 leading-relaxed">
            Test the Bebebalm POS flow interactively in the phone preview on the
            left, or copy the Expo Snack source files on the right to run
            natively in Expo Go on Android.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[410px_minmax(0,1fr)] gap-8 items-start">
          {/* Left Column: Interactive Mobile POS Phone Preview */}
          <div id="interactive-preview" className="lg:sticky lg:top-24">
            <MobilePosSimulator />
          </div>

          {/* Right Column: Theme Extraction + Expo Snack Source Files + Setup */}
          <div className="min-w-0">
            <ExpoCodePanel />
          </div>
        </div>
      </main>
    </div>
  );
}
