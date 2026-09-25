import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { EmailTabs } from "./email-tabs";

export default async function EmailLayout({ children }: LayoutProps<"/email">) {
  const { store } = await requireContext();
  const [review, queued] = await Promise.all([
    store.count("leads", { eq: { status: "draft_ready" } }),
    store.count("email_messages", { eq: { status: "queued" } }),
  ]);
  return (
    <>
      <PageHeader title="Email" description="Every email is reviewed and approved by you. Nothing is sent in bulk or automatically." />
      <EmailTabs counts={{ "/email": review, "/email/outbox": queued }} />
      {children}
    </>
  );
}
