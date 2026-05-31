import React from 'react';
import { AlertTriangle, TrendingDown, Users, Home, MessageCircle, AlertCircle, CheckCircle } from 'lucide-react';

export default function CriticalMetricsPanel({ metrics }) {
  if (!metrics) return null;

  const criticalIssues = [];
  
  // Funnel bottleneck
  if (metrics.contact_identity_percentage > 50) {
    criticalIssues.push({
      severity: 'critical',
      icon: AlertTriangle,
      title: 'Funnel Collapse',
      description: `${metrics.contact_identity_percentage}% of leads stuck at initial contact`,
      action: 'Auto-created follow-up reminders',
    });
  }

  // Inventory shortage
  if (metrics.leads_per_property_ratio > 20) {
    criticalIssues.push({
      severity: 'critical',
      icon: Home,
      title: 'Inventory Crisis',
      description: `${metrics.leads_per_property_ratio} leads per property (benchmark: 10-20)`,
      action: 'Activate landlord acquisition workflow',
    });
  }

  // Low conversion
  if (metrics.conversion_rate_percentage < 2) {
    criticalIssues.push({
      severity: 'critical',
      icon: TrendingDown,
      title: 'Conversion Rate Critical',
      description: `${metrics.conversion_rate_percentage}% vs market 3-5%`,
      action: 'Review deal pipeline & negotiation strategy',
    });
  }

  // WhatsApp underutilization
  if (metrics.whatsapp_engagement_rate < 10) {
    criticalIssues.push({
      severity: 'warning',
      icon: MessageCircle,
      title: 'WhatsApp Underutilized',
      description: `Only ${metrics.whatsapp_engagement_rate}% engagement`,
      action: 'Launch WhatsApp campaigns for cold leads',
    });
  }

  // Landlord supply gap
  if (metrics.landlord_listing_ratio < 0.3) {
    criticalIssues.push({
      severity: 'warning',
      icon: Users,
      title: 'Landlord Supply Gap',
      description: `Only ${metrics.landlord_listing_ratio} properties per landlord`,
      action: 'Activate listing acquisition workflow',
    });
  }

  return (
    <div className="glass-card rounded-2xl p-5 border border-red-500/20">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-semibold text-foreground">Critical Business Metrics</h2>
        <span className="text-xs text-red-500 ml-auto">{criticalIssues.length} issues detected</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {criticalIssues.map((issue, idx) => {
          const Icon = issue.icon;
          return (
            <div
              key={idx}
              className={`rounded-xl p-4 border ${
                issue.severity === 'critical' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 shrink-0 ${
                  issue.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{issue.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                  {issue.action && (
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      <p className="text-xs text-emerald-400">{issue.action}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}