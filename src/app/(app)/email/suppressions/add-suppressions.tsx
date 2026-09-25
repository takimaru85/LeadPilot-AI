"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";

export function AddSuppressions() {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [reason, setReason] = useState("manual");
  const [loading, setLoading] = useState(false);
  const values = [...new Set(text.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean))];
  return (
    <Card className="h-fit">
      <CardHeader title="Add to suppression list" description="Emails or whole domains, one per line." />
      <CardBody className="space-y-4">
        <Field label="Addresses or domains">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"someone@company.com\ncompetitor.com"} />
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="manual">Manual</option>
            <option value="do_not_contact">Do not contact (asked us not to)</option>
            <option value="unsubscribed">Unsubscribed by reply</option>
          </Select>
        </Field>
        <Button
          className="w-full"
          loading={loading}
          disabled={!values.length}
          onClick={async () => {
            setLoading(true);
            try {
              const r = await api<{ added: string[]; invalid: string[] }>("/api/suppressions", { body: { values, reason } });
              toast.success(`Suppressed ${r.added.length} entr${r.added.length === 1 ? "y" : "ies"}`, r.invalid.length ? [`Invalid: ${r.invalid.join(", ")}`] : undefined);
              setText("");
              router.refresh();
            } catch (e) {
              toast.error(e);
            } finally {
              setLoading(false);
            }
          }}
        >
          Suppress {values.length || ""}
        </Button>
      </CardBody>
    </Card>
  );
}
