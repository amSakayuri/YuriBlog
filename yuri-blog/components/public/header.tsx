'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor, Search, Languages, Rss } from 'lucide-react';
import { Button } from '@/components/ui/button';
type Nav = { id: string; title: string; titleEn: string; href: string; external: boolean };
export function Header({
  title,
  items,
  language,
  translationHref,
  logo,
}: {
  title: string;
  items: Nav[];
  language: string;
  translationHref?: string;
  logo?: string;
}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const en = language === 'en';
  const prefix = en ? '/en' : '';
  return (
    <header className="site-header">
      <Link href={prefix || '/'} className="wordmark">
        {/* eslint-disable-next-line @next/next/no-img-element -- Logo comes from CMS configuration. */}
        {logo && <img className="site-logo" src={logo} alt="" />}
        {title}
      </Link>
      <nav aria-label={en ? 'Main navigation' : '主导航'}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.external ? item.href : prefix + item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            aria-current={!item.external && pathname === prefix + item.href ? 'page' : undefined}
          >
            {en ? item.titleEn || item.title : item.title}
          </Link>
        ))}
      </nav>
      <div className="header-tools">
        <Link href={`${prefix}/search`} aria-label={en ? 'Search' : '搜索'}>
          <Search size={18} />
        </Link>
        <Link href={`${prefix}/feed.xml`} aria-label="RSS">
          <Rss size={17} />
        </Link>
        <Link
          href={
            translationHref ??
            (en ? pathname.replace(/^\/en/, '') || '/' : `/en${pathname === '/' ? '' : pathname}`)
          }
          aria-label={en ? '中文' : 'English'}
        >
          <Languages size={18} />
        </Link>
        <Button
          variant="ghost"
          aria-label={en ? 'Switch theme' : '切换主题'}
          onClick={() =>
            setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')
          }
        >
          <Sun className="theme-sun" size={18} />
          <Moon className="theme-moon" size={18} />
          <Monitor className="theme-system" size={18} />
        </Button>
      </div>
    </header>
  );
}
