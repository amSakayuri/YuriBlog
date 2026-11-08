import Link from 'next/link';
type Chapter = { id: string; title: string; slug: string };
type Relation = {
  id: string;
  sourceChapterId: string;
  targetChapterId: string;
  type: string;
  label: string;
  description: string;
};
const types = [
  'RELATED',
  'REFERENCE',
  'FORESHADOWING',
  'PAYOFF',
  'SAME_ARC',
  'PARALLEL',
  'FLASHBACK',
  'ALTERNATE_PERSPECTIVE',
];
const colors = [
  '#637e65',
  '#647e9c',
  '#a7793b',
  '#95694d',
  '#7d7498',
  '#538b89',
  '#a27083',
  '#8e8847',
];
export function RelationGraph({
  chapters,
  relations,
  base,
}: {
  chapters: Chapter[];
  relations: Relation[];
  base: string;
}) {
  if (!relations.length) return <p className="muted">暂无作者配置的章节关系。</p>;
  const included = new Set(relations.flatMap((r) => [r.sourceChapterId, r.targetChapterId]));
  const nodes = chapters.filter((c) => included.has(c.id));
  const width = 720,
    height = Math.max(260, nodes.length * 65);
  const positions = new Map(
    nodes.map((chapter, index) => [chapter.id, { x: index % 2 ? 520 : 170, y: 50 + index * 60 }]),
  );
  return (
    <div className="relation-graph">
      <svg role="img" aria-label="作者配置的章节关系图" viewBox={`0 0 ${width} ${height}`}>
        <title>章节关系</title>
        {relations.map((relation) => {
          const source = positions.get(relation.sourceChapterId),
            target = positions.get(relation.targetChapterId);
          if (!source || !target) return null;
          return (
            <g key={relation.id}>
              <path
                d={`M ${source.x} ${source.y} Q 360 ${(source.y + target.y) / 2} ${target.x} ${target.y}`}
                fill="none"
                stroke={colors[types.indexOf(relation.type)]}
                strokeWidth="1.6"
                strokeDasharray={
                  ['REFERENCE', 'FLASHBACK', 'PARALLEL'].includes(relation.type) ? '6 4' : undefined
                }
              >
                <title>{`${relation.type} ${relation.description}`}</title>
              </path>
            </g>
          );
        })}
        {nodes.map((chapter) => {
          const point = positions.get(chapter.id)!;
          return (
            <a href={`${base}/${chapter.slug}`} key={chapter.id}>
              <rect x={point.x - 140} y={point.y - 18} width={280} height={36} rx="6" />
              <text x={point.x} y={point.y + 5} textAnchor="middle">
                {chapter.title.length > 18 ? chapter.title.slice(0, 18) + '…' : chapter.title}
              </text>
            </a>
          );
        })}
      </svg>
      <ul>
        {relations.map((relation) => (
          <li key={relation.id}>
            <Link href={`${base}/${chapters.find((c) => c.id === relation.sourceChapterId)?.slug}`}>
              {chapters.find((c) => c.id === relation.sourceChapterId)?.title}
            </Link>{' '}
            →{' '}
            <Link href={`${base}/${chapters.find((c) => c.id === relation.targetChapterId)?.slug}`}>
              {chapters.find((c) => c.id === relation.targetChapterId)?.title}
            </Link>
            <span className="badge">{relation.label || relation.type}</span>
            {relation.description && <p>{relation.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
