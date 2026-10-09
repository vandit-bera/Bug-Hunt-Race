import { notFound } from "next/navigation";
import { devPagesEnabled } from "@/lib/security/dev-pages";

/** Test pages only: a 404 on the live site (see lib/security/dev-pages.ts). */
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (!devPagesEnabled(process.env.VERCEL_ENV)) notFound();
  return children;
}
