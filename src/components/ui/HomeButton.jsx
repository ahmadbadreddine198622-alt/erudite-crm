import React from 'react';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LiquidGlassIcon from '@/components/ui/LiquidGlassIcon';

export default function HomeButton() {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <LiquidGlassIcon
        icon={Home}
        gradient="from-amber-500 to-amber-700"
        size={64}
        iconSize={28}
        onClick={() => navigate('/')}
      />
    </div>
  );
}