import { notFound } from "next/navigation";
import Home from "../../page";

const allowedSections = new Set(["browse", "reports", "notifications", "account", "forgot-password", "reset-password", "student-dashboard", "security-dashboard"]);

export default async function AppPage({ params }: PageProps<"/app/[[...section]]">) {
  const { section = [] } = await params;
  if (section.length > 1 || (section[0] && !allowedSections.has(section[0]))) notFound();

  return <Home />;
}
