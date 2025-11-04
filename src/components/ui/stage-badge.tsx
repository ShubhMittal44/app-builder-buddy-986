import * as React from "react";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";

export type OrderStage = 
  | "intake"
  | "assign"
  | "processing"
  | "dispatch"
  | "fitting"
  | "closed";

export interface StageBadgeProps {
  stage: OrderStage;
  className?: string;
}

const stageConfig: Record<OrderStage, { label: string; className: string }> = {
  intake: {
    label: "Intake",
    className: "bg-stage-intake text-white border-transparent",
  },
  assign: {
    label: "Assign Site",
    className: "bg-stage-assign text-white border-transparent",
  },
  processing: {
    label: "Processing",
    className: "bg-stage-processing text-foreground border-transparent",
  },
  dispatch: {
    label: "Dispatch",
    className: "bg-stage-dispatch text-white border-transparent",
  },
  fitting: {
    label: "Fitting",
    className: "bg-stage-fitting text-white border-transparent",
  },
  closed: {
    label: "Closed",
    className: "bg-stage-closed text-white border-transparent",
  },
};

export const StageBadge = React.memo(function StageBadge({ stage, className }: StageBadgeProps) {
  const config = stageConfig[stage];
  
  return (
    <Badge className={cn(config.className, "font-medium", className)}>
      {config.label}
    </Badge>
  );
});
