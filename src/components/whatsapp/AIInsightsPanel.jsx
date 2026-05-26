import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Sparkles, Home, AlertCircle, Smile, ShieldCheck, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import ScoreBreakdownChart from "@/components/ScoreBreakdownChart";
import RecommendedPropertyCard from "@/components/RecommendedPropertyCard";

export default function AIInsightsPanel({ conversation, lead, recommendations, onSendProperty, onClose }) {
  if (!conversation) return null;
  return (
    <div className="w-80 border-l bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-white">
        <h3 className="font-semibold text-sm text-gray-900">Lead Profile</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Lead snapshot */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Lead profile</h3>
            {lead && <Link to={`/leads/${lead.id}`} className="text-xs text-blue-600 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open</Link>}
          </div>
          {lead ? (
            <dl className="text-xs space-y-1">
              <Row k="Budget" v={`${fmt(lead.budget_min)}–${fmt(lead.budget_max)} ${lead.budget_currency}`} />
              <Row k="Locations" v={(lead.preferred_locations || []).join(", ") || "—"} />
              <Row k="Property type" v={(lead.preferred_property_types || []).join(", ") || "—"} />
              <Row k="Bedrooms" v={`${lead.bedrooms_min || "?"}–${lead.bedrooms_max || "?"}`} />
              <Row k="Timeline" v={lead.move_in_timeline || "—"} />
              <Row k="Financing" v={lead.financing_method || "—"} />
              <Row k="Nationality" v={lead.nationality || "—"} />
              <Row k="Persona" v={lead.ai_persona?.archetype || "—"} />
            </dl>
          ) : (
            <button className="w-full text-xs text-blue-600">+ Create lead from this conversation</button>
          )}
        </CardContent>
      </Card>

      {/* Score breakdown */}
      {lead?.ai_lead_score_breakdown && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-semibold text-sm flex items-center gap-1 mb-2">
              <Sparkles className="w-4 h-4 text-violet-600" /> Aurora score · {Math.round(lead.ai_lead_score)}
            </h3>
            <ScoreBreakdownChart breakdown={lead.ai_lead_score_breakdown} />
          </CardContent>
        </Card>
      )}

      {/* Sentiment trend */}
      <Card>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm flex items-center gap-1">
            <Smile className="w-4 h-4 text-emerald-600" /> Sentiment trend
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{conversation.ai_sentiment_current}</Badge>
            <TrendIndicator trend={conversation.ai_sentiment_trend} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {conversation.ai_buying_signal_count} buying signal{conversation.ai_buying_signal_count !== 1 ? "s" : ""}
            {" · "}
            {conversation.ai_red_flag_count} red flag{conversation.ai_red_flag_count !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>

      {/* Recommended properties to send */}
      {recommendations?.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-semibold text-sm flex items-center gap-1 mb-2">
              <Home className="w-4 h-4 text-blue-600" /> Send these next
            </h3>
            <div className="space-y-2">
              {recommendations.slice(0, 3).map(r => (
                <RecommendedPropertyCard key={r.property_id} rec={r} onSend={() => onSendProperty(r)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topics & objections */}
      {(conversation.ai_topics?.length > 0 || conversation.ai_mentioned_competitors?.length > 0) && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <h3 className="font-semibold text-sm">Detected topics</h3>
            <div className="flex flex-wrap gap-1">
              {conversation.ai_topics?.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
            {conversation.ai_mentioned_competitors?.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="text-red-700 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Competitors mentioned:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {conversation.ai_mentioned_competitors.map(c => <Badge key={c} variant="destructive">{c}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Multi-channel */}
      {conversation.channel_links && Object.values(conversation.channel_links).some(Boolean) && (
        <Card>
          <CardContent className="p-3">
            <h3 className="font-semibold text-sm mb-2">Also reached on</h3>
            <ul className="text-xs space-y-1">
              {conversation.channel_links.instagram_handle && <li>📷 IG: @{conversation.channel_links.instagram_handle}</li>}
              {conversation.channel_links.email && <li>✉ {conversation.channel_links.email}</li>}
              {conversation.channel_links.sms_phone && <li>📱 SMS: {conversation.channel_links.sms_phone}</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Compliance */}
      <Card>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm flex items-center gap-1 mb-1"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Consent</h3>
          <div className="text-xs space-y-0.5">
            <ConsentRow label="WhatsApp opt-in" ok={conversation.consent?.whatsapp_opt_in} />
            <ConsentRow label="Marketing consent" ok={conversation.consent?.marketing_consent} />
            <ConsentRow label="GDPR acknowledged" ok={conversation.consent?.gdpr_acknowledged} />
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function Row({ k, v }) { return (<div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-right">{v}</dd></div>); }
function ConsentRow({ label, ok }) { return (<div className="flex justify-between"><span>{label}</span><span className={ok ? "text-emerald-600" : "text-amber-600"}>{ok ? "✓" : "missing"}</span></div>); }
function TrendIndicator({ trend }) { const map = { improving: ["↗", "text-emerald-600"], stable: ["→", "text-slate-500"], deteriorating: ["↘", "text-red-600"] }; const [icon, color] = map[trend] || ["—", "text-slate-400"]; return <span className={`text-sm font-semibold ${color}`}>{icon} {trend}</span>; }
function fmt(n) { return n != null ? new Intl.NumberFormat().format(n) : "?"; }