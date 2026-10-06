"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign-in failed.");

      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the CRM owner account created in Supabase Auth.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          autoComplete="username"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <Button className="w-full" disabled={signingIn}>
        {signingIn ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
