import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Save, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BrandSettings() {
    const queryClient = useQueryClient();
    const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('erudite_logo') || '');
    const [signatureUrl, setSignatureUrl] = useState(() => localStorage.getItem('erudite_signature') || '');
    const [stampUrl, setStampUrl] = useState(() => localStorage.getItem('erudite_stamp') || '');

    const handleSave = () => {
        localStorage.setItem('erudite_logo', logoUrl);
        localStorage.setItem('erudite_signature', signatureUrl);
        localStorage.setItem('erudite_stamp', stampUrl);
        toast.success('Brand assets saved');
    };

    const handleClear = () => {
        localStorage.removeItem('erudite_logo');
        localStorage.removeItem('erudite_signature');
        localStorage.removeItem('erudite_stamp');
        setLogoUrl('');
        setSignatureUrl('');
        setStampUrl('');
        toast.success('Brand assets cleared');
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto min-h-screen"
            style={{
                background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
            }}
        >
            <PageHeader 
                title="Brand Settings" 
                subtitle="Manage brand assets (logo, signature, company stamp)"
            >
                <div className="flex gap-2">
                    <Button onClick={handleSave} className="gap-2">
                        <Save className="w-4 h-4" />
                        Save
                    </Button>
                    <Button onClick={handleClear} variant="outline" className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        Clear All
                    </Button>
                </div>
            </PageHeader>

            <div className="grid gap-6 mt-8">
                {/* Company Logo */}
                <Card className="liquid-glass">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            Company Logo
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            ERUDITE OS logo (displayed in top-left of dashboard)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label className="text-white/80">Logo URL</Label>
                            <Input
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="glass-input"
                            />
                        </div>
                        {logoUrl && (
                            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <img src={logoUrl} alt="Logo preview" className="h-16 object-contain" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Authorized Signature */}
                <Card className="liquid-glass">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            Authorized Signature
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            Personal signature for Form A, invoices, and contracts (applied via docusignSendForSignature)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label className="text-white/80">Signature URL</Label>
                            <Input
                                value={signatureUrl}
                                onChange={(e) => setSignatureUrl(e.target.value)}
                                placeholder="https://example.com/signature.png"
                                className="glass-input"
                            />
                        </div>
                        {signatureUrl && (
                            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <img src={signatureUrl} alt="Signature preview" className="h-12 object-contain" />
                            </div>
                        )}
                        <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-200/80">
                                <strong>Security Note:</strong> This signature is only applied to documents via the backend function (docusignSendForSignature), never hardcoded into the dashboard UI.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Company Stamp */}
                <Card className="liquid-glass">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            Company Stamp
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            Official company seal for invoices and contracts (applied via docusignSendForSignature)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label className="text-white/80">Stamp URL</Label>
                            <Input
                                value={stampUrl}
                                onChange={(e) => setStampUrl(e.target.value)}
                                placeholder="https://example.com/stamp.png"
                                className="glass-input"
                            />
                        </div>
                        {stampUrl && (
                            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                <img src={stampUrl} alt="Stamp preview" className="h-16 object-contain" />
                            </div>
                        )}
                        <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <p className="text-xs text-amber-200/80">
                                <strong>Usage:</strong> Applied to official documents only (invoices, contracts, Form A). Not used as dashboard watermark to maintain chart legibility.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Usage Guidelines */}
                <Card className="liquid-glass">
                    <CardHeader>
                        <CardTitle className="text-white">Asset Usage Guidelines</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-white/70">
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                            <div>
                                <p className="font-semibold text-white/90">Logo</p>
                                <p>Displayed in dashboard top-left corner only</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                            <div>
                                <p className="font-semibold text-white/90">Signature</p>
                                <p>Applied to Form A, invoices, contracts via docusignSendForSignature backend function</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                            <div>
                                <p className="font-semibold text-white/90">Stamp</p>
                                <p>Applied to official documents via docusignSendForSignature. Not used as dashboard watermark.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}