import * as React from "react";
import { Upload, X, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Progress } from "./progress";

export interface FileUploadProps {
  value?: File[];
  onChange?: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: string;
  disabled?: boolean;
  uploading?: boolean;
  progress?: number;
  className?: string;
}

export function FileUpload({
  value = [],
  onChange,
  maxFiles = 10,
  maxSize = 10,
  accept,
  disabled,
  uploading = false,
  progress = 0,
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || uploading) return;
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        console.warn(`File ${file.name} exceeds ${maxSize}MB limit`);
        return false;
      }
      return true;
    });

    const totalFiles = [...value, ...validFiles];
    const limitedFiles = totalFiles.slice(0, maxFiles);
    onChange?.(limitedFiles);
  };

  const removeFile = (index: number) => {
    if (uploading) return;
    const newFiles = value.filter((_, i) => i !== index);
    onChange?.(newFiles);
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-background hover:border-primary/50",
          (disabled || uploading) && "opacity-50 cursor-not-allowed"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleChange}
          disabled={disabled || uploading}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={openFileDialog}
                disabled={disabled || uploading}
                className="text-primary hover:underline focus:outline-none disabled:cursor-not-allowed"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum {maxFiles} files, up to {maxSize}MB each
            </p>
          </div>
          {uploading && (
            <div className="w-full max-w-xs mt-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Uploading... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {value.length > 0 && (
        <div className="mt-4 space-y-2">
          {value.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <FileIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFile(index)}
                disabled={disabled || uploading}
                className="flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
