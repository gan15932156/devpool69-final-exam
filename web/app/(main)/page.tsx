import { RestaurantSearch } from "./RestaurantSearch";

// หน้าแรก = ค้นหาร้าน · อ่านค่า q / sort จาก URL ฝั่ง server แล้วส่งให้ส่วนที่โต้ตอบได้ (client)
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { q, sort } = await searchParams;
  return <RestaurantSearch initialQ={typeof q === "string" ? q : ""} initialSort={sort === "reviews" ? "reviews" : "rating"} />;
}
