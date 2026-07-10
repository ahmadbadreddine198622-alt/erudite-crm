import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { outlineBtn, GOLD } from '@/lib/academyStyles';

const LINKS = [
  { to: '/academy', label: 'Home' },
  { to: '/academy/chief-aim', label: 'Chief Aim' },
  { to: '/academy/principles', label: 'Principles' },
  { to: '/academy/reflections', label: 'Reflections' },
  { to: '/academy/mastermind', label: 'Mastermind' },
];

export default function AcademyNav() {
  const { pathname } = useLocation();
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 18 }}>
      {LINKS.map((l) => {
        const active = pathname === l.to;
        return (
          <Link key={l.to} to={l.to} style={{
            ...outlineBtn,
            background: active ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
            border: active ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.1)',
            color: active ? GOLD : 'rgba(255,255,255,0.6)',
          }}>{l.label}</Link>
        );
      })}
    </div>
  );
}