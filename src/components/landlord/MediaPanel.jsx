import React from 'react';
import { ChevronDown, ExternalLink, Trash2, Plus, Save, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/* Convert a CSS declaration string into a React style object (preserves the design 1:1). */
function css(str) {
  const o = {};
  String(str).split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[camel] = v;
  });
  return o;
}

function MediaDrawer({ item, isOpen, onToggle, inputValue, onInputChange, onSave, onRemove, isPhotography = false, photographyStatus, onStatusChange, photographyStatusConfig = {}, photographyUrl }) {
  const Icon = item.icon;
  const hasUrl = !!item.value;
  const statusConfig = isPhotography ? photographyStatusConfig[photographyStatus] || photographyStatusConfig.not_started : null;

  return (
    <div style={css("border-radius:11px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); overflow:hidden;")}>
      {/* Collapsed bar - always visible */}
      <button 
        onClick={onToggle}
        style={css("width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 13px; background:transparent; border:none; cursor:pointer; transition:background 0.15s ease;")}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={css("display:flex; align-items:center; gap:11px; min-width:0;")}>
          <Icon className="w-4 h-4" style={css("color:rgba(255,255,255,0.6);")} />
          <span style={css("font-size:13px; font-weight:600; color:rgba(255,255,255,0.85);")}>{item.label}</span>
        </div>
        <div style={css("display:flex; align-items:center; gap:8px;")}>
          {isPhotography ? (
            <span style={css("display:inline-flex; align-items:center; padding:3px 9px; borderRadius:99px; fontSize:10.5px; fontWeight:700; background:"+statusConfig.bg+"; color:"+statusConfig.color+";")}>
              {photographyUrl && <span style={css("margin-right:4px;")}>✓</span>}
              {statusConfig.label}
            </span>
          ) : (
            <span style={css("display:inline-flex; align-items:center; padding:3px 9px; borderRadius:99px; fontSize:10.5px; fontWeight:700; background:"+ (hasUrl ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.06)')+"; color:"+ (hasUrl ? '#34d399' : 'rgba(255,255,255,0.4)')+";")}>
              {hasUrl ? '✓ Available' : '× Not captured'}
            </span>
          )}
          <ChevronDown className={"w-4 h-4 transition-transform duration-200 " + (isOpen ? 'rotate-180' : '')} style={css("color:rgba(255,255,255,0.4);")} />
        </div>
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div style={css("padding:11px 13px; border-top:1px solid rgba(255,255,255,0.06); animation:ld-fade 0.2s ease-out;")}>
          {isPhotography && (
            <div style={css("margin-bottom:10px;")}>
              <div style={css("font-size:10px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:6px;")}>Status</div>
              <select
                value={photographyStatus}
                onChange={(e) => onStatusChange('media_photography_status', e.target.value)}
                style={css("width:100%; padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); font-size:12px; font-weight:600; cursor:pointer;")}
              >
                <option value="not_started" style={{background:'#1a1205'}}>Not started</option>
                <option value="scheduled" style={{background:'#1a1205'}}>Scheduled</option>
                <option value="shot" style={{background:'#1a1205'}}>Shot</option>
                <option value="delivered" style={{background:'#1a1205'}}>Delivered</option>
              </select>
            </div>
          )}

          {hasUrl ? (
            <div style={css("display:flex; flex-direction:column; gap:8px;")}>
              <div style={css("display:flex; gap:8px;")}>
                <a href={item.value} target="_blank" rel="noopener noreferrer" style={css("display:inline-flex; align-items:center; gap:5px; padding:7px 11px; borderRadius:8px; background:hsl(38 92% 50% / 0.12); border:1px solid hsl(38 92% 50% / 0.3); color:hsl(38 92% 60%); fontSize:11.5px; fontWeight:600; textDecoration:none;")}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </a>
                <button onClick={() => onRemove(item.field)} style={css("display:inline-flex; align-items:center; gap:5px; padding:7px 11px; borderRadius:8px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#f87171; fontSize:11.5px; fontWeight:600; cursor:pointer;")}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
              <div style={css("font-size:11px; color:rgba(255,255,255,0.45); word-break:break-all; background:rgba(255,255,255,0.03); padding:8px 10px; borderRadius:7px; border:1px solid rgba(255,255,255,0.06);")}>{item.value}</div>
            </div>
          ) : (
            <div style={css("display:flex; gap:8px;")}>
              <Input
                value={inputValue || ''}
                onChange={(e) => onInputChange(item.field, e.target.value)}
                placeholder="Paste URL..."
                style={css("flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); fontSize:12px; height:36px;")}
                onKeyDown={(e) => { if (e.key === 'Enter' && inputValue?.trim()) onSave(item.field); }}
              />
              <Button onClick={() => onSave(item.field)} disabled={!inputValue?.trim()} className="h-9 px-3" style={css("background:hsl(38 92% 50%); color:#1a1205; fontWeight:600; fontSize:11.5px;")}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MediaPanel({ mediaItems = [], photographyStatus = 'not_started', photographyUrl = null, openMediaDrawers = new Set(), toggleMediaDrawer, mediaInputs = {}, setMediaInputs, handleAddMediaUrl, handleRemoveMediaUrl, handleMediaUpdate, photographyStatusConfig = {} }) {
  if (!mediaItems || mediaItems.length === 0) return null;

  return (
    <div style={css("margin-top:16px; border-radius:13px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.025); padding:13px 15px; animation: ld-rise 0.49s cubic-bezier(0.22,1,0.36,1) both;")}>
      <div style={css("font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.38); margin-bottom:10px;")}>Property Media</div>
      <div style={css("display:flex; flex-direction:column; gap:8px;")}>
        {/* URL media items */}
        {mediaItems.map((item) => (
          <MediaDrawer
            key={item.key}
            item={item}
            isOpen={openMediaDrawers.has(item.key)}
            onToggle={() => toggleMediaDrawer(item.key)}
            inputValue={mediaInputs[item.field] || ''}
            onInputChange={(field, value) => setMediaInputs(prev => ({ ...prev, [field]: value }))}
            onSave={handleAddMediaUrl}
            onRemove={handleRemoveMediaUrl}
          />
        ))}
        {/* Photography - special handling with status + URL */}
        <MediaDrawer
          item={{ key: 'photography', label: 'Photography', field: 'media_photography_url', value: photographyUrl, icon: Camera }}
          isOpen={openMediaDrawers.has('photography')}
          onToggle={() => toggleMediaDrawer('photography')}
          inputValue={mediaInputs.media_photography_url || ''}
          onInputChange={(field, value) => setMediaInputs(prev => ({ ...prev, [field]: value }))}
          onSave={handleAddMediaUrl}
          onRemove={handleRemoveMediaUrl}
          isPhotography={true}
          photographyStatus={photographyStatus}
          onStatusChange={handleMediaUpdate}
          photographyStatusConfig={photographyStatusConfig}
          photographyUrl={photographyUrl}
        />
      </div>
    </div>
  );
}