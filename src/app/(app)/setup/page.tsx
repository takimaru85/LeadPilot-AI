import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { IcpBuilder } from "./icp-builder";
import { ProductForm } from "./product-form";

export const metadata = { title: "Product & ICP" };

export default async function SetupPage() {
  const { store } = await requireContext();
  const [products, icps] = await Promise.all([
    store.list("products", { order: { column: "created_at" } }),
    store.list("icps", { order: { column: "created_at" } }),
  ]);
  const product = products[0] ?? null;
  const icp = icps.find((i) => i.product_id === product?.id) ?? icps[0] ?? null;
  return (
    <>
      <PageHeader
        eyebrow="Step 1 & 2"
        title="What are you selling — and to whom?"
        description="The more specific you are, the better LeadPilot can find companies that genuinely need you and explain why."
      />
      <div className="space-y-8">
        <ProductForm product={product} />
        <div id="icp" className="scroll-mt-20">
          <IcpBuilder icp={icp} product={product} />
        </div>
      </div>
    </>
  );
}
