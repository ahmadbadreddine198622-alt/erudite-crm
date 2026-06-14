import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Camera, ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectSelectorWithUpload({ value, onChange, projects }) {
  const queryClient = useQueryClient();
  const inputRefs = useRef({});
  const [uploadingProject, setUploadingProject] = useState(null);

  const selectedProject = projects.find(p => p.id === value);
  const isUnassigned = value === 'unassigned';
  const isEmpty = !value;

  const uploadMutation = useMutation({
    mutationFn: async ({ projectId, file }) => {
      console.log('[ProjectSelector] Starting upload for project', projectId, 'file:', file.name, file.type, file.size);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file (jpg, png, webp)');
      }
      
      // Upload to Base44 native storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log('[ProjectSelector] Upload complete, URL:', file_url);
      
      // Verify it's not a Google Drive URL
      if (file_url.includes('drive.google.com')) {
        console.error('[ProjectSelector] ERROR: Got Google Drive URL instead of public image URL:', file_url);
        throw new Error('Storage error: received non-public URL. Please contact support.');
      }
      
      // Test the URL is accessible (optional but helpful)
      try {
        const testResponse = await fetch(file_url, { method: 'HEAD' });
        if (!testResponse.ok) {
          console.warn('[ProjectSelector] Warning: URL returned', testResponse.status, 'on HEAD request');
        }
      } catch (err) {
        console.warn('[ProjectSelector] Warning: Could not verify URL accessibility:', err.message);
      }
      
      // Update the project entity
      await base44.entities.Project.update(projectId, { image_url: file_url });
      
      return file_url;
    },
    onMutate: ({ projectId }) => {
      setUploadingProject(projectId);
    },
    onSuccess: (url, { projectId }) => {
      console.log('[ProjectSelector] Successfully updated project', projectId, 'with URL:', url);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project image updated');
    },
    onError: (error, { projectId }) => {
      console.error('[ProjectSelector] Upload failed for project', projectId, error);
      toast.error('Failed to upload image: ' + error.message);
    },
    onSettled: () => {
      setUploadingProject(null);
    },
  });

  const handleImageUpload = (projectId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('[ProjectSelector] File selected:', file.name, file.type, file.size);
    uploadMutation.mutate({ projectId, file });
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClearImage = async (projectId, e) => {
    e.stopPropagation();
    try {
      await base44.entities.Project.update(projectId, { image_url: null });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project image removed');
    } catch (err) {
      console.error('[ProjectSelector] Failed to clear image:', err);
      toast.error('Failed to remove image: ' + err.message);
    }
  };

  return (
    <DropdownMenu>
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
          onClick={() => onChange?.('')}
          className="text-xs cursor-pointer"
          style={{ color: !value ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.9)' }}
        >
          <ImageIcon className="w-3.5 h-3.5 mr-2" />
          All Projects
        </DropdownMenuItem>
        
        {/* Unassigned option */}
        <DropdownMenuItem
          onClick={() => onChange?.('unassigned')}
          className="text-xs cursor-pointer"
          style={{ color: isUnassigned ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.9)' }}
        >
          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center mr-2 border border-dashed border-white/20">
            <span className="text-[8px] font-bold text-muted-foreground">∅</span>
          </div>
          Unassigned
        </DropdownMenuItem>
        
        {/* Project list with upload controls */}
        {projects.map(p => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => onChange?.(p.id)}
            className="text-xs cursor-pointer px-2 py-1.5"
            style={{ 
              color: value === p.id ? 'hsl(38 92% 50%)' : 'rgba(255,255,255,0.9)',
              background: value === p.id ? 'rgba(245,158,11,0.1)' : 'transparent'
            }}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {p.image_url ? (
                  <img 
                    src={p.image_url} 
                    alt="" 
                    className="w-6 h-6 rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      console.error('[ProjectSelector] Thumbnail failed to load:', p.image_url);
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0 border border-dashed border-white/20">
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate">{p.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {p.image_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearImage(p.id, e);
                    }}
                    disabled={uploadMutation.isPending}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
                <input
                  ref={(el) => (inputRefs.current[p.id] = el)}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(p.id, e)}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRefs.current[p.id]?.click();
                  }}
                  disabled={uploadingProject === p.id}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title={p.image_url ? 'Change image' : 'Upload image'}
                >
                  {uploadingProject === p.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-muted-foreground hover:text-accent" />
                  )}
                </button>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}