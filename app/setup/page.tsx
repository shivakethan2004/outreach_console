import Link from "next/link";

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Connect your Supabase project</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The CRM now expects Supabase as its database. Add your project URL and
        publishable key to a local <code>.env.local</code> file, then apply the
        schema migration before signing in.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-4 text-xs">
        <code>{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key`}</code>
      </pre>
      <p className="mt-4 text-sm text-muted-foreground">
        Create the single-owner account in Supabase Auth. Public sign-up is not
        enabled in this app.
      </p>
      <p className="mt-4 text-sm">
        <Link className="font-medium text-primary underline" href="/sign-in">
          Go to sign in
        </Link>
      </p>
    </div>
  );
}
