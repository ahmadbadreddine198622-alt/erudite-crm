import React, { useState } from 'react';
import { Phone, Video, Calendar, Home, MapPin, FileText, DollarSign, Languages, Pin, Clock, MessageSquare, Star, Flag, MoreVertical, UserCheck, Shield, Briefcase, Building2, ExternalLink, Copy, Check, User } from 'lucide-react';
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
  
  // Contact name resolution: prefer matched entity name, then WhatsApp display name, then ~WhatsApp name if available
  const displayName = landlord?.full_name_en || lead?.full_name || conversation.wa_display_name || conversation.wa_phone_e164;
  const showWhatsAppName = !landlord && !lead && conversation.wa_display_name && conversation.wa_display_name !== conversation.wa_phone_e164;
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
    <div className="border-b shrink-0" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
      {/* Row 1 — identity block */}
      <div className="flex items-center gap-3 p-4">
        <Avatar className="w-14 h-14 border-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          <AvatarImage src={conversation.wa_profile_pic_url} />
          <AvatarFallback className="text-lg">{(displayName || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-display font-semibold text-lg truncate" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {displayName}
            </h2>
            {isMatched && (
              <Badge className={`text-xs border ${
                entityType === 'landlord' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}>
                {entityType === 'landlord' ? <><Briefcase className="w-3 h-3 mr-1" /> Landlord</> : <><Home className="w-3 h-3 mr-1" /> Lead</>}
              </Badge>
            )}
            {stage && (
              <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                {stage.replace(/_/g, ' ')}
              </Badge>
            )}
            {flag && <span title={conversation.country_code} className="text-lg">{flag}</span>}
            {conversation.wa_verified && <Shield className="w-4 h-4 text-green-500" />}
            {conversation.is_vip && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
            {conversation.is_starred && <Pin className="w-4 h-4 text-amber-400 fill-amber-400" />}
            {conversation.spam_score > 60 && (
              <Badge variant="destructive" className="text-xs">Spam {conversation.spam_score}</Badge>
            )}
            <ScoreBadge score={lead?.ai_lead_score} trend={lead?.ai_score_trend} />
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <button
              onClick={copyPhone}
              className="flex items-center gap-1 hover:text-accent transition-colors"
              title="Copy phone number"
            >
              {copied ? <Check className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              {conversation.wa_phone_e164 || conversation.phone_number}
            </button>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1" title={`Contact wrote to our ${channelLabel} line`}>
              {conversation.channel === 'business' ? <Building2 className="w-3 h-3 text-emerald-400" /> : <UserCheck className="w-3 h-3 text-blue-400" />}
              <span style={{ color: conversation.channel === 'business' ? 'rgb(52,211,153)' : 'rgb(96,165,250)' }}>{channelLabel}</span>
              <span className="text-white/40">({ourLineNumber})</span>
            </span>
            <span className="text-white/20">·</span>
            {!isMatched ? (
              <span className="text-amber-400 font-medium">Unlinked</span>
            ) : (
              <span className="text-emerald-400 font-medium">{entityType === 'landlord' ? 'Landlord' : 'Lead'}</span>
            )}
            {showWhatsAppName && (
              <><span className="text-white/20">·</span><span className="flex items-center gap-1"><User className="w-3 h-3" />~{conversation.wa_display_name}</span></>
            )}
            {conversation.wa_last_seen_at && <><span className="text-white/20">·</span><span>Last seen {timeAgo(conversation.wa_last_seen_at)}</span></>}
            {conversation.detected_language && <><span className="text-white/20">·</span><span>{conversation.detected_language.toUpperCase()}</span></>}
            {lead?.source && <><span className="text-white/20">·</span><span>Source: {lead.source.replace(/_/g, ' ')}</span></>}
          </div>
        </div>

        <SLATimer dueAt={conversation.sla_due_at} breached={conversation.sla_breached} />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isMatched ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction('create_lead')} className="gap-1.5 text-xs">
                <Home className="w-3 h-3" /> Create Lead
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction('link_contact')} className="gap-1.5 text-xs">
                <UserCheck className="w-3 h-3" /> Link Contact
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction('open_profile')} className="gap-1.5 text-xs">
                <ExternalLink className="w-3 h-3" /> Full Profile
              </Button>
            </>
          )}

          {/* Assign to Agent Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8">
                <UserCheck className="w-3 h-3" />
                Assign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" style={{ background: 'hsl(222 47% 11%)', borderColor: 'rgba(255,255,255,0.15)' }}>
              {teamMembers && teamMembers.length > 0 ? (
                teamMembers.map(tm => (
                  <DropdownMenuItem
                    key={tm.email}
                    onClick={() => onAction("assign_agent", { email: tm.email, full_name: tm.full_name })}
                    className="flex items-center gap-2 cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.9)' }}
                  >
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[9px]" style={{ background: 'rgba(255,255,255,0.1)' }}>{(tm.full_name || tm.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tm.full_name || tm.email}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{tm.email}</p>
                    </div>
                    {conversation.assigned_agent_email === tm.email && (
                      <span className="text-[10px] text-green-500 font-medium">Assigned</span>
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled style={{ color: 'rgba(255,255,255,0.5)' }}>No team members</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
                <Pin className="w-4 h-4 mr-2" /> {conversation.is_starred ? "Unstar" : "Star conversation"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("mark_resolved")} style={{ color: 'rgba(255,255,255,0.9)' }}>
                <Check className="w-4 h-4 mr-2" /> Mark resolved
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("block")} className="text-red-400" style={{ color: 'rgba(255,255,255,0.9)' }}>
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