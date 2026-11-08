import './globals.css';
// The package exports only its combined family; explicit files select the four used weights.
import '../../node_modules/harmonyos-sans-sc-webfont-splitted/dist/Regular.css';
import '../../node_modules/harmonyos-sans-sc-webfont-splitted/dist/Medium.css';
import '../../node_modules/harmonyos-sans-sc-webfont-splitted/dist/Semibold.css';
import '../../node_modules/harmonyos-sans-sc-webfont-splitted/dist/Bold.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import 'katex/dist/katex.min.css';
import '@/styles/public-typography.css';
import '@/styles/public-motion.css';
import '@/styles/reading.css';
import { getSettings } from '@/lib/settings';
import { Providers } from '@/components/providers';
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { site } = await getSettings();
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          跳至正文 / Skip to content
        </a>
        <Providers defaultTheme={site.defaultTheme}>{children}</Providers>
      </body>
    </html>
  );
}
