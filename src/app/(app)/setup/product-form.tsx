"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/client-api";
import type { Product } from "@/lib/types";

const FIELDS = ["name", "description", "target_customer", "industry", "location", "company_size", "customer_problem", "why_buy", "website_url", "pricing"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

export function ProductForm({ product }: { product: Product | null }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => Object.fromEntries(FIELDS.map((f) => [f, product?.[f] ?? ""])) as Form);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api(product ? `/api/products/${product.id}` : "/api/products", { method: product ? "PATCH" : "POST", body: form });
      toast.success(product ? "Product updated" : "Product saved — now define your ideal customer");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        setErrors(Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
      }
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Package className="h-4 w-4 text-brand-600" /> What are you selling?</span>} description="Used to qualify leads and write emails. Only what you write here is used — the AI won't invent claims about your product." />
      <form onSubmit={save}>
        <CardBody className="grid gap-5 md:grid-cols-2">
          <Field label="Product / service name" required error={errors.name} htmlFor="p-name">
            <Input id="p-name" value={form.name} onChange={set("name")} placeholder="e.g. WordPress website rebuilds" required />
          </Field>
          <Field label="Website URL" error={errors.website_url} htmlFor="p-url">
            <Input id="p-url" value={form.website_url} onChange={set("website_url")} placeholder="https://yourcompany.com" />
          </Field>
          <Field label="Description" className="md:col-span-2" htmlFor="p-desc" hint="What it is and what the customer gets.">
            <Textarea id="p-desc" rows={3} value={form.description} onChange={set("description")} />
          </Field>
          <Field label="Target customer" htmlFor="p-target" hint="Who benefits most, in plain words.">
            <Input id="p-target" value={form.target_customer} onChange={set("target_customer")} placeholder="Independent dental practices" />
          </Field>
          <Field label="Industry" htmlFor="p-ind">
            <Input id="p-ind" value={form.industry} onChange={set("industry")} placeholder="Healthcare / Dental" />
          </Field>
          <Field label="Location" htmlFor="p-loc">
            <Input id="p-loc" value={form.location} onChange={set("location")} placeholder="Australia" />
          </Field>
          <Field label="Company size" htmlFor="p-size">
            <Input id="p-size" value={form.company_size} onChange={set("company_size")} placeholder="1–50 employees" />
          </Field>
          <Field label="Typical customer problem" htmlFor="p-prob">
            <Textarea id="p-prob" rows={3} value={form.customer_problem} onChange={set("customer_problem")} placeholder="What goes wrong for them without you?" />
          </Field>
          <Field label="Why customers buy" htmlFor="p-why">
            <Textarea id="p-why" rows={3} value={form.why_buy} onChange={set("why_buy")} placeholder="The outcome they get. Keep it factual." />
          </Field>
          <Field label="Pricing" htmlFor="p-price" hint="Optional. Only mentioned in emails if you want it to be." className="md:col-span-2">
            <Input id="p-price" value={form.pricing} onChange={set("pricing")} placeholder="From $X / month" />
          </Field>
        </CardBody>
        <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <Button type="submit" loading={saving}>{product ? "Save changes" : "Save product"}</Button>
        </div>
      </form>
    </Card>
  );
}
