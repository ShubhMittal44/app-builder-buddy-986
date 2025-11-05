import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingStates';

interface PDFPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  orderNumber: number;
  onDownload: () => void;
}

export const PDFPreviewModal = ({
  open,
  onOpenChange,
  pdfUrl,
  orderNumber,
  onDownload,
}: PDFPreviewModalProps) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pdfUrl) {
      setLoading(false);
    }
  }, [pdfUrl]);

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Chalan / Glass Size - Order #{orderNumber}</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden relative bg-muted/20">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          )}
          {pdfUrl && (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full"
              aria-label="PDF Preview"
            >
              <div className="flex flex-col items-center justify-center h-full p-6">
                <p className="text-muted-foreground mb-4">
                  PDF preview not available in this browser.
                </p>
                <Button onClick={onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </object>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
