import { ClerkProvider } from "@clerk/nextjs";

/**
 * Clerk wraps only the signed-in area (ADR-7). Keeping the provider here rather than in
 * the root layout is what lets the public wizard, results and catalogue stay statically
 * generated and free of Clerk entirely.
 */
export default function MonEspaceLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
