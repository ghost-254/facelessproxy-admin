"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";

type AdminSignOutButtonProps = {
  compact?: boolean;
};

export default function AdminSignOutButton({ compact = false }: AdminSignOutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth).catch(() => undefined);
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "outline"}
      onClick={handleSignOut}
      disabled={isLoading}
      className={compact ? "h-10 w-10 rounded-2xl" : "rounded-2xl border-white/70 bg-white/70"}
    >
      <LogOut className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />
      {compact ? <span className="sr-only">Sign out</span> : isLoading ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
