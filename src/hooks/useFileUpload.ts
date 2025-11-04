import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UploadedFile {
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
  uploaded_at: string;
}

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFiles = async (
    files: File[],
    orderId: string
  ): Promise<UploadedFile[]> => {
    if (files.length === 0) return [];

    setUploading(true);
    setProgress(0);

    const uploadedFiles: UploadedFile[] = [];
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: `${file.name} exceeds 10MB limit`,
            variant: 'destructive',
          });
          continue;
        }

        // Create unique file path
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${orderId}/${timestamp}_${sanitizedFileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('sizes_chalan')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Upload error:', error);
          toast({
            title: 'Upload failed',
            description: `Failed to upload ${file.name}`,
            variant: 'destructive',
          });
          continue;
        }

        // Get public URL (with authentication)
        const { data: urlData } = supabase.storage
          .from('sizes_chalan')
          .getPublicUrl(data.path);

        uploadedFiles.push({
          name: file.name,
          path: data.path,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
        });

        // Update progress
        setProgress(((i + 1) / totalFiles) * 100);
      }

      if (uploadedFiles.length > 0) {
        toast({
          title: 'Success',
          description: `${uploadedFiles.length} file(s) uploaded successfully`,
        });
      }

      return uploadedFiles;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('sizes_chalan')
        .remove([filePath]);

      if (error) {
        toast({
          title: 'Delete failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const getSignedUrl = async (filePath: string, expiresIn: number = 3600): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('sizes_chalan')
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return null;
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('sizes_chalan')
        .download(filePath);

      if (error) {
        toast({
          title: 'Download failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'File downloaded successfully',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return {
    uploadFiles,
    deleteFile,
    getSignedUrl,
    downloadFile,
    uploading,
    progress,
  };
};
