/**
 * Single source of truth for project → color mapping.
 */

const PROJECT_COLOR_MAP = [
  { keywords: ['peninsula 1', 'peninsula one', 'peninsula1'],   classes: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  { keywords: ['peninsula 2', 'peninsula two', 'peninsula2'],   classes: 'bg-teal-500/10 text-teal-700 border-teal-500/20' },
  { keywords: ['peninsula 3', 'peninsula three', 'peninsula3'], classes: 'bg-green-500/10 text-green-700 border-green-500/20' },
  { keywords: ['peninsula 4', 'peninsula four', 'peninsula4'],  classes: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  { keywords: ['peninsula 5', 'peninsula five', 'peninsula5'],  classes: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  { keywords: ['jumeirah living'],                               classes: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  { keywords: ['six senses'],                                    classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  { keywords: ['marina gate'],                                   classes: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' },
  { keywords: ['the edge a', 'edge a'],                         classes: 'bg-red-500/10 text-red-700 border-red-500/20' },
  { keywords: ['the edge b', 'edge b'],                         classes: 'bg-pink-500/10 text-pink-700 border-pink-500/20' },
];

const FALLBACK_CLASSES = 'bg-slate-500/10 text-slate-600 border-slate-500/20';

export function getProjectColorClasses(projectName) {
  if (!projectName) return FALLBACK_CLASSES;
  const lower = projectName.toLowerCase();
  for (const entry of PROJECT_COLOR_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.classes;
  }
  return FALLBACK_CLASSES;
}

export function ProjectBadge({ name }) {
  if (!name) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${getProjectColorClasses(name)}`}>
      {name}
    </span>
  );
}