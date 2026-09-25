import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="mt-6 text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-zinc-500">The page you&apos;re looking for doesn&apos;t exist or was removed.</p>
      <ButtonLink href="/dashboard" variant="secondary">Back to dashboard</ButtonLink>
    </div>
  );
}
