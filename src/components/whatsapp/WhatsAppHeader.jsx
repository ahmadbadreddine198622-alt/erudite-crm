import React, { useState } from 'react';
import { Phone, Home, Pin, Star, Flag, MoreVertical, UserCheck, Shield, Briefcase, Building2, ExternalLink, Check, User, Link } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import ScoreBadge from "@/components/ScoreBadge";
import StagePipeline from "@/components/StagePipeline";
import SLATimer from "@/components/SLATimer";

const TEMP_COLORS = { frozen: "bg-blue-500", cold: "bg-blue-400", warming: "bg-amber-400", hot: "bg-orange-500", blazing: "bg-red-500" };

export default function WhatsAppHeader({ conversation, lead, landlord, agent, teamMembers, onAction }) {
  const [copied, setCopied] = React.useState(false);
  const flag = countryFlag(conversation.country_code);
  const entityType = landlord ? 'landlord' : lead ? 'lead' : 'unknown';
  const stage = landlord?.stage || lead?.stage;
  
  // Contact name resolution: entity name > real WA profile name > phone number
  const rawWaName = conversation.wa_display_name || '';
  const isGenericWaName = !rawWaName || rawWaName.startsWith('WhatsApp lead') || rawWaName.startsWith('+') || /^\d+$/.test(rawWaName.trim());
  const cleanWaName = isGenericWaName ? '' : rawWaName;
  const displayName = landlord?.full_name_en || lead?.full_name || cleanWaName || conversation.wa_phone_e164;
  const showWhatsAppName = !landlord && !lead && !!cleanWaName;
  const isMatched = !!(landlord || lead);
  
  // Channel attribution - show which of OUR lines the contact wrote to
  const ourLineNumber = conversation.channel === 'business' ? '+971582806000' : '+971581806000';
  const channelLabel = conversation.channel === 'business' ? 'Business' : 'Personal';

  const copyPhone = () => {
    navigator.clipboard.writeText(conversation.wa_phone_e164 || conversation.phone_number || '');
    setCopied(true);
    toast.success('Phone number copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b shrink-0 px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <Avatar className="w-9 h-9 shrink-0 border" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
          <AvatarImage src={conversation.wa_profile_pic_url} />
          <AvatarFallback className="text-xs">{(displayName || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        {/* Name + meta — all in one line */}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {displayName}
          </span>
          {flag && <span className="text-sm">{flag}</span>}
          {conversation.wa_verified && <Shield className="w-3.5 h-3.5 text-green-500 shrink-0" />}
          {conversation.is_vip && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}

          <span className="text-white/20 text-xs">·</span>

          {/* Phone */}
          <button onClick={copyPhone} className="flex items-center gap-1 text-xs hover:text-accent transition-colors shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} title="Copy">
            {copied ? <Check className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            {conversation.wa_phone_e164 || conversation.phone_number}
          </button>

          <span className="text-white/20 text-xs">·</span>

          {/* Channel */}
          <span className="flex items-center gap-1 text-xs shrink-0" title={`Our ${channelLabel} line: ${ourLineNumber}`}>
            {conversation.channel === 'business'
              ? <Building2 className="w-3 h-3 text-emerald-400" />
              : <UserCheck className="w-3 h-3 text-blue-400" />}
            <span style={{ color: conversation.channel === 'business' ? 'rgb(52,211,153)' : 'rgb(96,165,250)' }}>{channelLabel}</span>
          </span>

          <span className="text-white/20 text-xs">·</span>

          {/* Linked status */}
          {!isMatched
            ? <span className="text-xs font-medium text-amber-400 shrink-0">Unlinked</span>
            : <span className="text-xs font-medium text-emerald-400 shrink-0">{entityType === 'landlord' ? 'Landlord' : 'Lead'}</span>
          }

          {stage && <Badge variant="outline" className="text-[10px] border-white/20 text-white/60 h-4 px-1.5">{stage.replace(/_/g, ' ')}</Badge>}
          <ScoreBadge score={lead?.ai_lead_score} trend={lead?.ai_score_trend} />
        </div>

        <SLATimer dueAt={conversation.sla_due_at} breached={conversation.sla_breached} />

        {/* Icon-only action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {!isMatched ? (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Create Lead" onClick={() => onAction('create_lead')}>
                <Home className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Link Contact" onClick={() => onAction('link_contact')}>
                <Link className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Full Profile" onClick={() => onAction('open_profile')}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}

          {/* Assign */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Assign to agent">
                <UserCheck className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.15)' }}>
              {teamMembers?.length > 0 ? teamMembers.map(tm => (
                <DropdownMenuItem key={tm.email} onClick={() => onAction("assign_agent", { email: tm.email, full_name: tm.full_name })} className="flex items-center gap-2 cursor-pointer" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[9px]" style={{ background: 'rgba(255,255,255,0.1)' }}>{(tm.full_name || tm.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tm.full_name || tm.email}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{tm.email}</p>
                  </div>
                  {conversation.assigned_agent_email === tm.email && <span className="text-[10px] text-green-500 font-medium">Assigned</span>}
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem disabled style={{ color: 'rgba(255,255,255,0.5)' }}>No team members</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.15)' }}>
              <DropdownMenuItem onClick={() => onAction("toggle_vip")} style={{ color: 'rgba(255,255,255,0.9)' }}>
                <Star className="w-4 h-4 mr-2" /> {conversation.is_vip ? "Remove VIP" : "Mark VIP"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("toggle_star")} style={{ color: 'rgba(255,255,255,0.9)' }}>
                <Pin className="w-4 h-4 mr-2" /> {conversation.is_starred ? "Unstar" : "Star"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("mark_resolved")} style={{ color: 'rgba(255,255,255,0.9)' }}>
                <Check className="w-4 h-4 mr-2" /> Mark resolved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("block")} style={{ color: 'rgb(248,113,113)' }}>
                <Flag className="w-4 h-4 mr-2" /> Block & report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function countryFlag(cc) {
  if (!cc || cc.length !== 2) return null;
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}