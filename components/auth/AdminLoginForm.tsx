"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

import { auth } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminLoginFormProps = {
  nextPath?: string;
  reason?: string;
};

const reasonLabels: Record<string, string> = {
  "auth-required": "Sign in to continue to the admin console.",
};

export default function AdminLoginForm({ nextPath = "/admin", reason }: AdminLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonMessage = useMemo(() => {
    if (!reason) {
      return "Sign in with an account that has admin access.";
    }

    return reasonLabels[reason] ?? "Sign in to continue.";
  }, [reason]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        await signOut(auth);
        throw new Error(payload.error || "Unable to create a secure admin session.");
      }

      window.location.assign(nextPath.startsWith("/") ? nextPath : "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in with that account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="glass-panel border-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
      <CardHeader className="space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <CardTitle className="font-display text-3xl text-slate-950">Admin Sign In</CardTitle>
          <CardDescription className="text-base leading-7 text-slate-600">{reasonMessage}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@facelessproxy.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-2xl border-white/70 bg-white/80 pl-11"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl border-white/70 bg-white/80 pl-11 pr-12"
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          <Button type="submit" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={isSubmitting}>
            {isSubmitting ? "Securing access..." : "Enter Admin Console"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
