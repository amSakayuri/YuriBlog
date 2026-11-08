'use client';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  active: boolean;
};
export function Users() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(values)),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      form.reset();
      setMessage('用户已创建');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }
  async function load() {
    const response = await fetch('/api/admin/users');
    const data = await response.json();
    if (response.ok) setUsers(data);
    else setError(data.error);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/users', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setUsers(data);
        else setError(data.error);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setError('无法读取用户');
      });
    return () => controller.abort();
  }, []);
  async function update(user: User, patch: Partial<User>) {
    if (!confirm(`确定修改 ${user.name} 的权限/状态？当前会话将失效。`)) return;
    const result = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, ...patch }),
    });
    if (!result.ok) setError((await result.json()).error);
    else {
      setMessage('权限已更新');
      if (patch.username) router.refresh();
      await load();
    }
  }
  return (
    <>
      <h1>用户与权限</h1>
      <p className="muted">仅超级管理员可创建账户及管理权限。使用用户名和密码登录，不开放注册。</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>用户名</th>
              <th>角色</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>
                  {user.username}{' '}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      const username = prompt(
                        '新的用户名（3–40位字母、数字、下划线或短横线）',
                        user.username,
                      );
                      if (username && username !== user.username) update(user, { username });
                    }}
                  >
                    修改
                  </button>
                </td>
                <td>
                  <select
                    aria-label={`${user.name} 角色`}
                    value={user.role}
                    onChange={(event) => update(user, { role: event.target.value })}
                  >
                    {['SUPER_ADMIN', 'ADMIN', 'EDITOR'].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <Button variant="outline" onClick={() => update(user, { active: !user.active })}>
                    {user.active ? '停用' : '启用'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section>
        <h2>创建用户</h2>
        <form
          className="settings-form"
          method="post"
          action="/api/admin/users"
          onSubmit={createUser}
        >
          <label>
            名称
            <input name="name" required maxLength={100} disabled={creating} />
          </label>
          <label>
            用户名
            <input
              name="username"
              type="text"
              autoComplete="off"
              required
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
              disabled={creating}
            />
          </label>
          <label>
            初始密码（至少 12 位）
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={200}
              required
              disabled={creating}
            />
          </label>
          <label>
            角色
            <select name="role" defaultValue="EDITOR" disabled={creating}>
              {['EDITOR', 'ADMIN', 'SUPER_ADMIN'].map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <Button disabled={creating}>{creating ? '正在创建…' : '创建用户'}</Button>
        </form>
      </section>
    </>
  );
}
