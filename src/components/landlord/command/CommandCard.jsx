// Reusable Erudite dark-glass card shell with an icon + title and optional accent + count.
import { PALETTE } from './cmdHelpers';

export default function CommandCard({ icon, title, accent = PALETTE.gold, count, action, children, dense }) {
  return (
    <section
      className="rounded-2xl transition-transform"
      style={{
        background: PALETTE.card,
        border: `1px solid ${PALETTE.cardBorder}`,
        borderTop: `2px solid ${accent}55`,
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        padding: dense ? '12px 14px' : '16px 18px',
      }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span style={{ color: accent, fontSize: 15, lineHeight: 1 }}>{icon}</span>}
            {title && (
              <h3
                className="truncate"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 18, color: PALETTE.text, letterSpacing: '0.01em' }}
              >
                {title}
              </h3>
            )}
            {count != null && (
              <span
                className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${accent}22`, color: accent }}
              >
                {count}
              </span>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}