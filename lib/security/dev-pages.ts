/**
 * The `/dev` test pages (room lab, runner lab, crash page) serve local runs,
 * CI and preview deployments. The live site hides them: the room lab's
 * "Submit solve" button would turn faking a pass into one click, no dev
 * tools needed. `vercelEnv` is `VERCEL_ENV`, which Vercel sets to
 * "production" for the live deployment only.
 */
export function devPagesEnabled(vercelEnv: string | undefined): boolean {
  return vercelEnv !== "production";
}
