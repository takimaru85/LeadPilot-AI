import { Inbox } from "lucide-react";
import { ReviewCard } from "@/components/review-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { reviewQueue } from "@/lib/services/review";

export const metadata = { title: "Review queue" };

export default async function ReviewQueuePage() {
  const ctx = await requireContext();
  const items = await reviewQueue(ctx);
  if (!items.length) {
    return (
      <Card>
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Nothing waiting for review"
          description="Generate emails for qualified leads and they'll appear here for you to read, edit and approve one by one."
          action={<ButtonLink href="/leads?status=qualified">View qualified leads</ButtonLink>}
        />
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">{items.length} lead{items.length > 1 ? "s" : ""} with drafts. Pick the variant that sounds most like you, edit freely, then approve.</p>
      {items.map((item) => <ReviewCard key={item.lead.id} item={item} />)}
    </div>
  );
}
