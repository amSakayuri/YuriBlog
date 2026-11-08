'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export function Login({ setupAvailable }: { setupAvailable: boolean }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [setup, setSetup] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const values = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const response = await fetch(setup ? '/api/auth/setup' : '/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.get('username'),
          password: values.get('password'),
          ...(setup ? { name: values.get('name') } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '暂时无法登录，请重试');
      router.replace('/admin');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : '暂时无法登录，请重试');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <main className="login-page" id="main-content">
      <div className="login-panel">
        <Link href="/" className="wordmark">
          Yuri Blog
        </Link>
        <h1>{setup ? '创建首位管理员' : '管理后台'}</h1>
        <p className="muted">使用管理员账号，继续管理你的内容。</p>
        <form method="post" action="/api/auth" onSubmit={submit} aria-busy={pending}>
          {setup && (
            <label>
              显示名称
              <input name="name" required maxLength={100} disabled={pending} />
            </label>
          )}
          <label htmlFor="login-username">用户名</label>
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
            required
            disabled={pending}
          />
          <label htmlFor="login-password">密码</label>
          <div className="login-password">
            <input
              id="login-password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={200}
              minLength={setup ? 12 : 1}
              required
              disabled={pending}
              onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              onBlur={() => setCapsLock(false)}
            />
            <button
              className="login-reveal"
              type="button"
              aria-label={visible ? '隐藏密码' : '显示密码'}
              aria-pressed={visible}
              aria-controls="login-password"
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {capsLock && (
            <p className="muted" role="status">
              大写锁定已开启
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-default" type="submit" disabled={pending}>
            <LogIn size={18} />
            {pending ? '正在处理…' : setup ? '创建并登录' : '登录后台'}
          </button>
        </form>
        {
          <button
            type="button"
            className="text-button"
            disabled={pending || !setupAvailable}
            title={setupAvailable ? '首次创建管理员' : '已有管理员，请登录后在用户与权限中添加账户'}
            onClick={() => {
              setSetup(!setup);
              setError('');
            }}
          >
            {setup ? '返回登录' : '添加管理员'}
          </button>
        }
        <p className="login-help muted">
          {setupAvailable
            ? '首次配置：仅在没有管理员账户时开放创建。'
            : '仅限管理员。忘记密码请通过服务器管理命令重置。'}
        </p>
      </div>
    </main>
  );
}
