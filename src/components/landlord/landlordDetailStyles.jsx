// Global CSS for the LandlordDetail page, extracted from LandlordDetailPage.jsx to keep
// that file under the line limit. Injected via <style>{GLOBAL_CSS}</style>.
export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap');
.ld-root *, .ld-root *::before, .ld-root *::after { box-sizing: border-box; }
/* Pipeline-matched surface — every panel on the detail page rides this one navy card. */
.ld-surface { background: #0B1F3A !important; border-color: rgba(201,162,75,0.18) !important; box-shadow: 0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04); }
.ld-inset { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.08) !important; }
.ld-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.ld-root ::-webkit-scrollbar-track { background: transparent; }
.ld-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
.ld-root ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
@keyframes ld-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ld-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ld-spin { to { transform: rotate(360deg); } }
@keyframes ld-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.ld-panels { display: flex; width: 100%; }
@media (max-width: 820px) {
  .ld-root { height: auto !important; }
  .ld-panels { flex-direction: column !important; }
  .ld-panel { flex: 1 1 auto !important; width: 100% !important; height: auto !important; max-height: none !important; border-right: none !important; }
  .ld-scroll { max-height: 640px; }
}
`;