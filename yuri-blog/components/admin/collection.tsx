'use client';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useTheme } from 'next-themes';
import { Plus, Save, Eye, Trash2, GripVertical, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fields, type Field } from './fields';
import { resourceNames, type Resource } from '@/lib/validation';
type Row = Record<string, unknown> & { id: string };
type Options = { tags: Row[]; categories: Row[]; novels: Row[]; volumes: Row[]; chapters: Row[] };
async function jsonRequest(url: string, method = 'GET', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '请求失败');
  return data;
}
function initial(resource: Resource, novelId?: string) {
  return Object.fromEntries(
    fields[resource].map((field) => [
      field.key,
      field.key === 'novelId' && novelId
        ? novelId
        : field.type === 'boolean'
          ? field.key === 'visible'
          : field.type === 'number'
            ? 0
            : field.type === 'list' || field.type === 'tags'
              ? []
              : field.key === 'language'
                ? 'zh'
                : field.key === 'status'
                  ? 'DRAFT'
                  : field.type === 'select' && field.options
                    ? field.options[0]
                    : '',
    ]),
  );
}
function toForm(row: Record<string, unknown>) {
  return {
    ...row,
    ...(row.publishedAt
      ? {
          publishedAt: new Date(String(row.publishedAt))
            .toLocaleString('sv-SE')
            .replace(' ', 'T')
            .slice(0, 16),
        }
      : { publishedAt: '' }),
  };
}
export function Collection({ resource, novelId }: { resource: Resource; novelId?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Options>({
    tags: [],
    categories: [],
    novels: [],
    volumes: [],
    chapters: [],
  });
  const [current, setCurrent] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetQuery, setTargetQuery] = useState('');
  const [preview, setPreview] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const inFlight = useRef(false);
  const { resolvedTheme } = useTheme();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { isDirty },
  } = useForm<Record<string, unknown>>({ defaultValues: initial(resource, novelId) });
  const values = watch();
  const load = useCallback(async () => {
    try {
      setRows(await jsonRequest(`/api/admin/${resource}${novelId ? `?novelId=${novelId}` : ''}`));
    } catch (error) {
      setError((error as Error).message);
    }
  }, [resource, novelId]);
  useEffect(() => {
    void load();
    async function fetchOptions() {
      const keys = ['tags', 'categories', 'novels', 'volumes', 'chapters'] as const;
      const data = await Promise.all(
        keys.map((key) => jsonRequest(`/api/admin/${key}`).catch(() => [])),
      );
      setOptions(Object.fromEntries(keys.map((key, index) => [key, data[index]])) as Options);
    }
    void fetchOptions();
  }, [load]);
  useEffect(() => {
    if (!isDirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    function navigate(event: MouseEvent) {
      const link = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (
        !link ||
        link.target === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        new URL(link.href).pathname === location.pathname
      )
        return;
      if (!confirm('有未保存的修改，确定离开当前编辑吗？')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', navigate, true);
    };
  }, [isDirty]);
  const save = useCallback(
    async (data: Record<string, unknown>, autosave = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setError('');
      try {
        const payload = { ...data };
        for (const key of ['volumeId', 'categoryId', 'translationKey'])
          if (key in payload && !payload[key]) payload[key] = null;
        payload.publishedAt = data.publishedAt
          ? new Date(String(data.publishedAt)).toISOString()
          : null;
        const record = await jsonRequest(
          `/api/admin/${resource}${current ? `?id=${current.id}` : ''}`,
          current ? 'PUT' : 'POST',
          payload,
        );
        setCurrent(record);
        // An autosave response must not replace typing that happened while the request was in flight.
        if (JSON.stringify(getValues()) === JSON.stringify(data)) reset(toForm(record));
        setMessage(autosave ? '草稿已自动保存' : '已保存');
        await load();
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setSaving(false);
        inFlight.current = false;
      }
    },
    [current, resource, reset, load, getValues],
  );
  useEffect(() => {
    if (
      !editing ||
      !isDirty ||
      !current ||
      values.status !== 'DRAFT' ||
      !['articles', 'essays', 'chapters', 'pages', 'projects'].includes(resource)
    )
      return;
    const timer = setTimeout(() => {
      void save(getValues(), true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [values, editing, isDirty, current, resource, save, getValues]);
  useEffect(() => {
    if (!editing || !fields[resource].some((field) => field.type === 'markdown')) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/markdown', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: String(values.content ?? '') }),
      })
        .then(async (response) => {
          if (response.ok) setPreview((await response.json()).html);
        })
        .catch(() => {});
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [editing, resource, values.content]);
  async function remove(row: Row) {
    if (
      !confirm(
        `确定删除“${String(row.title ?? row.name ?? row.id)}”？${resource === 'novels' ? '其卷、章节和关系也将被删除。' : ''}`,
      )
    )
      return;
    try {
      await jsonRequest(`/api/admin/${resource}?id=${row.id}`, 'DELETE');
      setMessage('已删除');
      await load();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function edit(row: Row | null) {
    if (isDirty && !confirm('有未保存的修改，确定离开当前编辑吗？')) return;
    setError('');
    setMessage('');
    setPreview('');
    setCurrent(row);
    reset(row ? toForm(row) : initial(resource, novelId));
    setEditing(true);
  }
  function fieldOptions(field: Field) {
    const selectedNovel = String(values.novelId ?? novelId ?? '');
    if (field.key === 'categoryId') return options.categories;
    if (field.key === 'novelId') return options.novels;
    if (field.key === 'volumeId') return options.volumes.filter((v) => v.novelId === selectedNovel);
    if (['sourceChapterId', 'targetChapterId'].includes(field.key))
      return options.chapters.filter(
        (c) =>
          c.novelId === selectedNovel &&
          (field.key === 'sourceChapterId' ||
            !targetQuery ||
            String(c.title).includes(targetQuery) ||
            c.id === values.targetChapterId),
      );
    return [];
  }
  async function insertImage(file: File) {
    try {
      const data = new FormData();
      data.append('files', file);
      const result = await fetch('/api/admin/media', { method: 'POST', body: data });
      const assets = await result.json();
      if (!result.ok) throw new Error(assets.error);
      setValue(
        'content',
        `${getValues('content') ?? ''}\n\n![${file.name.replace(/[\[\]]/g, '')}](${assets[0].storagePath})\n`,
        { shouldDirty: true },
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const visibleRows = rows.filter(
    (row) =>
      (!query ||
        String(row.title ?? row.name ?? '')
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!filter || row.status === filter),
  );
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{resourceNames[resource]}管理</h1>
          <p className="muted">
            {rows.length} 条记录{novelId ? ' · 当前小说' : ''}
          </p>
        </div>
        <div className="actions">
          {(['articles', 'essays', 'novels'].includes(resource) ||
            (resource === 'chapters' && novelId)) && (
            <label className="button button-outline">
              {importing ? '正在导入…' : '导入Markdown'}
              <input
                type="file"
                accept=".md,.markdown,text/markdown"
                className="sr-only"
                disabled={importing}
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (!file) return;
                  if (isDirty && !confirm(`有未保存的修改，继续导入新${resourceNames[resource]}？`))
                    return;
                  setError('');
                  setImporting(true);
                  try {
                    const body = new FormData();
                    body.append('file', file);
                    if (novelId) body.append('novelId', novelId);
                    const response = await fetch(`/api/admin/${resource}/import`, {
                      method: 'POST',
                      body,
                    });
                    const article = await response.json();
                    if (!response.ok) throw new Error(article.error);
                    reset(toForm(article));
                    setCurrent(article);
                    setEditing(true);
                    setMessage(
                      resource === 'novels'
                        ? '小说已创建为草稿，正文已保存为首章草稿；请进入章节管理检查后发布'
                        : 'Markdown已导入草稿，请检查图片链接与元信息后发布',
                    );
                    await load();
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setImporting(false);
                  }
                }}
              />
            </label>
          )}
          <Button onClick={() => edit(null)}>
            <Plus size={17} />
            新建{resourceNames[resource]}
          </Button>
        </div>
      </div>
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
      {editing ? (
        <div className="editor-layout">
          <form className="editor-form" onSubmit={handleSubmit((data) => save(data))}>
            <div className="editor-toolbar">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!isDirty || confirm('放弃未保存的修改？')) {
                    setEditing(false);
                    reset(initial(resource, novelId));
                  }
                }}
              >
                返回列表
              </Button>
              <div className="actions">
                {current && (
                  <Link
                    href={`/preview/${resource}/${current.id}`}
                    target="_blank"
                    className="button button-outline"
                  >
                    <Eye size={16} />
                    真实页面预览
                  </Link>
                )}
                <Button disabled={saving}>
                  <Save size={16} />
                  {saving ? '正在保存…' : '保存'}
                </Button>
              </div>
            </div>
            {resource === 'relations' && (
              <label>
                搜索关联章节
                <input
                  value={targetQuery}
                  onChange={(event) => setTargetQuery(event.target.value)}
                  placeholder="输入章节标题"
                />
              </label>
            )}
            {fields[resource].map((field) =>
              field.type === 'markdown' ? (
                <div className="markdown-field" key={field.key}>
                  <div className="section-heading">
                    <label htmlFor="markdown-editor">{field.label}</label>
                    <div className="actions">
                      <label className="button button-outline">
                        <ImagePlus size={16} />
                        插入图片
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          hidden
                          onChange={(e) => {
                            if (e.target.files?.[0]) void insertImage(e.target.files[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            setPreview(
                              (
                                await jsonRequest('/api/markdown', 'POST', {
                                  content: String(values.content ?? ''),
                                })
                              ).html,
                            );
                          } catch (error) {
                            setError((error as Error).message);
                          }
                        }}
                      >
                        更新预览
                      </Button>
                    </div>
                  </div>
                  <CodeMirror
                    id="markdown-editor"
                    value={String(values[field.key] ?? '')}
                    height="460px"
                    extensions={[markdown()]}
                    theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                    onChange={(value) => setValue(field.key, value, { shouldDirty: true })}
                  />
                  <p className="muted">
                    草稿首次手动保存后，停止输入 4
                    秒自动保存。已发布内容需手动保存。支持撤销、重做、表格、代码与公式。
                  </p>
                </div>
              ) : field.type === 'boolean' ? (
                <label className="checkbox-label" key={field.key}>
                  <input type="checkbox" {...register(field.key)} />
                  {field.label}
                </label>
              ) : field.type === 'tags' ? (
                <fieldset key={field.key}>
                  <legend>{field.label}</legend>
                  <div className="tag-row">
                    {options.tags.map((tag) => (
                      <label className="checkbox-label" key={tag.id}>
                        <input type="checkbox" value={tag.id} {...register('tagIds')} />
                        {String(tag.name)}
                      </label>
                    ))}
                  </div>
                  {!options.tags.length && <Link href="/admin/tags">先创建标签 →</Link>}
                </fieldset>
              ) : (
                <label key={field.key}>
                  {field.label}
                  {field.required ? ' *' : ''}
                  {field.type === 'textarea' ? (
                    <textarea rows={4} {...register(field.key)} />
                  ) : field.type === 'list' ? (
                    <textarea
                      rows={4}
                      value={((values[field.key] as string[]) ?? []).join('\n')}
                      onChange={(event) =>
                        setValue(field.key, event.target.value.split('\n'), { shouldDirty: true })
                      }
                    />
                  ) : field.type === 'select' ? (
                    <select
                      required={field.required}
                      {...register(field.key)}
                      onChange={(event) => {
                        setValue(field.key, event.target.value, { shouldDirty: true });
                        if (field.key === 'novelId') {
                          setValue('volumeId', '');
                          setValue('sourceChapterId', '');
                          setValue('targetChapterId', '');
                        }
                      }}
                    >
                      {!field.options && <option value="">请选择 / 无</option>}
                      {field.options
                        ? field.options.map((option) => <option key={option}>{option}</option>)
                        : fieldOptions(field).map((row) => (
                            <option key={row.id} value={row.id}>
                              {String(row.title ?? row.name)}
                            </option>
                          ))}
                    </select>
                  ) : (
                    <input
                      required={field.required}
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'datetime'
                            ? 'datetime-local'
                            : 'text'
                      }
                      min={field.type === 'number' ? 0 : undefined}
                      {...register(field.key, {
                        ...(field.type === 'number' ? { valueAsNumber: true } : {}),
                      })}
                    />
                  )}
                </label>
              ),
            )}
            <Button disabled={saving}>
              <Save size={16} />
              保存{resourceNames[resource]}
            </Button>
          </form>
          {preview && (
            <aside className="editor-preview">
              <h2>正文预览</h2>
              <div className="prose" dangerouslySetInnerHTML={{ __html: preview }} />
            </aside>
          )}
        </div>
      ) : (
        <>
          <div className="collection-tools">
            <input
              aria-label="搜索内容"
              placeholder="搜索标题…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {rows.some((row) => row.status) && (
              <select
                aria-label="筛选状态"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="">全部状态</option>
                {[...new Set(rows.map((row) => String(row.status)))].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            )}
            {selected.length > 0 && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm(`确定删除选中的 ${selected.length} 条记录？`)) return;
                  try {
                    for (const id of selected)
                      await jsonRequest(`/api/admin/${resource}?id=${id}`, 'DELETE');
                    setSelected([]);
                    await load();
                    setMessage('批量删除完成');
                  } catch (error) {
                    setError((error as Error).message);
                  }
                }}
              >
                删除 {selected.length} 条
              </Button>
            )}
            {selected.length > 0 &&
              ['articles', 'essays', 'projects', 'chapters', 'pages'].includes(resource) &&
              (['PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  onClick={async () => {
                    if (!confirm(`确定将 ${selected.length} 条内容设为 ${status}？`)) return;
                    try {
                      for (const id of selected) {
                        const row = rows.find((item) => item.id === id)!;
                        await jsonRequest(`/api/admin/${resource}?id=${id}`, 'PUT', {
                          ...row,
                          status,
                          publishedAt:
                            status === 'PUBLISHED' ? new Date().toISOString() : row.publishedAt,
                        });
                      }
                      setSelected([]);
                      await load();
                      setMessage('批量状态更新完成');
                    } catch (error) {
                      setError((error as Error).message);
                    }
                  }}
                >
                  {status === 'PUBLISHED'
                    ? '批量发布'
                    : status === 'DRAFT'
                      ? '取消发布'
                      : '批量归档'}
                </Button>
              ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="全选"
                      checked={
                        visibleRows.length > 0 && visibleRows.every((r) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(e.target.checked ? visibleRows.map((row) => row.id) : [])
                      }
                    />
                  </th>
                  <th>标题 / 名称</th>
                  <th>状态</th>
                  <th>更新 / 顺序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    draggable={!!novelId && ['chapters', 'volumes'].includes(resource)}
                    onDragStart={() => setDragged(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async () => {
                      if (!dragged || dragged === row.id || !novelId) return;
                      const ordered = [...rows];
                      const from = ordered.findIndex((item) => item.id === dragged);
                      const [item] = ordered.splice(from, 1);
                      ordered.splice(
                        ordered.findIndex((item) => item.id === row.id),
                        0,
                        item,
                      );
                      try {
                        await jsonRequest('/api/admin/reorder', 'POST', {
                          resource,
                          novelId,
                          ids: ordered.map((item) => item.id),
                        });
                        await load();
                      } catch (error) {
                        setError((error as Error).message);
                      }
                    }}
                  >
                    <td>
                      <input
                        aria-label={`选择 ${row.title ?? row.name}`}
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? [...selected, row.id]
                              : selected.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      {novelId && ['chapters', 'volumes'].includes(resource) && (
                        <GripVertical size={14} />
                      )}
                      <button className="text-button" onClick={() => edit(row)}>
                        {String(row.title ?? row.name ?? `${row.type ?? ''} ${row.label ?? ''}`)}
                      </button>
                      <small>{String(row.slug ?? '')}</small>
                      {!!row._count && (
                        <small>
                          关联内容{' '}
                          {Object.values(row._count as Record<string, number>).reduce(
                            (total, count) => total + count,
                            0,
                          )}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className="badge">{String(row.status ?? '—')}</span>
                    </td>
                    <td>
                      {row.order !== undefined
                        ? String(row.order)
                        : row.updatedAt
                          ? new Date(String(row.updatedAt)).toLocaleDateString()
                          : '—'}
                    </td>
                    <td>
                      <div className="actions">
                        <Button variant="ghost" onClick={() => edit(row)}>
                          编辑
                        </Button>
                        {resource === 'novels' && (
                          <Link href={`/admin/novels/${row.id}`} className="button button-outline">
                            卷与章节
                          </Link>
                        )}
                        <Button variant="ghost" aria-label="删除" onClick={() => remove(row)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length && (
              <p className="empty">暂无记录。创建第一条{resourceNames[resource]}。</p>
            )}
          </div>
          {novelId && ['chapters', 'volumes'].includes(resource) && (
            <p className="muted">拖动行可排序；也可编辑“顺序”字段，支持键盘操作。</p>
          )}
        </>
      )}
    </>
  );
}
