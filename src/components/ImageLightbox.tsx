import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const SWIPE_THRESHOLD_RATIO = 0.25;
const DISMISS_THRESHOLD_RATIO = 0.2;

/** Full-screen photo viewer for a show's backdrop strip. Swipe
 * left/right to move between images, or swipe down to dismiss — same
 * drag-with-threshold feel as the sheet's edge-swipe-to-close and the
 * show card's swipe-to-unwatch (see ShowDetailScreen/ShowCard).
 * Tapping the backdrop, the close button, or Escape also dismiss it. */
export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    locked: boolean;
    axis: 'horizontal' | 'vertical' | null;
  } | null>(null);
  // Set once a drag locks in, so the click a touchend/mouseup
  // synthesizes afterward doesn't also close the lightbox via the
  // backdrop tap-to-dismiss handler. Consumed by the next click.
  const wasDraggedRef = useRef(false);

  const [dragX, setDragXState] = useState(0);
  const [dragY, setDragYState] = useState(0);
  // Mirror dragX/dragY synchronously — state updates from a fast run
  // of pointermove events can lag a render behind, so handlePointerUp
  // reads these instead of risking a stale distance.
  const dragXRef = useRef(0);
  const dragYRef = useRef(0);
  function setDragX(value: number) {
    dragXRef.current = value;
    setDragXState(value);
  }
  function setDragY(value: number) {
    dragYRef.current = value;
    setDragYState(value);
  }
  const [isDragging, setIsDragging] = useState(false);

  function handlePointerDown(e: React.PointerEvent) {
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      locked: false,
      axis: null,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.locked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        drag.axis = 'horizontal';
      } else if (dy > Math.abs(dx) * 1.5) {
        drag.axis = 'vertical'; // downward only — an upward-dominant drag isn't bound to anything
      } else {
        dragStateRef.current = null; // too diagonal to tell intent
        return;
      }
      drag.locked = true;
      wasDraggedRef.current = true;
      setIsDragging(true);
    }
    if (drag.axis === 'horizontal') {
      setDragX(dx);
    } else {
      setDragY(Math.max(0, dy));
    }
  }

  function handlePointerCancel() {
    dragStateRef.current = null;
    setIsDragging(false);
    setDragX(0);
    setDragY(0);
  }

  function handlePointerUp() {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    if (!drag?.locked) {
      setDragX(0);
      setDragY(0);
      return;
    }
    setIsDragging(false);

    if (drag.axis === 'vertical') {
      const height = containerRef.current?.offsetHeight ?? window.innerHeight;
      if (dragYRef.current >= height * DISMISS_THRESHOLD_RATIO) {
        setDragY(height);
        setTimeout(onClose, 200);
      } else {
        setDragY(0);
      }
      return;
    }

    const width = containerRef.current?.offsetWidth ?? window.innerWidth;
    if (dragXRef.current <= -width * SWIPE_THRESHOLD_RATIO && index < images.length - 1) {
      setDragX(-width);
      setTimeout(() => {
        setIndex((i) => i + 1);
        setDragX(0);
      }, 200);
    } else if (dragXRef.current >= width * SWIPE_THRESHOLD_RATIO && index > 0) {
      setDragX(width);
      setTimeout(() => {
        setIndex((i) => i - 1);
        setDragX(0);
      }, 200);
    } else {
      setDragX(0);
    }
  }

  function handleBackdropClick() {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    onClose();
  }

  // Fades the backdrop out as the image is dragged down, so the
  // dismiss gesture reads as "pulling the photo off the screen"
  // rather than a hard cut once it crosses the threshold.
  const backdropOpacity = Math.max(0.3, 0.95 - dragY / 400);

  // The close button/counter fade out faster than the backdrop —
  // fully gone at 60% of the distance needed to actually dismiss, so
  // they're never still visible (looking stuck/out of place) by the
  // time the drag commits to closing.
  const dismissDistance =
    (containerRef.current?.offsetHeight ?? window.innerHeight) * DISMISS_THRESHOLD_RATIO;
  const chromeOpacity = Math.max(0, 1 - dragY / (dismissDistance * 0.6));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleBackdropClick}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black"
        style={{
          opacity: backdropOpacity,
          animation: 'dialog-backdrop-in 0.15s ease',
          transition: isDragging ? 'none' : 'opacity 0.2s ease',
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation(); // don't also fire the backdrop's dismiss handler
          onClose();
        }}
        aria-label="Close"
        className="absolute z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        style={{
          top: 'calc(1rem + env(safe-area-inset-top))',
          left: 'calc(1rem + env(safe-area-inset-left))',
          opacity: chromeOpacity,
          transition: isDragging ? 'none' : 'opacity 0.2s ease',
        }}
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white/80"
          style={{
            opacity: chromeOpacity,
            transition: isDragging ? 'none' : 'opacity 0.2s ease',
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}

      <img
        key={index}
        src={images[index]}
        alt=""
        draggable={false}
        style={{
          transform: `translate(${dragX}px, ${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease',
        }}
        className="relative max-h-full max-w-full select-none object-contain"
      />
    </div>
  );
}
