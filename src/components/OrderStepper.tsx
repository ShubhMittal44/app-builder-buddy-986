import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Enums } from "@/integrations/supabase/types";

type OrderStage = Enums<'order_stage_enum'>;

const steps: { stage: OrderStage; label: string }[] = [
  { stage: "intake", label: "Intake" },
  { stage: "assign_site", label: "Assign Site" },
  { stage: "processing", label: "Processing" },
  { stage: "dispatch", label: "Dispatch" },
  { stage: "fitting", label: "Fitting" },
  { stage: "closed", label: "Closed" },
];

const stageOrder = ["intake", "assign_site", "processing", "dispatch", "fitting", "closed"];

interface OrderStepperProps {
  currentStage: OrderStage;
  className?: string;
}

export const OrderStepper = React.memo(function OrderStepper({ currentStage, className }: OrderStepperProps) {
  const currentIndex = stageOrder.indexOf(currentStage);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.stage} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                    isCompleted &&
                      "bg-accent border-accent text-accent-foreground",
                    isCurrent &&
                      "bg-primary border-primary text-primary-foreground",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-background border-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium text-center whitespace-nowrap",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors",
                    index < currentIndex ? "bg-accent" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
