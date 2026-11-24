import { useEffect, useRef, type PointerEvent, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from 'framer-motion';
import { theme } from './theme.config';

const MotionLink = m.create(Link);

function useMagnet(disabled = false) {
  const reduced = useReducedMotion();
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, theme.motion.magnet.spring);
  const y = useSpring(targetY, theme.motion.magnet.spring);
  const bounds = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const reset = () => {
    targetX.set(0);
    targetY.set(0);
  };

  useEffect(() => {
    if (reduced || disabled) {
      targetX.jump(0);
      targetY.jump(0);
      x.jump(0);
      y.jump(0);
    }
  }, [reduced, disabled, targetX, targetY, x, y]);

  const enabled = (event: PointerEvent<HTMLElement>) =>
    !reduced &&
    !disabled &&
    event.pointerType === 'mouse' &&
    matchMedia('(hover: hover) and (pointer: fine)').matches;

  return {
    style: { x, y },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (!enabled(event)) return;
      const rect = event.currentTarget.getBoundingClientRect();
      bounds.current = {
        left: rect.left - x.get(),
        top: rect.top - y.get(),
        width: rect.width,
        height: rect.height,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!enabled(event) || !bounds.current) return;
      const rect = bounds.current;
      const { maxOffset, pull } = theme.motion.magnet;
      const clamp = (value: number) => Math.max(-maxOffset, Math.min(maxOffset, value * pull));
      targetX.set(clamp(event.clientX - rect.left - rect.width / 2));
      targetY.set(clamp(event.clientY - rect.top - rect.height / 2));
    },
    onPointerLeave: () => {
      bounds.current = null;
      reset();
    },
    onPointerCancel: () => {
      bounds.current = null;
      reset();
    },
    onBlur: reset,
    whileTap: reduced || disabled ? undefined : { scale: 0.97 },
    transition: { type: 'spring' as const, ...theme.motion.magnet.spring },
  };
}

export function MagneticLink(props: ComponentProps<typeof MotionLink>) {
  const magnetic = useMagnet();
  return <MotionLink {...props} {...magnetic} data-magnetic="true" />;
}
export function MagneticAnchor(props: HTMLMotionProps<'a'>) {
  const magnetic = useMagnet();
  return <m.a {...props} {...magnetic} data-magnetic="true" />;
}
export function MagneticButton(props: HTMLMotionProps<'button'>) {
  const magnetic = useMagnet(props.disabled);
  return <m.button {...props} {...magnetic} data-magnetic="true" />;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="page-transition"
      initial={reduced ? false : { opacity: 0, y: theme.motion.page.distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : theme.motion.page.duration,
        ease: [...theme.motion.reveal.ease],
      }}
    >
      {children}
    </m.div>
  );
}
