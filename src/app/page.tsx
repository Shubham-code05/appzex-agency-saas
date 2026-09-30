import { redirect } from "next/navigation";

// Middleware routes "/" to the role home; this is only a fallback.
export default function RootPage() {
  redirect("/login");
}
