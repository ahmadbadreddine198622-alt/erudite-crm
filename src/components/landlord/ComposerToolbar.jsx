// ComposerToolbar — shared slim icon-button toolbar for all landlord communication composers.
// HubSpot-style: every action is an icon with a tooltip, no labeled full-width buttons.
import React from 'react';

export function IconButton({ icon: Icon, onClick, disabled, title, active, loading, accentColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-accent/15 border-accent/30'
          : 'border-transparent hover:bg-white/10'
      }`}
      style={accentColor ? { color: accentColor } : undefined}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" style={accentColor ? { color: accentColor } : undefined} />
      )}
    </button>
  );
}

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-white/10 mx-0.5" />;
}

export default function ComposerToolbar({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {children}
    </div>
  );
}