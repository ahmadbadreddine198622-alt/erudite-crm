import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { outlineBtn, GOLD } from '@/lib/academyStyles';
import { CHAMBERS } from '@/lib/academyChambers';
import { Video } from 'lucide-react';

export default function AcademyNav() {
  const { pathname } = useLocation();
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 18 }}>
      <Link to="/academy" style={{
        ...outlineBtn,
        background: pathname === '/academy' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
        border: pathname === '/academy' ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
        color: pathname === '/academy' ? GOLD : 'rgba(255,255,255,0.6)',
      }}>Home</Link>
      <Link to="/training-videos" style={{
        ...outlineBtn,
        background: pathname === '/training-videos' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
        border: pathname === '/training-videos' ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
        color: pathname === '/training-videos' ? GOLD : 'rgba(255,255,255,0.6)',
      }}><Video size={13} />Videos</Link>
      {CHAMBERS.map((c) => {
        const active = pathname === c.to;
        const Icon = c.icon;
        return (
          <Link key={c.to} to={c.to} style={{
            ...outlineBtn,
            background: active ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
            border: active ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
            color: active ? GOLD : 'rgba(255,255,255,0.6)',
          }}>
            {Icon && <Icon size={13} />}
            {c.short}
          </Link>
        );
      })}
    </div>
  );
}