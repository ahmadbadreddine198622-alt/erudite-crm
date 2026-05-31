import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Folder, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GoogleDriveSettings() {
    const [syncing, setSyncing] = useState(false);

    const { data: folderData, refetch } = useQuery({
        queryKey: ['gdrive-folder'],
        queryFn: async () => {
            const result = await base44.functions.invoke('getGoogleDriveFolder', {});
            return result.data;
        },
    });

    const handleTestUpload = async () => {
        setSyncing(true);
        try {
            // Create a simple test PDF (base64 encoded)
            const testPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNTAgNzUwIFRkCihUZXN0IFBERiBmcm9tIFByb3BDUk0pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCj4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMDggMDAwMDAgbiAKMDAwMDAwMDI2NSAwMDAwMCBuIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwODcgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDUvUm9vdCAyIDAgUj4+CnN0YXJ0eHJlZgozMTQKJSVFT0Y=';
            
            const result = await base44.functions.invoke('uploadToGoogleDrive', {
                fileName: `test-propcrm-${new Date().toISOString().split('T')[0]}.pdf`,
                base64Content: testPdfBase64,
                mimeType: 'application/pdf'
            });
            
            if (result.data.success) {
                toast.success('Test PDF uploaded successfully!');
                window.open(result.data.webViewLink, '_blank');
            }
        } catch (error) {
            toast.error('Upload failed: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <Card className="liquid-glass">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Folder className="w-5 h-5" />
                    Google Drive Integration
                </CardTitle>
                <CardDescription className="text-white/60">
                    Store all PDFs in your Google Drive folder
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!folderData ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    </div>
                ) : (
                    <>
                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Folder className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-white">PropCRM PDFs</h4>
                                        <p className="text-xs text-white/50">All PDFs are stored here</p>
                                    </div>
                                </div>
                                <Badge className="bg-green-400/20 text-green-400 border-green-400/30">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Connected
                                </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-white/50 mt-2">
                                <FileText className="w-3 h-3" />
                                <span>Folder ID: {folderData.folderId}</span>
                            </div>
                            
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-3 gap-2"
                                onClick={() => window.open(folderData.folderLink, '_blank')}
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open Folder in Google Drive
                            </Button>
                        </div>

                        <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
                            <h4 className="text-sm font-semibold text-blue-200 mb-2">PDF Auto-Sync</h4>
                            <p className="text-xs text-blue-200/70 mb-3">
                                All generated PDFs (invoices, contracts, reports) will be automatically saved to your Google Drive folder.
                            </p>
                            
                            <Button
                                size="sm"
                                onClick={handleTestUpload}
                                disabled={syncing}
                                className="gap-2 w-full"
                            >
                                {syncing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <FileText className="w-4 h-4" />
                                )}
                                {syncing ? 'Uploading...' : 'Test Upload'}
                            </Button>
                        </div>

                        <div className="text-xs text-white/40">
                            <p>Connected to: <span className="text-white/60">ahmad@erudite-estate.com</span></p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}