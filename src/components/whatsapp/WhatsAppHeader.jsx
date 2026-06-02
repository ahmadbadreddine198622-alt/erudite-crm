import { Phone, Video, Calendar, Home, MapPin, FileText, DollarSign, Languages, Pin, Clock, MessageSquare, Star, Flag, MoreVertical, UserCheck, Shield } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import ScoreBadge from "@/components/ScoreBadge";
import StagePipeline from "@/components/StagePipeline";
import SLATimer from "@/components/SLATimer";

const TEMP_COLORS = { frozen: "bg-blue-500", cold: "bg-blue-400", warming: "bg-amber-400", hot: "bg-orange-500", blazing: "bg-red-500" };

export default function WhatsAppHeader({ conversation, lead, agent, onAction, agents = [] }) {
  const flag = countryFlag(conversation.country_code);

  return (
    <div className="border-b bg-white shrink-0">
      {/* Row 1 — identity */}
      <div className="flex items-center gap-3 p-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={conversation.wa_profile_pic_url} />
          <AvatarFallback>{(conversation.wa_display_name || conversation.wa_phone_e164 || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold truncate">
              {conversation.wa_display_name || lead?.full_name || conversation.wa_phone_e164}
            </h2>
            {flag && <span title={conversation.country_code}>{flag}</span>}
            {conversation.wa_verified && <Shield className="w-4 h-4 text-green-600" />}
            {conversation.is_vip && <Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
            {conversation.spam_score > 60 && (
              <Badge variant="destructive">Possible spam {conversation.spam_score}</Badge>
            )}
            <ScoreBadge score={lead?.ai_lead_score} trend={lead?.ai_score_trend} />
            {lead?.aurora_temperature && (
              <span
                className={`w-2 h-2 rounded-full ${TEMP_COLORS[lead.aurora_temperature] || "bg-slate-300"}`}
                title={lead.aurora_temperature}
              />
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span>{conversation.wa_phone_e164}</span>
            {conversation.wa_last_seen_at && <span>· last seen {timeAgo(conversation.wa_last_seen_at)}</span>}
            {conversation.detected_language && <span>· {conversation.detected_language}</span>}
            {lead?.source && <span>· from {lead.source}</span>}
          </div>
        </div>

        <SLATimer dueAt={conversation.sla_due_at} breached={conversation.sla_breached} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 h-8">
              <Avatar className="w-5 h-5">
                <AvatarFallback className="text-[10px]">{agent?.full_name?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <UserCheck className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
            {agents.length > 0 ? (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Assign to agent</p>
                  {agents.map(a => (
                    <DropdownMenuItem key={a.id || a.email} onClick={() => onAction("assign_agent", a)} className="cursor-pointer text-sm">
                      {a.full_name || a.email}
                    </DropdownMenuItem>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-2 py-1.5 text-xs text-gray-500">No agents available</div>
            )}
            <DropdownMenuItem onClick={() => onAction("escalate")}>Escalate to manager</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction("toggle_vip")}>
              <Star className="w-4 h-4 mr-2" /> {conversation.is_vip ? "Remove VIP" : "Mark VIP"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("toggle_star")}>
              <Pin className="w-4 h-4 mr-2" /> {conversation.is_starred ? "Unstar" : "Star conversation"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("convert_to_lead")}>Convert to Lead</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("convert_to_deal")}>Convert to Deal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("merge_contact")}>Merge with existing contact…</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("block")} className="text-red-600">
              <Flag className="w-4 h-4 mr-2" /> Block &amp; report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


    </div>
  );
}

function CommandButton({ icon: Icon, label, onClick, highlight, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition ${
        active ? "bg-violet-100 text-violet-800" :
        highlight ? "bg-[#00A884]/10 text-[#00A884] hover:bg-[#00A884]/20" :
        "hover:bg-slate-200 text-slate-700"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
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