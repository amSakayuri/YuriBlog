'use client';
import dynamic from 'next/dynamic';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { MessageSquare } from 'lucide-react';
import type { GiscusConfig } from '@/lib/settings';
const Giscus = dynamic(() => import('@giscus/react'), { ssr: false });
class CommentsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>评论暂时不可用，请稍后重试。</p> : this.props.children;
  }
}
export function Comments({ config, language }: { config: GiscusConfig; language: string }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !config.enabled) return;
    const timeout = setTimeout(() => setSlow(true), 15000);
    const message = (event: MessageEvent) => {
      if (event.origin === 'https://giscus.app' && event.data?.giscus) {
        clearTimeout(timeout);
        setSlow(false);
      }
    };
    addEventListener('message', message);
    return () => {
      clearTimeout(timeout);
      removeEventListener('message', message);
    };
  }, [visible, config.enabled, attempt]);
  const configured = config.enabled && config.repo && config.repoId && config.categoryId;
  return (
    <section ref={ref} className="comments">
      <h2>
        <MessageSquare size={22} />
        {language === 'en' ? 'Discussion' : '评论'}
      </h2>
      {!configured ? (
        <p className="comments-status comments-empty">
          {language === 'en' ? 'Comments are not open yet.' : '评论暂未开放。'}
        </p>
      ) : (
        <>
          <CommentsBoundary key={attempt}>
            {visible ? (
              <Giscus
                key={attempt}
                repo={config.repo as `${string}/${string}`}
                repoId={config.repoId}
                category={config.category}
                categoryId={config.categoryId}
                mapping="pathname"
                strict="1"
                reactionsEnabled={config.reactionsEnabled ? '1' : '0'}
                inputPosition={config.inputPosition}
                theme={
                  config.theme === 'auto'
                    ? resolvedTheme === 'dark'
                      ? 'dark'
                      : 'light'
                    : config.theme
                }
                lang={language === 'en' ? 'en' : 'zh-CN'}
                loading="lazy"
                emitMetadata="1"
              />
            ) : (
              <p className="comments-status">
                {language === 'en' ? 'Loading discussion…' : '正在加载讨论…'}
              </p>
            )}
          </CommentsBoundary>
          {slow && (
            <p className="comments-status" role="status">
              {language === 'en' ? 'Discussion is taking longer to load.' : '评论加载较慢。'}{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSlow(false);
                  setAttempt((value) => value + 1);
                }}
              >
                {language === 'en' ? 'Retry' : '重试'}
              </button>
            </p>
          )}
          <a
            className="muted comments-discussions"
            href={`https://github.com/${config.repo}/discussions`}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Discussions
          </a>
        </>
      )}
    </section>
  );
}
