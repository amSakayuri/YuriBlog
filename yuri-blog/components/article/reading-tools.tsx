/* eslint-disable @next/next/no-img-element -- CMS assets are processed by Sharp; remote content URLs are author-configurable. */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { TocEntry } from '@/lib/markdown';
import { ArticleToc } from './toc';
export function ReadingTools({ toc }: { toc: TocEntry[] }) {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    async function click(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.matches('.copy-code')) {
        const text = target.closest('.code-block')?.querySelector('code')?.textContent ?? '';
        try {
          await navigator.clipboard.writeText(text);
          target.textContent = 'Copied';
          setTimeout(() => {
            target.textContent = 'Copy';
          }, 1800);
        } catch {
          target.textContent = 'Copy failed';
        }
      }
      if (target instanceof HTMLImageElement && target.closest('.prose'))
        setImage({ src: target.src, alt: target.alt });
    }
    function failure(event: Event) {
      if (event.target instanceof HTMLImageElement && event.target.closest('.prose')) {
        event.target.classList.add('image-failed');
        event.target.alt = event.target.alt || '图片加载失败';
      }
    }
    document.addEventListener('click', click);
    document.addEventListener('error', failure, true);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('error', failure, true);
    };
  }, [toc]);
  useEffect(() => {
    if (image) dialog.current?.showModal();
  }, [image]);
  return (
    <>
      {toc.length > 0 && (
        <aside className="toc">
          <ArticleToc entries={toc} />
        </aside>
      )}
      {toc.length > 0 && (
        <details className="mobile-toc">
          <summary>目录 / Contents</summary>
          <ArticleToc entries={toc} />
        </details>
      )}
      <dialog
        ref={dialog}
        className="image-dialog"
        onClose={() => setImage(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <button onClick={() => dialog.current?.close()} aria-label="关闭图片">
          关闭 / Close
        </button>
        {image && (
          <figure>
            <img src={image.src} alt={image.alt} />
            <figcaption>{image.alt}</figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
