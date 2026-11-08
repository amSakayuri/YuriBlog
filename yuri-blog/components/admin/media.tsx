/* eslint-disable @next/next/no-img-element -- CMS assets are processed by Sharp; remote content URLs are author-configurable. */
'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
type Asset = {
  id: string;
  filename: string;
  storagePath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  size: number;
  alt: string;
};
export function MediaLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await fetch(`/api/admin/media?q=${encodeURIComponent(query)}`);
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      setAssets(data);
    } catch (error) {
      setError((error as Error).message);
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>媒体库</h1>
          <p className="muted">PNG / JPEG / WebP / GIF · 每张最大 10 MB</p>
        </div>
        <label className="button button-default">
          {busy ? '正在上传…' : '上传图片'}
          <input
            type="file"
            hidden
            multiple
            disabled={busy}
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={async (event) => {
              const files = event.target.files;
              if (!files) return;
              setBusy(true);
              setError('');
              try {
                const form = new FormData();
                for (const file of Array.from(files)) form.append('files', file);
                const result = await fetch('/api/admin/media', { method: 'POST', body: form });
                const data = await result.json();
                if (!result.ok) throw new Error(data.error);
                setMessage(`已上传 ${data.length} 张图片`);
                await load();
              } catch (error) {
                setError((error as Error).message);
                await load();
              } finally {
                setBusy(false);
                event.target.value = '';
              }
            }}
          />
        </label>
      </div>
      <input
        aria-label="搜索图片"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="按文件名搜索…"
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="media-grid">
        {assets.map((asset) => (
          <article key={asset.id}>
            <a href={asset.storagePath} target="_blank" rel="noopener noreferrer">
              <img src={asset.thumbnailPath} alt={asset.alt || asset.filename} />
            </a>
            <h2>{asset.filename}</h2>
            <p className="muted">
              {asset.width} × {asset.height} · {(asset.size / 1024).toFixed(1)} KB
            </p>
            <label>
              替代文本
              <input
                defaultValue={asset.alt}
                onBlur={async (event) => {
                  if (event.target.value === asset.alt) return;
                  const result = await fetch('/api/admin/media', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: asset.id, alt: event.target.value }),
                  });
                  if (!result.ok) setError((await result.json()).error);
                }}
              />
            </label>
            <div className="actions">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(asset.storagePath);
                    setMessage('URL 已复制');
                  } catch {
                    setMessage(asset.storagePath);
                  }
                }}
              >
                复制 URL
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `![${asset.alt || asset.filename}](${asset.storagePath})`,
                    );
                    setMessage('Markdown 已复制');
                  } catch {
                    setMessage(asset.storagePath);
                  }
                }}
              >
                Markdown
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setError('');
                  try {
                    const references = await fetch(`/api/admin/media?id=${asset.id}`);
                    const refs = await references.json();
                    if (!references.ok) throw new Error(refs.error);
                    if (refs.length) {
                      setError(
                        `仍被引用：${refs.map((r: { title: string }) => r.title).join('、')}。请先移除引用。`,
                      );
                      return;
                    }
                    if (!confirm(`确定删除 ${asset.filename}？`)) return;
                    const result = await fetch(`/api/admin/media?id=${asset.id}`, {
                      method: 'DELETE',
                    });
                    if (!result.ok) throw new Error((await result.json()).error);
                    await load();
                  } catch (error) {
                    setError((error as Error).message);
                  }
                }}
              >
                删除
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!assets.length && <p className="empty">暂无图片。上传的图片保存在持久化目录中。</p>}
    </>
  );
}
