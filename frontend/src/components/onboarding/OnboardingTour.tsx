import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ONBOARDING_STEPS } from '@/config/onboarding';
import type { SecurityLevel } from '@/types/chat';

interface OnboardingTourProps {
  level: SecurityLevel;
  onClose: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  width: number;
}

const SPOTLIGHT_PADDING = 6;
const TOOLTIP_MAX_WIDTH = 360;
const TOOLTIP_GAP = 14;
const TOOLTIP_ESTIMATED_HEIGHT = 220;

/** Evita el warning de useLayoutEffect en el render estático (tests SSR). */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ACCENTS: Record<
  SecurityLevel,
  { text: string; ring: string; glow: string; button: string; dot: string }
> = {
  1: {
    text: 'text-amber-300',
    ring: 'border-amber-400',
    glow: 'shadow-[0_0_0_6px_rgba(245,158,11,0.15),0_0_35px_rgba(245,158,11,0.35)]',
    button: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    dot: 'bg-amber-400',
  },
  2: {
    text: 'text-sky-300',
    ring: 'border-sky-400',
    glow: 'shadow-[0_0_0_6px_rgba(56,189,248,0.15),0_0_35px_rgba(56,189,248,0.35)]',
    button: 'bg-sky-500 hover:bg-sky-400 text-slate-950',
    dot: 'bg-sky-400',
  },
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ level, onClose }) => {
  const steps = ONBOARDING_STEPS[level];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPosition | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const safeIndex = Math.min(index, Math.max(0, steps.length - 1));
  const step = steps[safeIndex];
  const accent = ACCENTS[level];
  const isLast = safeIndex >= steps.length - 1;

  const measure = useCallback(() => {
    if (typeof window === 'undefined' || !step) return;

    const target = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`
    );

    if (!target) {
      setRect(null);
      setTooltip(null);
      return;
    }

    const targetRect = target.getBoundingClientRect();
    if (targetRect.width === 0 && targetRect.height === 0) {
      setRect(null);
      setTooltip(null);
      return;
    }

    setRect({
      top: targetRect.top,
      left: targetRect.left,
      width: targetRect.width,
      height: targetRect.height,
    });

    const width = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - 24);
    const estimatedHeight = Math.min(TOOLTIP_ESTIMATED_HEIGHT, window.innerHeight - 24);
    const spaceBelow = window.innerHeight - targetRect.bottom - TOOLTIP_GAP - 12;
    const spaceAbove = targetRect.top - TOOLTIP_GAP - 12;
    const placeBelow = spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove;

    const top = placeBelow
      ? Math.min(targetRect.bottom + TOOLTIP_GAP, window.innerHeight - estimatedHeight - 12)
      : Math.max(12, targetRect.top - estimatedHeight - TOOLTIP_GAP);

    const left = Math.min(
      Math.max(12, targetRect.left + targetRect.width / 2 - width / 2),
      Math.max(12, window.innerWidth - width - 12)
    );

    setTooltip({ top, left, width });
  }, [step]);

  // Centra el objetivo si está fuera de la vista y vuelve a medir tras el scroll.
  useIsomorphicLayoutEffect(() => {
    if (!step) return;

    const target = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`
    );

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const fullyVisible =
        targetRect.top >= 0 &&
        targetRect.left >= 0 &&
        targetRect.bottom <= window.innerHeight &&
        targetRect.right <= window.innerWidth;

      if (!fullyVisible) {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    }

    measure();
    const retry = window.setTimeout(measure, 320);
    return () => window.clearTimeout(retry);
  }, [safeIndex, measure, step]);

  // Recalcula si cambia el viewport o se desplaza cualquier contenedor.
  useEffect(() => {
    const handler = () => measure();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [measure]);

  const goNext = useCallback(() => {
    if (isLast) onClose();
    else setIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [isLast, onClose, steps.length]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  // Enfoca el tooltip en cada paso para que el teclado funcione de inmediato.
  useEffect(() => {
    const timer = window.setTimeout(() => cardRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [safeIndex]);

  if (typeof document === 'undefined' || !step) return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = SPOTLIGHT_PADDING;

  const spot = rect
    ? {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        right: Math.min(viewportWidth, rect.left + rect.width + padding),
        bottom: Math.min(viewportHeight, rect.top + rect.height + padding),
      }
    : null;

  const tooltipStyle: React.CSSProperties = tooltip
    ? { top: tooltip.top, left: tooltip.left, width: tooltip.width }
    : {
        top: '50%',
        left: '50%',
        width: Math.min(TOOLTIP_MAX_WIDTH, viewportWidth - 24),
        transform: 'translate(-50%, -50%)',
      };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
    >
      {spot ? (
        <>
          <div
            className="pointer-events-none fixed z-[200] bg-slate-950/75 backdrop-blur-md transition-all duration-200"
            style={{ top: 0, left: 0, width: '100%', height: spot.top }}
          />
          <div
            className="pointer-events-none fixed z-[200] bg-slate-950/75 backdrop-blur-md transition-all duration-200"
            style={{
              top: spot.bottom,
              left: 0,
              width: '100%',
              height: Math.max(0, viewportHeight - spot.bottom),
            }}
          />
          <div
            className="pointer-events-none fixed z-[200] bg-slate-950/75 backdrop-blur-md transition-all duration-200"
            style={{
              top: spot.top,
              left: 0,
              width: spot.left,
              height: Math.max(0, spot.bottom - spot.top),
            }}
          />
          <div
            className="pointer-events-none fixed z-[200] bg-slate-950/75 backdrop-blur-md transition-all duration-200"
            style={{
              top: spot.top,
              left: spot.right,
              width: Math.max(0, viewportWidth - spot.right),
              height: Math.max(0, spot.bottom - spot.top),
            }}
          />
          <div
            className={`pointer-events-none fixed z-[220] rounded-xl border-2 transition-all duration-200 ${accent.ring} ${accent.glow}`}
            style={{
              top: spot.top,
              left: spot.left,
              width: Math.max(0, spot.right - spot.left),
              height: Math.max(0, spot.bottom - spot.top),
            }}
          />
        </>
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md" />
      )}

      {/* Capa que bloquea clicks al fondo pero deja visible el spotlight. */}
      <div className="pointer-events-auto fixed inset-0 z-[210]" />

      <div
        ref={cardRef}
        tabIndex={-1}
        className="pointer-events-auto fixed z-[230] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl outline-none transition-all duration-200"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wide ${accent.text}`}>
            Paso {safeIndex + 1} de {steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Saltar tutorial"
            title="Saltar tutorial"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2
          id="onboarding-title"
          className="mt-1 font-heading text-base font-bold tracking-wide text-foreground"
        >
          {step.title}
        </h2>
        <p
          id="onboarding-description"
          className="mt-1 text-xs sm:text-sm leading-relaxed text-muted-foreground"
        >
          {step.description}
        </p>

        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {steps.map((_, dotIndex) => (
            <span
              key={dotIndex}
              className={`h-1.5 rounded-full transition-all ${
                dotIndex === safeIndex
                  ? `w-5 ${accent.dot}`
                  : dotIndex < safeIndex
                    ? `w-1.5 ${accent.dot} opacity-60`
                    : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Saltar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={safeIndex === 0}
            >
              <ChevronLeft className="size-3.5" data-icon="inline-start" />
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={goNext}
              className={accent.button}
            >
              {isLast ? 'Finalizar' : 'Siguiente'}
              {!isLast && <ChevronRight className="size-3.5" data-icon="inline-end" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
