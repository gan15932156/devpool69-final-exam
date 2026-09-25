import { requireSession } from "@/lib/require-session";
import { OwnerDashboard } from "./OwnerDashboard";

// ?r=<id> = ร้านที่เลือกอยู่ (จำใน URL → reload แล้วยังอยู่ร้านเดิม)
export default async function OwnerPage({ searchParams }: PageProps<"/owner">) {
  await requireSession("/owner");
  const { r } = await searchParams;
  return <OwnerDashboard initialId={typeof r === "string" ? Number(r) : undefined} />;
}
