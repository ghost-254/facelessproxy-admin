// app/page.tsx (Updated as admin landing, redirects to dashboard)
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/admin")
}