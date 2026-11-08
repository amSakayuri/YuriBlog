import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { codeToHtml } from 'shiki';
import type { Root, Element, RootContent } from 'hast';
export interface TocEntry {
  id: string;
  text: string;
  level: number;
}
const extractText = (node: RootContent): string =>
  node.type === 'text'
    ? node.value
    : 'children' in node
      ? node.children.map(extractText).join('')
      : '';
export async function renderMarkdown(source: string) {
  const toc: TocEntry[] = [];
  const used = new Map<string, number>();
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        code: [
          ...(defaultSchema.attributes?.code ?? []),
          ['className', /^language-./, 'math-inline', 'math-display'],
        ],
      },
    })
    .use(rehypeKatex, { strict: 'ignore', trust: false })
    .use(() => async (tree: Root) => {
      async function walk(node: Root | Element) {
        for (let index = 0; index < node.children.length; index++) {
          const child = node.children[index];
          if (child.type !== 'element') continue;
          if (/^h[1-6]$/.test(child.tagName)) {
            const text = extractText(child);
            const base =
              text
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s_-]/gu, '')
                .trim()
                .replace(/\s+/g, '-') || 'section';
            const occurrence = used.get(base) ?? 0;
            used.set(base, occurrence + 1);
            const id = `section-${base}${occurrence ? `-${occurrence}` : ''}`;
            child.properties.id = id;
            if (['h2', 'h3', 'h4'].includes(child.tagName))
              toc.push({ id, text, level: Number(child.tagName[1]) });
          }
          if (child.tagName === 'a' && /^https?:/.test(String(child.properties.href))) {
            child.properties.rel = ['noopener', 'noreferrer'];
          }
          if (child.tagName === 'img') {
            child.properties.loading = 'lazy';
            child.properties.decoding = 'async';
          }
          if (child.tagName === 'pre') {
            const code = child.children.find(
              (c) => c.type === 'element' && c.tagName === 'code',
            ) as Element | undefined;
            if (code) {
              const lang =
                String(
                  (code.properties.className as string[] | undefined)?.find((c) =>
                    c.startsWith('language-'),
                  ) ?? '',
                ).replace('language-', '') || 'text';
              let html;
              try {
                html = await codeToHtml(extractText(code), {
                  lang,
                  themes: { light: 'github-light', dark: 'github-dark' },
                  defaultColor: false,
                });
              } catch {
                html = await codeToHtml(extractText(code), {
                  lang: 'text',
                  themes: { light: 'github-light', dark: 'github-dark' },
                  defaultColor: false,
                });
              }
              node.children[index] = {
                type: 'raw',
                value: `<div class="code-block"><div class="code-toolbar"><span>${lang.replace(/[^a-zA-Z0-9+#.-]/g, '')}</span><button type="button" class="copy-code" aria-label="Copy code">Copy</button></div>${html}</div>`,
              } as unknown as RootContent;
              continue;
            }
          }
          await walk(child);
          if (child.tagName === 'p' && child.children.length === 1) {
            const image = child.children[0];
            if (image.type === 'element' && image.tagName === 'img')
              node.children[index] = {
                type: 'element',
                tagName: 'figure',
                properties: {},
                children: [
                  image,
                  ...(image.properties.alt
                    ? [
                        {
                          type: 'element' as const,
                          tagName: 'figcaption',
                          properties: {},
                          children: [
                            { type: 'text' as const, value: String(image.properties.alt) },
                          ],
                        },
                      ]
                    : []),
                ],
              };
          }
        }
      }
      await walk(tree);
    })
    .use(rehypeStringify, { allowDangerousHtml: true });
  return { html: String(await processor.process(source)), toc };
}
