import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Camera, MapPin, ArrowRight, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function MatterportSync() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const runSync = async (dryRun = true) => {
    if (!dryRun) {
      const confirmed = window.confirm(
        'This will write 3D links and floor plans to matched units.\n\nContinue?'
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('syncMatterportSpaces', { dryRun });
      const data = response.data;

      setLastResult(data);
      setLastSyncAt(new Date());

      if (data.success) {
        toast.success(
          dryRun
            ? `Preview complete: ${data.summary.totalFetched} spaces fetched`
            : `Sync complete: ${data.summary.matchedCount} units updated`
        );
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Failed to run sync');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!lastResult) {
      return (
        <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30">
          Not run yet
        </Badge>
      );
    }

    if (!lastResult.success) {
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    }

    if (lastResult.summary.totalFetched === 0) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
          <AlertCircle className="w-3 h-3 mr-1" /> 0 Spaces (Sandbox Mode)
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Success
      </Badge>
    );
  };

  return (
    <div className="page-root">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-2xl mb-1">Matterport Sync</h1>
            <p className="page-subtitle">
              Synchronize 3D tours from Matterport to CRM units
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            {lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                Last sync: {lastSyncAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Matterport API connected
                </span>
              </div>

              {lastResult?.summary.totalFetched === 0 && lastResult?.success && (
                <div
                  className="p-3 rounded-lg border"
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <p className="text-xs" style={{ color: 'hsl(38 92% 60%)' }}>
                    <AlertCircle className="w-3 h-3 inline mr-1.5" />
                    0 Spaces returned — Matterport API may be in Sandbox mode. Production access required.
                  </p>
                </div>
              )}

              {lastResult?.error && (
                <div
                  className="p-3 rounded-lg border"
                  style={{
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                  }}
                >
                  <p className="text-xs text-red-400">
                    <AlertCircle className="w-3 h-3 inline mr-1.5" />
                    {lastResult.error}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Run Sync Controls */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Run Sync
            </CardTitle>
            <CardDescription className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Preview first to verify matches before writing data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => runSync(true)}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Preview (dry run)
              </Button>

              <Button
                variant="default"
                onClick={() => runSync(false)}
                disabled={loading}
                className="gap-2"
                style={{
                  background: 'hsl(38 92% 50%)',
                  color: 'hsl(222 47% 11%)',
                }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Run sync (write data)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {lastResult?.success && (
          <>
            {/* Summary */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Fetched</p>
                    <p className="text-2xl font-bold" style={{ color: 'hsl(38 92% 50%)' }}>
                      {lastResult.summary.totalFetched}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Matched</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {lastResult.summary.matchedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Unmatched</p>
                    <p className="text-2xl font-bold text-amber-400">
                      {lastResult.summary.unmatchedCount}
                    </p>
                  </div>
                </div>

                {lastResult.dryRun && (
                  <div
                    className="mt-4 p-3 rounded-lg border text-center"
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    <p className="text-xs" style={{ color: 'hsl(217 91% 60%)' }}>
                      <Eye className="w-3 h-3 inline mr-1.5" />
                      This was a preview — NO data was written to the CRM
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Matched Spaces */}
            {lastResult.matched && lastResult.matched.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-400" />
                    Matched Spaces ({lastResult.matched.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lastResult.matched.map((match, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border flex items-center justify-between"
                        style={{
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                              {match.spaceName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Matterport ID: {match.spaceId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: 'hsl(38 92% 50%)' }}>
                              {match.unitReference}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {match.confidence === 'exact' ? 'Exact match' : 'Partial match'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unmatched Spaces */}
            {lastResult.unmatched && lastResult.unmatched.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    <AlertCircle className="w-4 h-4 inline mr-2 text-amber-400" />
                    Unmatched Spaces ({lastResult.unmatched.length})
                  </CardTitle>
                  <CardDescription className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    These Spaces didn't match any unit — check naming conventions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lastResult.unmatched.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border flex items-center gap-3"
                        style={{
                          background: 'rgba(245, 158, 11, 0.05)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                        }}
                      >
                        <Camera className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {item.spaceName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Results State */}
            {lastResult.matched?.length === 0 && lastResult.unmatched?.length === 0 && lastResult.summary.totalFetched > 0 && (
              <Card className="glass-card">
                <CardContent className="py-8 text-center">
                  <Camera className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No spaces to display
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Error State */}
        {lastResult && !lastResult.success && (
          <Card className="glass-card">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-sm text-red-400 mb-2">Sync failed</p>
              <p className="text-xs text-muted-foreground">{lastResult.error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}