import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { toast } from 'sonner';
import { Loader2, Plus, Play, Pencil, Trash2, Youtube, HardDrive, Filter } from 'lucide-react';
import AcademyNav from '@/components/academy/AcademyNav';
import AddTrainingVideoDialog from '@/components/training/AddTrainingVideoDialog';
import VideoSlidePlayer from '@/components/training/VideoSlidePlayer';
import { parseVideoUrl } from '@/components/training/videoEmbed';
import { pageWrap, card, serif, label, goldBtn, outlineBtn, GOLD, GOLD_LITE } from '@/lib/academyStyles';

export default function TrainingVideos() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editVideo, setEditVideo] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [activeCat, setActiveCat] = useState('All');

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['training-videos'],
    queryFn: async () => {
      const list = await base44.entities.TrainingVideo.list('sort_order', 200);
      return (list || []).filter((v) => v.is_active !== false);
    },
  });

  const categories = useMemo(() => {
    const set = new Set(['All']);
    videos.forEach((v) => { if (v.category) set.add(v.category); });
    return Array.from(set);
  }, [videos]);

  const filtered = useMemo(
    () => activeCat === 'All' ? videos : videos.filter((v) => v.category === activeCat),
    [videos, activeCat],
  );

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.TrainingVideo.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-videos'] });
      toast.success('Video removed');
    },
    onError: (e) => toast.error('Could not delete: ' + e.message),
  });

  const openPlayer = (idx) => setPlayerIndex(idx);

  return (
    <div style={pageWrap}>
      <AcademyNav />

      {/* Header */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ ...label, color: GOLD }}>Erudite Success Academy</p>
          <h1 style={{ ...serif, fontSize: 32, color: GOLD_LITE, margin: '4px 0 0' }}>Training Videos</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 4 }}>
            {filtered.length} video{filtered.length !== 1 ? 's' : ''} · click any card to play the full slide deck
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditVideo(null); setShowAdd(true); }} style={{ ...goldBtn }}>
            <Plus size={16} /> Add Video
          </button>
        )}
      </div>

      {/* Category filter chips */}
      {categories.length > 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'rgba(255,255,255,0.4)', marginRight: 2 }} />
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} style={{
              ...outlineBtn,
              background: activeCat === c ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
              border: activeCat === c ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
              color: activeCat === c ? GOLD : 'rgba(255,255,255,0.6)',
            }}>{c}</button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Loader2 className="animate-spin" style={{ color: GOLD }} size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', marginTop: 18, padding: 48 }}>
          <Youtube size={40} style={{ color: 'rgba(255,255,255,0.2)', margin: '0 auto 12px' }} />
          <p style={{ color: 'rgba(255,255,255,0.55)' }}>No training videos yet.</p>
          {isAdmin && (
            <button onClick={() => { setEditVideo(null); setShowAdd(true); }} style={{ ...goldBtn, marginTop: 16 }}>
              <Plus size={16} /> Add your first video
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginTop: 18 }}>
          {filtered.map((v, idx) => {
            const parsed = parseVideoUrl(v.url);
            return (
              <div key={v.id} style={{ ...card, padding: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)'; e.currentTarget.style.transform = 'none'; }}
                onClick={() => openPlayer(idx)}>
                {/* Thumbnail */}
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
                  {parsed.thumb ? (
                    <img src={parsed.thumb} alt={v.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : parsed.type === 'drive' ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(90,147,224,0.15), rgba(0,0,0,0.4))' }}>
                      <HardDrive size={32} style={{ color: 'rgba(135,178,240,0.6)' }} />
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)' }}>
                      <Youtube size={32} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(212,175,55,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(212,175,55,0.4)' }}>
                      <Play size={22} fill="#1a1205" style={{ color: '#1a1205', marginLeft: 3 }} />
                    </div>
                  </div>
                  {/* Source badge */}
                  <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(0,0,0,0.6)', color: parsed.type === 'youtube' ? '#ff5252' : '#87b2f0', display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)' }}>
                    {parsed.type === 'youtube' ? <Youtube size={11} /> : <HardDrive size={11} />}
                    {parsed.type === 'youtube' ? 'YouTube' : 'Drive'}
                  </span>
                  {v.category && (
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(212,175,55,0.85)', color: '#1a1205' }}>
                      {v.category}
                    </span>
                  )}
                </div>
                {/* Body */}
                <div style={{ padding: 14 }}>
                  <h3 style={{ ...serif, fontSize: 17, color: GOLD_LITE, margin: '0 0 4px', lineHeight: 1.2 }}>{v.title}</h3>
                  {v.description && (
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {v.description}
                    </p>
                  )}
                </div>
                {/* Admin controls */}
                {isAdmin && (
                  <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditVideo(v); setShowAdd(true); }} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD_LITE, cursor: 'pointer' }} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Remove this video?')) deleteMut.mutate(v.id); }} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', cursor: 'pointer' }} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-deck player */}
      {playerIndex !== null && filtered[playerIndex] && (
        <VideoSlidePlayer
          videos={filtered}
          index={playerIndex}
          onIndexChange={(updater) => setPlayerIndex((prev) => (typeof updater === 'function' ? updater(prev) : updater))}
          onClose={() => setPlayerIndex(null)}
        />
      )}

      {/* Add / edit dialog */}
      <AddTrainingVideoDialog open={showAdd} onClose={() => setShowAdd(false)} video={editVideo} />
    </div>
  );
}