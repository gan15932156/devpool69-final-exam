import { notFound } from "next/navigation";
import { FormPage } from "@/components/restaurant/FormPage";
import { requireSession } from "@/lib/require-session";
import { EditRestaurant } from "./EditRestaurant";

// server component: เช็ก login (ไม่ login → ไป /login แล้วพากลับมาหน้านี้) และ id ที่ไม่ใช่ตัวเลข → 404 ก่อนส่ง JS ไปเบราว์เซอร์
// สิทธิ์เจ้าของเช็กใน EditRestaurant (UX) และที่ Go (จริง)
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
