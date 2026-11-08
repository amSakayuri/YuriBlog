'use client';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
type Settings = { size: number; line: number; width: number; indent: boolean; theme: string };
const defaults: Settings = { size: 20, line: 2, width: 720, indent: true, theme: 'inherit' };
function read(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Reading remains usable when storage is unavailable. */
  }
}
export function ContinueReading({ novelId, base }: { novelId: string; base: string }) {
  const [saved, setSaved] = useState<{ slug: string; progress: number } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSaved(read(`yuri:progress:${novelId}`)), 0);
    return () => clearTimeout(timer);
  }, [novelId]);
  return saved ? (
    <Link className="button button-outline" href={`${base}/${encodeURIComponent(saved.slug)}`}>
      继续阅读 · {Math.round(saved.progress * 100)}%
    </Link>
  ) : null;
}
export function Reader({
  novelId,
  chapterId,
  chapterSlug,
  children,
  language,
}: {
  novelId: string;
  chapterId: string;
  chapterSlug: string;
  children: React.ReactNode;
  language: string;
}) {
  const [settings, setSettings] = useState(defaults);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const en = language === 'en';
  useEffect(() => {
    const init = setTimeout(() => {
      const value = read('yuri:reader-settings');
      if (value)
        setSettings({
          size: Math.min(28, Math.max(16, Number(value.size) || 20)),
          line: Math.min(2.6, Math.max(1.6, Number(value.line) || 2)),
          width: Math.min(960, Math.max(560, Number(value.width) || 720)),
          indent: !!value.indent,
          theme: ['inherit', 'light', 'dark', 'sepia'].includes(value.theme)
            ? value.theme
            : 'inherit',
        });
      setReady(true);
    }, 0);
    const saved = read(`yuri:progress:${novelId}`);
    const timer = setTimeout(() => {
      if (saved?.chapterId === chapterId && Number.isFinite(saved.progress))
        window.scrollTo(0, saved.progress * (document.documentElement.scrollHeight - innerHeight));
    }, 250);
    return () => {
      clearTimeout(init);
      clearTimeout(timer);
    };
  }, [novelId, chapterId]);
  useEffect(() => {
    if (!ready) return;
    store('yuri:reader-settings', settings);
  }, [settings, ready]);
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout>;
    function scroll() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const value = Math.min(
          1,
          Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)),
        );
        setProgress(value);
        store(`yuri:progress:${novelId}`, { chapterId, slug: chapterSlug, progress: value });
      }, 150);
    }
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', scroll);
    };
  }, [novelId, chapterId, chapterSlug, ready]);
  const change = (patch: Partial<Settings>) => setSettings((value) => ({ ...value, ...patch }));
  return (
    <div
      className={`reader reader-${settings.theme}`}
      style={
        {
          '--reader-size': `${settings.size}px`,
          '--reader-line': settings.line,
          '--reader-width': `${settings.width}px`,
          '--reader-indent': settings.indent ? '2em' : '0',
        } as CSSProperties
      }
    >
      <details className="reader-settings">
        <summary>
          {en ? 'Reading settings' : '阅读设置'} · {Math.round(progress * 100)}%
        </summary>
        <div className="reader-controls">
          <label>
            {en ? 'Font size' : '字号'}
            <input
              type="range"
              min="16"
              max="28"
              value={settings.size}
              onChange={(e) => change({ size: Number(e.target.value) })}
            />
          </label>
          <label>
            {en ? 'Line height' : '行距'}
            <input
              type="range"
              min="1.6"
              max="2.6"
              step="0.1"
              value={settings.line}
              onChange={(e) => change({ line: Number(e.target.value) })}
            />
          </label>
          <label>
            {en ? 'Width' : '宽度'}
            <input
              type="range"
              min="560"
              max="960"
              step="40"
              value={settings.width}
              onChange={(e) => change({ width: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.indent}
              onChange={(e) => change({ indent: e.target.checked })}
            />
            {en ? 'Indent paragraphs' : '段落缩进'}
          </label>
          <label>
            {en ? 'Theme' : '阅读主题'}
            <select value={settings.theme} onChange={(e) => change({ theme: e.target.value })}>
              <option value="inherit">System / 跟随网站</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="sepia">Sepia</option>
            </select>
          </label>
        </div>
      </details>
      <div className="reader-content">{children}</div>
    </div>
  );
}
