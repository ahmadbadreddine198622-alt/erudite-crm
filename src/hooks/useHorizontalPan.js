import { useEffect, useRef } from 'react';

/**
 * useHorizontalPan — professional Trello-style horizontal panning for a scroll container.
 *
 * - Click-and-drag on empty board area pans the board left/right (grab cursor).
 * - Vertical mouse-wheel / trackpad scroll is translated into horizontal scroll.
 * - Does NOT hijack interactions on cards, buttons, inputs or anything draggable —
 *   so @hello-pangea/dnd card drag-and-drop and clicks keep working untouched.
 *
 * Returns a ref to attach to the overflow-x-auto container.
 */
export default function useHorizontalPan() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    // Only start a pan when the press lands on "blank" board area —
    // never on a card, button, link, input, or a DnD draggable handle.
    const isInteractive = (target) =>
      target.closest(
        '[data-rbd-draggable-id], [data-rbd-drag-handle-draggable-id], button, a, input, select, textarea, [role="button"]'
      );

    const onPointerDown = (e) => {
      if (e.button !== 0) return;            // left click only
      if (isInteractive(e.target)) return;   // let cards/controls handle their own events
      isDown = true;
      moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onPointerMove = (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startScroll - dx;
    };

    const endPan = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    // Swallow the click that follows a real pan, so a drag doesn't open a card.
    const onClickCapture = (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    // Translate vertical wheel into horizontal scroll (when there's room to scroll x).
    const onWheel = (e) => {
      if (e.shiftKey) return; // shift+wheel already scrolls horizontally
      const canScrollX = el.scrollWidth > el.clientWidth;
      if (!canScrollX) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endPan);
    el.addEventListener('click', onClickCapture, true);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPan);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  return ref;
}