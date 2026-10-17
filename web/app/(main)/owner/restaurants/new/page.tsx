import { FormPage } from "@/components/restaurant/FormPage";
import { RestaurantForm } from "@/components/restaurant/RestaurantForm";
import { requireSession } from "@/lib/require-session";

// ใครที่ login ก็สร้างร้านได้ (ไม่มี role เจ้าของแยก) · สร้างแล้วคนนั้นเป็นเจ้าของร้านนั้นทันที
export default async function NewRestaurantPage() {
  const session = await requireSession("/owner/restaurants/new");
  return (
    <FormPage title="สร้างร้านใหม่">
      <RestaurantForm ownerId={Number(session.user.id)} />
    </FormPage>
  );
}
