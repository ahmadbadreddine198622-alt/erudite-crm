import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function ProjectSelector({ value, onChange, projects }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploadingProjectId, setUploadingProjectId] = useState(null);
  const [openProjectId, setOpenProjectId] = useState(null);

  const selectedProject = value === 'unassigned' ? null : projects.find(p => p.id === value);
  const isUnassigned = value === 'unassigned';

  const uploadMutation = useMutation({
    mutationFn: async ({ projectId, file }) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file (JPG, PNG, WEBP)');
      }
      
      // Upload to Base44 native storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Verify it's a public URL (not Google Drive)
      if (file_url.includes('drive.google.com')) {
        throw new Error('Google Drive URLs are not supported. Please use a direct image URL.');
      }
      
      console.log('[ProjectSelector] Uploaded image URL:', file_url);
      
      // Update the project entity
      await base44.entities.Project.update(projectId, { image_url: file_url });
      
      return file_url;
    },
    onSuccess: (url, { projectId }) => {
      console.log('[ProjectSelector] Successfully updated project', projectId, 'with URL:', url);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project image updated');
      setUploadingProjectId(null);
      setOpenProjectId(null);
    },
    onError: (error) => {
      console.error('[ProjectSelector] Upload failed:', error);
      toast.error('Upload failed: ' + error.message);
      setUploadingProjectId(null);
    },
  });

  const handleFileSelect = (projectId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('[ProjectSelector] File selected:', file.name, file.type, file.size);
    setUploadingProjectId(projectId);
    uploadMutation.mutate({ projectId, file });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearImage = (projectId, e) => {
    e.stopPropagation();
    base44.entities.Project.update(projectId, { image_url: null })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Project image removed');
      })
      .catch(err => {
        toast.error('Failed to remove image: ' + err.message);
      });
  };

  return (
    <>
      <DropdownMenu open={openProjectId === 'menu'} onOpenChange={(open) => setOpenProjectId(open ? 'menu' : null)}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs gap-2"
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.12)', 
              color: 'rgba(255,255,255,0.9)' 
            }}
          >
            {isUnassigned ? (
              <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center border border-dashed border-white/20">
                <span className="text-[10px] font-bold text-muted-foreground">∅</span>
              </div>
            ) : selectedProject?.image_url ? (
              <img 
                src={selectedProject.image_url} 
                alt="" 
                className="w-5 h-5 rounded object-cover"
                onError={(e) => {
                  console.error('[ProjectSelector] Image failed to load:', selectedProject.image_url);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            <span className="max-w-[120px] truncate">
              {isUnassigned ? 'Unassigned' : selectedProject?.name || 'All Projects'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-64 max-h-80 overflow-y-auto"
          style={{ 
            background: 'hsl(222 47% 11%)', 
            border: '1px solid rgba(255,255,255,0.12)' 
          }}
        >
          {/* All Projects option */}
          <DropdownMenuItem
            onClick={() => { onChange?.(null); setOpenProjectId(null); }}
            className="text-xs cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center shrink-0">
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="flex-1">All Projects</span>
            </div>
          </DropdownMenuItem>

          {/* Unassigned option */}
          <DropdownMenuItem
            onClick={() => { onChange?.('unassigned'); setOpenProjectId(null); }}
            className="text-xs cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0 border border-dashed border-white/20">
                <span className="text-[10px] font-bold text-muted-foreground">∅</span>
              </div>
              <span className="flex-1">Unassigned</span>
            </div>
          </DropdownMenuItem>

          {/* Project list */}
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => { onChange?.(project.id); setOpenProjectId(null); }}
              className="text-xs cursor-pointer group"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            >
              <div className="flex items-center gap-2 w-full">
                {/* Thumbnail or placeholder */}
                <div className="relative w-6 h-6 rounded shrink-0 overflow-hidden bg-white/10">
                  {project.image_url ? (
                    <>
                      <img 
                        src={project.image_url} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('[ProjectSelector] Thumbnail failed to load:', project.image_url);
                          e.target.style.display = 'none';
                        }}
                      />
                      {/* Clear button on hover */}
                      <button
                        onClick={(e) => clearImage(project.id, e)}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                
                <span className="flex-1 truncate">{project.name}</span>
                
                {/* Upload button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                    setUploadingProjectId(project.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                  title={project.image_url ? 'Replace image' : 'Upload image'}
                >
                  {uploadingProjectId === project.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (uploadingProjectId) {
            handleFileSelect(uploadingProjectId, e);
          }
        }}
      />
    </>
  );
}