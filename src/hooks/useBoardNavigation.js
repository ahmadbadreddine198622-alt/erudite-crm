import { useEffect, useRef } from 'react';

/**
 * Free canvas-style navigation for the Kanban board scroll container.
 *
 * Coexists with @dnd-kit — it NEVER preventDefaults during an active card drag, and
 * drag-to-pan only starts on empty board areas (not on cards, the grip handle, or
 * interactive controls). dnd-kit owns card dragging + edge auto-scroll; this hook owns
 * manual navigation:
 *   - wheel → horizontal scroll, EXCEPT when the cursor is over a column's own vertical
 *     overflow (then the column scrolls vertically — the natural hand-off).
 *   - press-drag on empty space → pan both axes like grabbing a map.
 *   - keyboard arrows / PageUp-Down / Home / End when the board has focus.
 *
 * Returns a ref to attach to the horizontal scroll container.
 */
export default function useBoardNavigation() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // --- Is the event target inside a draggable card / interactive control? ---
    // Drag-to-pan must ignore these so cards stay draggable and buttons stay clickable.
    const isInteractive = (target) =>
      !!target.closest(
        '[data-landlord-card], button, a, select, input, textarea, [role="button"], [data-no-pan]',
      );

    // --- Find the scrollable column under a point, if any ---
    const scrollableColumnAt = (x, y) => {
      const stack = document.elementsFromPoint(x, y);
      for (const node of stack) {
        if (node === el) break;
        if (node instanceof HTMLElement && node.dataset.columnScroll === 'true') return node;
      }
      return null;
    };

    // ---------- WHEEL → horizontal scroll ----------
    // Always translate vertical trackpad/wheel scroll into horizontal board scroll.
    // Columns handle their own vertical scroll natively when the pointer is inside them.
    const onWheel = (e) => {
      if (el.dataset.dragging === 'true') return;
      // Only act on vertical intent (not shift+wheel which is already horizontal)
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (e.shiftKey) return;
      // Translate vertical scroll → horizontal board scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    // ---------- DRAG-TO-PAN on empty space (both axes) ----------
    let panning = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let activeCol = null;

    const onPointerDown = (e) => {
      if (e.button !== 0) return; // left button only
      if (el.dataset.dragging === 'true') return; // card drag owns the pointer
      if (isInteractive(e.target)) return; // grabbing a card / control — not a pan
      panning = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.scrollLeft;
      // Vertical pan applies to a column under the cursor (if scrollable), else none.
      activeCol = scrollableColumnAt(e.clientX, e.clientY);
      startTop = activeCol ? activeCol.scrollTop : 0;
      el.style.cursor = 'grabbing';
      el.style.scrollBehavior = 'auto'; // instant during a drag-pan, smooth otherwise
    };

    const onPointerMove = (e) => {
      if (!panning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.scrollLeft = startLeft - dx;
      if (activeCol) activeCol.scrollTop = startTop - dy;
    };

    const endPan = () => {
      if (!panning) return;
      panning = false;
      activeCol = null;
      el.style.cursor = '';
      el.style.scrollBehavior = '';
    };

    // ---------- KEYBOARD ----------
    const onKeyDown = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      const colStep = 220;
      const boardStep = 340;
      if (e.key === 'ArrowLeft') {
        el.scrollLeft -= boardStep;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        el.scrollLeft += boardStep;
        e.preventDefault();
      } else if (e.key === 'Home') {
        el.scrollLeft = 0;
        e.preventDefault();
      } else if (e.key === 'End') {
        el.scrollLeft = el.scrollWidth;
        e.preventDefault();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
        const r = el.getBoundingClientRect();
        const col = scrollableColumnAt(r.left + r.width / 2, r.top + r.height / 2);
        if (col) {
          const dir = e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 1;
          const mag = e.key.startsWith('Page') ? col.clientHeight * 0.9 : colStep;
          col.scrollTop += dir * mag;
          e.preventDefault();
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPan);
    el.addEventListener('keydown', onKeyDown);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPan);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return ref;
}