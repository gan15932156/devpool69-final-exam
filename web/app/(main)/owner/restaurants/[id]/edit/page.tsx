import { notFound } from "next/navigation";
import { FormPage } from "@/components/restaurant/FormPage";
import { requireSession } from "@/lib/require-session";
import { EditRestaurant } from "./EditRestaurant";

export default async function EditRestaurantPage({ params }: PageProps<"/owner/restaurants/[id]/edit">) {
  const { id } = await params;
  const session = await requireSession(`/owner/restaurants/${id}/edit`);
  const restaurantId = Number(id);
  if (!Number.isInteger(restaurantId) || restaurantId <= 0) notFound();
  return (
    <FormPage title="แก้ไขร้าน">
      <EditRestaurant id={restaurantId} myId={Number(session.user.id)} />
    </FormPage>
  );
}
