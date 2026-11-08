'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { PanelLeft, LogOut, ExternalLink, SunMoon } from 'lucide-react';
import { Button } from '@/components/ui/button';
const links = [
  ['', '概览'],
  ['articles', '文章'],
  ['novels', '小说'],
  ['essays', '散文'],
  ['projects', '项目'],
  ['media', '媒体库'],
  ['tags', '标签'],
  ['categories', '分类'],
  ['pages', '页面'],
  ['navigation', '导航'],
  ['giscus', 'Giscus 评论'],
  ['settings', '网站设置'],
  ['repository', '内容仓库'],
  ['users', '用户与权限'],
  ['audit-logs', '操作日志'],
];
function subscribeViewport(callback: () => void) {
  const media = window.matchMedia('(max-width: 700px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
export function AdminShell({
  children,
  name,
  role,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeViewport,
    () => window.matchMedia('(max-width: 700px)').matches,
    () => false,
  );
  const navigationVisible = mobile ? collapsed : !collapsed;
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  return (
    <div className={`admin-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar" id="admin-navigation-sidebar">
        <Link href="/admin" className="wordmark">
          Yuri Blog <span>CMS</span>
        </Link>
        <nav aria-label="后台导航">
          {links
            .filter(
              ([key]) =>
                role === 'SUPER_ADMIN' ||
                (role === 'ADMIN'
                  ? !['users', 'repository'].includes(key)
                  : ![
                      'navigation',
                      'giscus',
                      'settings',
                      'users',
                      'audit-logs',
                      'repository',
                    ].includes(key)),
            )
            .map(([key, label]) => (
              <Link
                key={key}
                href={`/admin${key ? `/${key}` : ''}`}
                aria-current={pathname === `/admin${key ? `/${key}` : ''}` ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
        </nav>
        <Link href="/" className="view-site">
          查看网站 <ExternalLink size={14} />
        </Link>
      </aside>
      <div className="admin-workspace">
        <header className="admin-toolbar">
          <Button
            variant="ghost"
            aria-label={navigationVisible ? '收起导航' : '展开导航'}
            aria-expanded={navigationVisible}
            aria-controls="admin-navigation-sidebar"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeft size={19} />
          </Button>
          <span>
            {name} <small>{role}</small>
          </span>
          <div className="actions">
            <Button
              variant="ghost"
              aria-label="切换主题"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <SunMoon size={18} />
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const result = await fetch('/api/auth', { method: 'DELETE' });
                if (result.ok) {
                  router.push('/admin/login');
                  router.refresh();
                }
              }}
            >
              <LogOut size={16} />
              退出
            </Button>
          </div>
        </header>
        <main id="main-content" className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
