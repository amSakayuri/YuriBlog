'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { RepositoryConfig } from '@/lib/repository';
import { Button } from '@/components/ui/button';
type Preview = {
  localHash: string;
  remoteCommit: string;
  changes: { resource: string; added: number; updated: number; removed: number }[];
  media: { local: number; remote: number };
  settingsChanged: boolean;
};
export function RepositoryManager() {
  const [config, setConfig] = useState<RepositoryConfig>({
    enabled: false,
    remote: '',
    branch: 'main',
    autoPush: false,
  });
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastSync, setLastSync] = useState('');
  async function load() {
    const response = await fetch('/api/admin/repository');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setConfig(data.config);
    setReady(data.credentialsConfigured);
    setLastSync(data.state?.updatedAt ?? '');
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/repository', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        setConfig(data.config);
        setReady(data.credentialsConfigured);
        setLastSync(data.state?.updatedAt ?? '');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setError(error.message);
      });
    return () => controller.abort();
  }, []);
  async function request(method: string, body: unknown) {
    const response = await fetch('/api/admin/repository', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await request('PUT', config);
      setPreview(null);
      setMessage('仓库设置已保存');
      await load();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function synchronize(action: 'push' | 'preview' | 'pull') {
    if (
      action === 'pull' &&
      !confirm('按预览替换本地内容、图片记录和站点设置；本地独有内容将被删除。确定继续？')
    )
      return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const data = await request('POST', {
        action,
        ...(action === 'pull' && preview
          ? { expected: { localHash: preview.localHash, remoteCommit: preview.remoteCommit } }
          : {}),
      });
      if (action === 'preview') setPreview(data);
      else {
        setPreview(null);
        setMessage(
          data.unchanged
            ? '内容一致，无需推送'
            : action === 'push'
              ? '内容与图片已推送'
              : '远端内容已导入，前台已刷新',
        );
        await load();
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <h1>内容仓库</h1>
      <p className="muted">
        通过专用GitHub仓库同步文章、小说、章节、图片及公开站点设置。登录账户、密码和操作日志不会上传。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form className="settings-form" onSubmit={save}>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) => setConfig({ ...config, enabled: event.target.checked })}
          />
          启用仓库同步
        </label>
        <label>
          SSH仓库地址
          <input
            placeholder="git@github.com:owner/content.git"
            value={config.remote}
            onChange={(event) => setConfig({ ...config, remote: event.target.value })}
          />
        </label>
        <label>
          分支
          <input
            value={config.branch}
            onChange={(event) => setConfig({ ...config, branch: event.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.autoPush}
            onChange={(event) => setConfig({ ...config, autoPush: event.target.checked })}
          />
          内容变化后自动推送（需要worker运行）
        </label>
        <p className="muted">
          {ready ? '服务器部署密钥路径已配置。' : '服务器尚未配置部署密钥与known_hosts文件。'}{' '}
          请使用专用内容仓库，并先保存设置。首次推送会包含草稿和图片。
        </p>
        <Button disabled={pending}>保存设置</Button>
      </form>
      <div className="actions">
        <Button disabled={pending || !config.enabled} onClick={() => synchronize('push')}>
          推送本地内容
        </Button>
        <Button
          variant="outline"
          disabled={pending || !config.enabled}
          onClick={() => synchronize('preview')}
        >
          预览远端变更
        </Button>
      </div>
      {pending && <p role="status">正在与仓库通信，请勿重复操作…</p>}
      {lastSync && <p className="muted">最近同步：{new Date(lastSync).toLocaleString()}</p>}
      {preview && (
        <section>
          <h2>拉取预览</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>资源</th>
                  <th>新增</th>
                  <th>更新</th>
                  <th>删除</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((row) => (
                  <tr key={row.resource}>
                    <td>{row.resource}</td>
                    <td>{row.added}</td>
                    <td>{row.updated}</td>
                    <td>{row.removed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            图片：本地{preview.media.local}项，远端{preview.media.remote}项。
            {preview.settingsChanged ? '站点与评论设置将更新。' : '站点设置一致。'}
          </p>
          <Button disabled={pending} onClick={() => synchronize('pull')}>
            确认拉取并替换
          </Button>
        </section>
      )}
    </>
  );
}
