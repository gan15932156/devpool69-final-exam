import { notFound } from "next/navigation";
import { RestaurantView } from "./RestaurantView";

// Next.js 16: params เป็น Promise ต้อง await ก่อน
export default async function RestaurantPage({ params }: PageProps<"/restaurants/[id]">) {
  const { id } = await params;
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId) || restaurantId <= 0) notFound();
  return <RestaurantView id={restaurantId} />;
}
