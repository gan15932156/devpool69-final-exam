import { FormPage } from "@/components/restaurant/FormPage";
import { RestaurantForm } from "@/components/restaurant/RestaurantForm";
import { requireSession } from "@/lib/require-session";

export default async function NewRestaurantPage() {
  const session = await requireSession("/owner/restaurants/new");
  return (
    <FormPage title="สร้างร้านใหม่">
      <RestaurantForm ownerId={Number(session.user.id)} />
    </FormPage>
  );
}
