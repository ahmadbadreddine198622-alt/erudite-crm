// EmojiPicker — shared emoji popover used by the Email, WhatsApp, iMessage, Telegram,
// and SMS composers. Renders a Smiley icon button that opens a category-tabbed grid.
//
// Props:
//   onSelect  (fn)      — called with the picked emoji string (caller inserts at cursor)
//   className             — optional extra classes for the trigger button
//
// The caller owns insertion logic (textarea vs ReactQuill) — this component is purely
// the picker UI.

import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Smile, X } from 'lucide-react';

function css(str) {
  const o = {};
  String(str).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

// Curated emoji set by category — keeps the popover compact and relevant for
// landlord/property communication (greetings, thanks, agreement, time, etc.).
const CATEGORIES = [
  {
    key: 'frequent', label: '😀', name: 'Frequent',
    emojis: '😀 😊 😎 🤝 👍 👏 🙏 ✌️ 🤞 💪 🎉 🎊 ✨ ⭐ 🔥 ⚡ ✅ ✔️ 🤝 🙏'.split(' ').filter(Boolean),
  },
  {
    key: 'people', label: '🧑', name: 'People',
    emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😝 🤪 🤨 🧐 🤓 😏 😒 😞 😟 😠 🤬 😢 😥 😭 😅 😓 🤔 🤗 🤭 🤫 🥱 😴 😪 😷 🤒 🤕 🤢 🤮 🥳 🥺 😶 😬 😮 😯 😲 😳 🥵 🥶 😱 😨 😰 😡 😡 👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🙏 🤝 💪 🫶'.split(' ').filter(Boolean),
  },
  {
    key: 'symbols', label: '❤️', name: 'Symbols',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💯 💢 💥 💫 💦 🕊️ ⭐ 🌟 ✨ ⚡ ♨️ 💢 ❌ ⭕ ✅ ✔️ ❎ ➕ ➖ ➗ ✖️ ♾️ ‼️ ⁉️ ❓ ❗ ❓ 〰️ 🔗 🔚 🔙 🔛 🔝 🔜'.split(' ').filter(Boolean),
  },
  {
    key: 'objects', label: '🏠', name: 'Objects',
    emojis: '🏠 🏡 🏢 🏗️ 🏘️ 🏬 🏪 🏨 🏫 🏦 🏥 🏛️ ⛪ 🕌 🕋 ⛩️ 🗼 🗽 🗿 ⛲ 🏠 🔑 🚪 🪟 🛏️ 🛋️ 🪑 🚿 🛁 🚽 🧻 🧼 🧴 🧹 🧺 📱 💻 ⌨️ 🖱️ 💽 💾 💿 📀 📷 📸 🎥 🎬 📺 📻 🎙️ 🎚️ 🎛️ 🎚️'.split(' ').filter(Boolean),
  },
  {
    key: 'time', label: '🕐', name: 'Time',
    emojis: '🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛 🌅 🌄 🌇 🌆 🏙️ 🌃 🌉 🌌 🎆 🎇 🎉 🎊 🍾 🥂 🥳 🎈 🎁 🎀 🎊'.split(' ').filter(Boolean),
  },
];

export default function EmojiPicker({ onSelect, className = '' }) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(0);

  const cat = CATEGORIES[activeCat];

  const handlePick = (emoji) => {
    if (onSelect) onSelect(emoji);
    // Keep the popover open so the user can pick several emojis in a row.
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert emoji"
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all border ${open ? 'bg-amber-500/15 border-amber-500/30' : 'border-transparent hover:bg-white/10'} ${className}`}
        >
          <Smile className="w-3.5 h-3.5" style={{ color: open ? 'hsl(38 92% 62%)' : 'rgba(255,255,255,0.6)' }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;")}>
          <span style={css("font-size:11px; font-weight:700; color:hsl(38 92% 62%); display:flex; align-items:center; gap:5px;")}>
            <Smile size={12} /> Emojis
          </span>
          <button type="button" onClick={() => setOpen(false)} style={css("cursor:pointer; background:none; border:none; color:rgba(255,255,255,0.4);")}>
            <X size={13} />
          </button>
        </div>

        {/* Category tabs */}
        <div style={css("display:flex; align-items:center; gap:2px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px;")}>
          {CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              type="button"
              title={c.name}
              onClick={() => setActiveCat(i)}
              style={{
                ...css("flex:1; display:flex; align-items:center; justify-content:center; padding:3px 0; border-radius:6px; cursor:pointer; background:none; border:none; font-size:14px; transition:background 0.12s ease;"),
                background: i === activeCat ? 'rgba(255,255,255,0.08)' : 'transparent',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div style={css("display:grid; grid-template-columns:repeat(8, 1fr); gap:1px; max-height:160px; overflow-y:auto;")}>
          {cat.emojis.map((emoji, i) => (
            <button
              key={emoji + i}
              type="button"
              onClick={() => handlePick(emoji)}
              style={css("display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; cursor:pointer; background:none; border:none; font-size:16px; line-height:1; transition:background 0.1s ease;")}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}