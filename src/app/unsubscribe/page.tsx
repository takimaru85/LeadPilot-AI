import { Logo } from "@/components/logo";
import { parseUnsubscribeToken } from "@/lib/crypto";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

/** Public page linked from every email footer. Requires one click to confirm (protects against link scanners). */
export default async function UnsubscribePage(props: PageProps<"/unsubscribe">) {
  const sp = await props.searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const parsed = token ? parseUnsubscribeToken(token) : null;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <Logo className="mb-8 opacity-70" />
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-card">
        {parsed ? (
          <>
            <h1 className="text-lg font-semibold">Unsubscribe {parsed.email}?</h1>
            <p className="mt-2 text-sm text-zinc-500">You won&apos;t receive any further emails from this sender.</p>
            <UnsubscribeButton token={token} />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">This link isn&apos;t valid</h1>
            <p className="mt-2 text-sm text-zinc-500">Please reply to the email and ask to be removed — the sender is required to honour it.</p>
          </>
        )}
      </div>
    </div>
  );
}
