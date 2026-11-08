'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Collection } from './collection';
import { Button } from '@/components/ui/button';
export function NovelManager({ novelId, title }: { novelId: string; title: string }) {
  const [tab, setTab] = useState<'volumes' | 'chapters' | 'relations'>('chapters');
  return (
    <>
      <Link href="/admin/novels">← 返回小说列表</Link>
      <h1>{title}</h1>
      <div className="tabs" role="tablist" aria-label="小说管理">
        {(
          [
            ['chapters', '章节'],
            ['volumes', '卷'],
            ['relations', '章节关系'],
          ] as const
        ).map(([key, label]) => (
          <Button
            role="tab"
            aria-selected={tab === key}
            variant={tab === key ? 'default' : 'outline'}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
        <a className="button button-outline" href={`/preview/novels/${novelId}`} target="_blank">
          预览小说及关系图
        </a>
      </div>
      <Collection key={tab} resource={tab} novelId={novelId} />
    </>
  );
}
