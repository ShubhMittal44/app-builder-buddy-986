import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useChalanPDF = () => {
  const [loading, setLoading] = useState(false);

  const generatePDF = async (orderId: string, download: boolean = false): Promise<Blob | null> => {
    setLoading(true);
    try {
      // Get the function URL
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        });
        return null;
      }

      // Call the edge function directly with fetch to get the PDF blob
      const response = await fetch(
        `https://cqyqjjhfwfydgusavlng.supabase.co/functions/v1/chalan-pdf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_id: orderId, download }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      return blob;
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate PDF',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const previewPDF = async (orderId: string): Promise<string | null> => {
    const blob = await generatePDF(orderId, false);
    if (!blob) return null;
    
    // Create object URL for preview
    return URL.createObjectURL(blob);
  };

  const downloadPDF = async (orderId: string, orderNumber: number) => {
    const blob = await generatePDF(orderId, true);
    if (!blob) return;

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chalan_${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'PDF downloaded successfully',
    });
  };

  return {
    generatePDF,
    previewPDF,
    downloadPDF,
    loading,
  };
};
