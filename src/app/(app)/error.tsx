"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Something went wrong loading this page"
        description={process.env.NODE_ENV === "development" ? error.message : "Please try again. If it keeps happening, check the server logs."}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
