// Global CSS for the LandlordDetail page, extracted from LandlordDetailPage.jsx to keep
// that file under the line limit. Injected via <style>{GLOBAL_CSS}</style>.
export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap');
.ld-root *, .ld-root *::before, .ld-root *::after { box-sizing: border-box; }
.ld-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.ld-root ::-webkit-scrollbar-track { background: transparent; }
.ld-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
.ld-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
@keyframes ld-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ld-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ld-spin { to { transform: rotate(360deg); } }
@keyframes ld-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.ld-panels { display: flex; width: 100%; }

/* ── Mobile / tablet (≤1024px): conversation-first, messaging-app layout ──
   The left panel (conversation) becomes the full-height hero; the stream scrolls
   between a sticky header and a docked composer. The right "details" panel is
   hidden by default and slides up when toggled. Desktop (>1024px) is untouched. */
@media (max-width: 1024px) {
  .ld-root { height: 100dvh !important; overflow: hidden; }
  .ld-panels { flex-direction: column !important; min-height: 0; }

  /* Conversation panel = hero, fills remaining height */
  .ld-panel-left {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    border-right: none !important;
  }
  /* Stream scrolls; everything else is compact/sticky around it */
  .ld-panel-left .ld-scroll { flex: 1 1 auto !important; min-height: 0 !important; }

  /* Channel filter pills: one horizontally-scrollable strip, never wraps */
  .ld-filter-strip {
    flex-wrap: nowrap !important;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .ld-filter-strip::-webkit-scrollbar { display: none; }
  .ld-filter-strip > * { flex: 0 0 auto; }

  /* Composer docked at the bottom, above the fixed app dock + safe area */
  .ld-composer {
    padding-bottom: calc(12px + 88px + env(safe-area-inset-bottom)) !important;
  }

  /* Right details panel: hidden by default on mobile, shown when toggled open */
  .ld-panel-right { display: none !important; }
  .ld-root.ld-show-details .ld-panel-right {
    display: block !important;
    position: fixed;
    inset: 0;
    z-index: 900;
    width: 100% !important;
    height: 100dvh !important;
    max-height: none !important;
    background: hsl(222 47% 6%);
    padding-top: 56px !important;
    padding-bottom: calc(88px + env(safe-area-inset-bottom)) !important;
  }
  .ld-root.ld-show-details .ld-panel-left { display: none !important; }
}
`;