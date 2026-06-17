"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" strokeWidth={1.5} />
        ) : (
          <Eye aria-hidden className="size-4" strokeWidth={1.5} />
        )}
      </Button>
    </div>
  );
}

export { PasswordInput };
