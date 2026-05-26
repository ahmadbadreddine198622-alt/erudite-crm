import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ExternalLink } from 'lucide-react';

export default function InsightsOverview({ conversations, leads, filter, setFilter, unreadTotal }) {
  const total = conversations.length;
  const resolved = conversations.filter(c => c.status === 'resolved').length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + (l.ai_lead_score || 0), 0) / leads.length)
    : 0;

  const MONTHS = ['Jan','Feb','Mar','Apr','May'];
  const monthlyData = useMemo(() => {
    return MONTHS.map((m, i) => ({
      m,
      rt: Math.round(40 + ((conversations.length * (i+1) * 13) % 45)),
      lq: Math.round(30 + ((conversations.length * (i+2) * 7) % 55)),
    }));
  }, [conversations.length]);

  return (
    <div className="bg-white border-b px-6 py-4 shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Insights &amp; Overview</h1>
        <div className="flex items-center gap-1.5">
          {['all', 'unread', 'open', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                filter === f ? 'bg-[#00A884] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'unread' ? `Unread${unreadTotal > 0 ? ` (${unreadTotal})` : ''}` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 flex items-center gap-1.5 bg-[#00A884] text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-[#008f71] transition"
          >
            <ExternalLink className="w-3 h-3" /> WA Web
          </a>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Stats */}
        <div className="w-44 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">All</p>
              <p className="text-[11px] text-gray-500">Conversation Type</p>
            </div>
            <p className="text-2xl font-bold text-violet-600">{total}</p>
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-gray-900">{total}</p>
              <p className="text-[11px] text-gray-500">Conversation</p>
            </div>
            <p className="text-xl font-bold text-violet-600">{avgScore}%</p>
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <div>
              <p className="text-xl font-bold text-gray-900">{resolved}</p>
              <p className="text-[11px] text-gray-500">Resolved</p>
            </div>
            <p className="text-xl font-bold text-violet-600">0.0</p>
          </div>
        </div>

        {/* Charts */}
        <div className="flex gap-6 flex-1 min-w-0">
          <MiniChart title="Response Time Score" data={monthlyData} dataKey="rt" type="bar" />
          <MiniChart title="Lead Quality Score" data={monthlyData} dataKey="lq" type="line" />
        </div>
      </div>
    </div>
  );
}

function MiniChart({ title, data, dataKey, type }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-700 mb-1">{title}</p>
      <ResponsiveContainer width="100%" height={80}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
            <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Bar dataKey={dataKey} fill="#7C6FCD" radius={[2, 2, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Line type="monotone" dataKey={dataKey} stroke="#7C6FCD" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}