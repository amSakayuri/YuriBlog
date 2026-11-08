'use client';

import { startTransition, useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Native snapshots keep server-rendered routes and Next's scrolling behavior intact. */
export function PublicMotion() {
  const pathname = usePathname();
  const router = useRouter();
  const pending = useRef<(() => void) | null>(null);
  const currentPath = useRef(pathname);

  useLayoutEffect(() => {
    currentPath.current = pathname;
    pending.current?.();
  }, [pathname]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active: ViewTransition | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function transition(update?: () => void, direction = '') {
      if (!document.startViewTransition || reduced.matches) {
        update?.();
        return;
      }
      pending.current?.();
      active?.skipTransition();
      document.documentElement.dataset.pageTransition = direction;
      // Register before snapshot capture: popstate may commit before its callback runs.
      const committed = new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          pending.current = null;
          resolve();
        };
        pending.current = finish;
        // A failed or interrupted route must never leave an overlay blocking the page.
        timer = setTimeout(finish, 4000);
      });
      active = document.startViewTransition(() => {
        update?.();
        return committed;
      });
      void active.finished.catch(() => {});
    }

    function click(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        reduced.matches ||
        !document.startViewTransition
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('.public-shell a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        url.pathname === location.pathname ||
        /^\/(admin|api|preview|uploads)(\/|$)/.test(url.pathname) ||
        /\.[a-z0-9]+$/i.test(url.pathname)
      )
        return;
      event.preventDefault();
      const current = location.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
      const next = url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
      const direction =
        current !== '/' && next.startsWith(`${current}/`)
          ? 'forward'
          : next !== '/' && current.startsWith(`${next}/`)
            ? 'backward'
            : '';
      transition(
        () => startTransition(() => router.push(url.pathname + url.search + url.hash)),
        direction,
      );
    }
    function back() {
      if (
        location.pathname !== currentPath.current &&
        !/^\/(admin|preview)(\/|$)/.test(location.pathname)
      )
        transition();
    }
    function ripple(event: PointerEvent) {
      if (reduced.matches || event.button !== 0) return;
      const control = (event.target as Element).closest<HTMLElement>(
        '.public-shell :is(.button, .copy-code, .header-tools > a)',
      );
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      const rect = control.getBoundingClientRect();
      const size = Math.hypot(rect.width, rect.height) * 2;
      const wave = document.createElement('span');
      wave.className = 'control-ripple';
      Object.assign(wave.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${event.clientX - rect.left - size / 2}px`,
        top: `${event.clientY - rect.top - size / 2}px`,
      });
      control.append(wave);
      const animation = wave.animate(
        [
          { transform: 'scale(0)', opacity: 0.12 },
          { transform: 'scale(1)', opacity: 0 },
        ],
        { duration: 450, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      );
      void animation.finished.then(
        () => wave.remove(),
        () => wave.remove(),
      );
    }
    document.addEventListener('click', click, true);
    document.addEventListener('pointerdown', ripple);
    window.addEventListener('popstate', back);
    return () => {
      document.removeEventListener('click', click, true);
      document.removeEventListener('pointerdown', ripple);
      window.removeEventListener('popstate', back);
      pending.current?.();
      active?.skipTransition();
      clearTimeout(timer);
      delete document.documentElement.dataset.pageTransition;
    };
  }, [router]);
  return null;
}
