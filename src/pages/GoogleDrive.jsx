import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
    Folder, FileText, Loader2, ExternalLink, RefreshCw, CheckCircle2, 
    AlertCircle, Upload, Search, Eye, Download
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';

export default function GoogleDrive() {
    const [searchQuery, setSearchQuery] = useState('');
    const [syncing, setSyncing] = useState(false);

    const documentTypes = [
        { name: 'Property Documents', icon: FileText, desc: 'Brochures, floor plans, permits' },
        { name: 'Call Transcripts', icon: FileText, desc: 'Vapi & Aircall call records' },
        { name: 'Contracts & Forms', icon: FileText, desc: 'Form A, Form F, lease agreements' },
        { name: 'Invoices & Payments', icon: FileText, desc: 'Tax invoices, receipts' },
    ];

    // Check Google Drive connection
    const { data: folderData, isLoading: loadingFolder, refetch: refetchFolder } = useQuery({
        queryKey: ['gdrive-folder'],
        queryFn: async () => {
            const result = await base44.functions.invoke('getGoogleDriveFolder', {});
            return result.data;
        },
    });

    // Fetch files from Google Drive
    const { data: filesData, isLoading: loadingFiles, refetch: refetchFiles } = useQuery({
        queryKey: ['gdrive-files', searchQuery],
        queryFn: async () => {
            const result = await base44.functions.invoke('listGoogleDriveFiles', {
                query: searchQuery || '',
                folderId: folderData?.folderId
            });
            return result.data;
        },
        enabled: !!folderData,
    });

    // Calculate statistics
    const totalFiles = filesData?.files?.length || 0;
    const recentFiles = filesData?.files?.filter(f => {
        const created = new Date(f.createdTime);
        const now = new Date();
        const hoursDiff = (now - created) / (1000 * 60 * 60);
        return hoursDiff <= 24; // Last 24 hours
    }) || [];
    const todayFiles = filesData?.files?.filter(f => {
        const created = new Date(f.createdTime);
        const today = new Date();
        return created.getDate() === today.getDate() && 
               created.getMonth() === today.getMonth() && 
               created.getFullYear() === today.getFullYear();
    }) || [];
    const pdfCount = filesData?.files?.filter(f => f.mimeType === 'application/pdf')?.length || 0;

    const handleSync = async () => {
        setSyncing(true);
        try {
            await refetchFiles();
            toast.success('Files synced from Google Drive');
        } catch (error) {
            toast.error('Sync failed: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    const handleTestUpload = async () => {
        setSyncing(true);
        try {
            const testPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlCi9QYXJlbnQgMSAwIFIKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNTAgNzUwIFRkCihUZXN0IFBERiBmcm9tIFByb3BDUk0pIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCj4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMDggMDAwMDAgbiAKMDAwMDAwMDI2NSAwMDAwMCBuIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwODcgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDUvUm9vdCAyIDAgUj4+CnN0YXJ0eHJlZgozMTQKJSVFT0Y=';
            
            const result = await base44.functions.invoke('uploadToGoogleDrive', {
                fileName: `test-propcrm-${new Date().toISOString().split('T')[0]}.pdf`,
                base64Content: testPdfBase64,
                mimeType: 'application/pdf'
            });
            
            if (result.data.success) {
                toast.success('Test PDF uploaded to Google Drive!');
                refetchFiles();
            }
        } catch (error) {
            toast.error('Upload failed: ' + error.message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="p-6 max-w-[1800px] mx-auto min-h-screen"
            style={{
                background: 'radial-gradient(ellipse at 30% 10%, rgba(20,30,60,0.55) 0%, rgba(8,11,18,0.92) 45%, rgba(6,8,14,0.98) 100%)',
            }}
        >
            <PageHeader 
                title="Google Drive" 
                subtitle="Independent document storage for all CRM PDFs - separate from Vapi AI calling platform"
            >
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSync}
                        disabled={syncing || !folderData}
                        className="gap-2"
                    >
                        {syncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        Sync Now
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open('https://drive.google.com/drive/my-drive', '_blank')}
                        className="gap-2"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open Google Drive
                    </Button>
                </div>
            </PageHeader>

            <div className="grid gap-6">
                {/* Connection Status */}
                {!folderData ? (
                    <Card className="liquid-glass">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Folder className="w-5 h-5" />
                                Connect Google Drive
                            </CardTitle>
                            <CardDescription className="text-white/60">
                                Login with your Google account to sync PDFs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-white/50 mx-auto mb-4" />
                                <p className="text-white/70">Checking Google Drive connection...</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Status Card */}
                        <Card className="liquid-glass">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Folder className="w-5 h-5 text-blue-400" />
                                        <CardTitle className="text-white">Google Drive Connected</CardTitle>
                                    </div>
                                    <Badge className="bg-green-400/20 text-green-400 border-green-400/30">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Active
                                    </Badge>
                                </div>
                                <CardDescription className="text-white/60">
                                    Property documents, call transcripts, contracts, and invoices auto-sync to your Google Drive
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-4 mb-6">
                                    {documentTypes.map((doc, idx) => (
                                        <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                    <doc.icon className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{doc.name}</p>
                                                    <p className="text-xs text-white/50">{doc.desc}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                <Folder className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">PropCRM PDFs</p>
                                                <p className="text-xs text-white/50">Storage Folder</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full mt-2 gap-2"
                                            onClick={() => window.open(folderData.folderLink, '_blank')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open Folder
                                        </Button>
                                    </div>

                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-green-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">
                                                    {pdfCount} PDFs
                                                </p>
                                                <p className="text-xs text-white/50">
                                                    {todayFiles.length} today • {recentFiles.length} in 24h
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full mt-2 gap-2"
                                            onClick={handleTestUpload}
                                            disabled={syncing}
                                        >
                                            <Upload className="w-4 h-4" />
                                            Test Upload
                                        </Button>
                                    </div>

                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-purple-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Auto-Sync</p>
                                                <p className="text-xs text-white/50">Real-time Backup</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-green-400 mt-2 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Enabled
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Uploads Summary */}
                                {(todayFiles.length > 0 || recentFiles.length > 0) && (
                                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-green-400">
                                                        {todayFiles.length} Uploaded Today
                                                    </p>
                                                    <p className="text-xs text-green-200/60">
                                                        Last 24 hours: {recentFiles.length} files
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                    <Folder className="w-4 h-4 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-blue-400">
                                                        Total: {pdfCount} PDFs
                                                    </p>
                                                    <p className="text-xs text-blue-200/60">
                                                        In PropCRM PDFs folder
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 p-3 rounded-lg bg-blue-400/10 border border-blue-400/20">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                                        <div className="text-xs text-blue-200/80">
                                            <p className="font-semibold mb-1">Connected Account</p>
                                            <p>ahmad@erudite-estate.com</p>
                                            <p className="text-xs text-blue-200/60 mt-1">
                                                Folder ID: {folderData.folderId}
                                            </p>
                                            <p className="text-xs text-blue-200/60 mt-2">
                                                <strong>Note:</strong> Google Drive is a separate document storage system, independent from Vapi (AI calling platform)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Search & Files */}
                        <Card className="liquid-glass">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-white flex items-center gap-2">
                                            <FileText className="w-5 h-5" />
                                            Stored PDFs
                                        </CardTitle>
                                        <CardDescription className="text-white/60">
                                            All PDFs saved from CRM
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                    <Input
                                        placeholder="Search files..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 glass-input"
                                    />
                                </div>

                                {/* Files List */}
                                {loadingFiles ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                                    </div>
                                ) : filesData?.files && filesData.files.length > 0 ? (
                                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                        {filesData.files.map((file) => (
                                            <div
                                                key={file.id}
                                                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                            >
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-red-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-white truncate">
                                                            {file.name}
                                                        </p>
                                                        <p className="text-xs text-white/50">
                                                            {file.mimeType === 'application/pdf' ? 'PDF Document' : file.mimeType}
                                                            {file.createdTime && ` • ${new Date(file.createdTime).toLocaleDateString()}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => window.open(file.webViewLink, '_blank')}
                                                        title="View in Google Drive"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => window.open(file.webContentLink || file.webViewLink, '_blank')}
                                                        title="Download"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => window.open(file.webViewLink, '_blank')}
                                                        className="gap-2"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        Open
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-white/50">
                                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p className="text-sm">No PDFs found</p>
                                        <p className="text-xs mt-1">
                                            {searchQuery ? 'Try a different search term' : 'PDFs will appear here as they are generated'}
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleTestUpload}
                                            className="mt-4 gap-2"
                                        >
                                            <Upload className="w-4 h-4" />
                                            Upload Test PDF
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}