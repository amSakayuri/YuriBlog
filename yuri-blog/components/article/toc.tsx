'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { List } from 'lucide-react';
import type { TocEntry } from '@/lib/markdown';
type Node = { x: number; y: number };
export function ArticleToc({ entries }: { entries: TocEntry[] }) {
  const maskId = useId().replaceAll(':', '');
  const nav = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const progress = useRef<SVGPathElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const hole = useRef<SVGCircleElement>(null);
  const nodeHole = useRef<SVGCircleElement>(null);
  const [active, setActive] = useState('');
  const [geometry, setGeometry] = useState<{ nodes: Node[]; d: string; height: number }>({
    nodes: [],
    d: '',
    height: 0,
  });
  useEffect(() => {
    const measure = () => {
      if (!list.current?.getBoundingClientRect().width) return;
      const links = [...list.current.querySelectorAll<HTMLAnchorElement>('a')];
      const nodes = links.map((link, index) => ({
        x: 5 + (entries[index].level - 2) * 14,
        y: link.offsetTop + link.offsetHeight / 2,
      }));
      let d = nodes.length ? `M${nodes[0].x} 0 L${nodes[0].x} ${nodes[0].y}` : '';
      nodes.slice(1).forEach((node, index) => {
        const before = nodes[index];
        const gap = (node.y - before.y) * 0.3;
        if (node.x !== before.x) d += ` L${before.x} ${before.y + gap} L${node.x} ${node.y - gap}`;
        d += ` L${node.x} ${node.y}`;
      });
      setGeometry({ nodes, d, height: list.current.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    if (list.current) observer.observe(list.current);
    document.fonts.ready.then(measure);
    const details = list.current?.closest('details');
    details?.addEventListener('toggle', measure);
    measure();
    return () => {
      observer.disconnect();
      details?.removeEventListener('toggle', measure);
    };
  }, [entries]);
  useEffect(() => {
    const path = progress.current;
    if (!path || !geometry.nodes.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0,
      target = 0,
      frame = 0,
      last = 0,
      angle = 180;
    const length = path.getTotalLength();
    const updateNodes = (distance: number) => {
      const point = path.getPointAtLength(distance);
      for (const [index, node] of geometry.nodes.entries())
        list.current
          ?.querySelector(`[data-toc-node="${index}"]`)
          ?.classList.toggle('covered', node.y <= point.y);
      hole.current?.setAttribute('cx', String(point.x));
      hole.current?.setAttribute('cy', String(point.y));
      nodeHole.current?.setAttribute('cx', String(point.x));
      nodeHole.current?.setAttribute('cy', String(point.y));
      path.setAttribute('stroke-dashoffset', String(1 - (length ? distance / length : 0)));
      return point;
    };
    const draw = (time: number) => {
      const dt = Math.min((time - last || 16) / 1000, 0.05);
      last = time;
      const old = current;
      current = reduced.matches ? target : current + (target - current) * (1 - Math.exp(-18 * dt));
      const point = updateNodes(current);
      const direction = target >= old ? 1 : -1;
      const tangent = path.getPointAtLength(Math.max(0, Math.min(length, current + direction * 3)));
      const wanted =
        Math.hypot(tangent.y - point.y, tangent.x - point.x) < 0.01
          ? angle
          : (Math.atan2(tangent.y - point.y, tangent.x - point.x) * 180) / Math.PI + 90;
      const delta = ((wanted - angle + 540) % 360) - 180;
      angle += delta * (reduced.matches ? 1 : 1 - Math.exp(-12 * dt));
      if (plane.current) {
        plane.current.style.transform = `translate(${point.x}px,${point.y}px) rotate(${angle}deg)`;
        plane.current.style.visibility = reduced.matches ? 'hidden' : 'visible';
      }
      if (Math.abs(target - current) > 0.02) frame = requestAnimationFrame(draw);
      else {
        current = target;
        updateNodes(current);
        frame = 0;
        last = 0;
      }
    };
    const onScroll = () => {
      if (!nav.current?.getBoundingClientRect().width) return;
      const headings = entries.map((entry) => document.getElementById(entry.id));
      const line = Math.max(115, innerHeight * 0.18);
      const tops = headings.map((heading) => heading?.getBoundingClientRect().top ?? Infinity);
      let index = 0;
      for (let i = 0; i < tops.length; i++) if (tops[i] <= line) index = i;
      setActive(entries[index].id);
      const next = index + 1;
      const end =
        next < tops.length
          ? tops[next]
          : (document.querySelector('.article-detail > .prose')?.getBoundingClientRect().bottom ??
            tops[index] + innerHeight);
      const fraction = Math.max(
        0,
        Math.min(1, (line - tops[index]) / Math.max(1, end - tops[index])),
      );
      const startY = index === 0 && tops[0] > line ? 0 : geometry.nodes[index].y;
      const y =
        startY + (geometry.nodes[Math.min(next, geometry.nodes.length - 1)].y - startY) * fraction;
      let low = 0,
        high = length;
      for (let step = 0; step < 16; step++) {
        const middle = (low + high) / 2;
        if (path.getPointAtLength(middle).y < y) low = middle;
        else high = middle;
      }
      target = (low + high) / 2;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    reduced.addEventListener('change', onScroll);
    onScroll();
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      reduced.removeEventListener('change', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [entries, geometry]);
  useEffect(() => {
    const link = list.current?.querySelector<HTMLAnchorElement>('a[aria-current]');
    const container = nav.current;
    if (link && container && container.clientHeight < container.scrollHeight) {
      const top = link.offsetTop;
      if (
        top < container.scrollTop ||
        top + link.offsetHeight > container.scrollTop + container.clientHeight
      )
        container.scrollTo({
          top: Math.max(0, top - container.clientHeight / 2),
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
    }
  }, [active]);
  return (
    <nav className="article-toc" aria-label="文章目录" ref={nav}>
      <p className="toc-title">
        <List size={14} />
        目录
      </p>
      <div className="toc-list" ref={list}>
        {geometry.d && (
          <svg className="toc-rail" width="47" height={geometry.height} aria-hidden="true">
            <defs>
              <linearGradient
                id={`${maskId}-fade`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2="12"
              >
                <stop offset="0" stopColor="black" />
                <stop offset="1" stopColor="white" />
              </linearGradient>
              <mask
                id={maskId}
                maskUnits="userSpaceOnUse"
                x="-8"
                y="-8"
                width="70"
                height={geometry.height + 16}
              >
                <rect
                  x="-8"
                  y="-8"
                  width="70"
                  height={geometry.height + 16}
                  fill={`url(#${maskId}-fade)`}
                />
                {geometry.nodes.map((node, index) => (
                  <circle key={index} cx={node.x} cy={node.y} r="4" fill="black" />
                ))}
                <circle ref={hole} r="5" fill="black" />
              </mask>
              <mask
                id={`${maskId}-nodes`}
                maskUnits="userSpaceOnUse"
                x="-8"
                y="-8"
                width="70"
                height={geometry.height + 16}
              >
                <rect x="-8" y="-8" width="70" height={geometry.height + 16} fill="white" />
                <circle ref={nodeHole} r="4" fill="black" />
              </mask>
            </defs>
            <g mask={`url(#${maskId})`}>
              <path className="toc-track" d={geometry.d} />
              <path
                ref={progress}
                className="toc-progress"
                d={geometry.d}
                pathLength="1"
                strokeDasharray="1 1"
                strokeDashoffset="1"
              />
            </g>
            <g mask={`url(#${maskId}-nodes)`}>
              {geometry.nodes.map((node, index) => (
                <circle
                  key={index}
                  className="toc-node"
                  data-toc-node={index}
                  cx={node.x}
                  cy={node.y}
                  r={entries[index].id === active ? 3.25 : 3}
                />
              ))}
            </g>
          </svg>
        )}
        <div ref={plane} className="toc-plane" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 2 20.5 21 12 17.5 3.5 21z" />
          </svg>
        </div>
        <ul className="toc-links">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className={entry.id === active ? 'active' : ''}
                aria-current={entry.id === active ? 'location' : undefined}
                style={{ paddingInlineStart: 19 + (entry.level - 2) * 14 }}
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
