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
@media (max-width: 820px) {
  .ld-root { height: auto !important; }
  .ld-panels { flex-direction: column !important; }
  .ld-panel { flex: 1 1 auto !important; width: 100% !important; height: auto !important; max-height: none !important; border-right: none !important; }
  .ld-scroll { max-height: 640px; }
}
`;