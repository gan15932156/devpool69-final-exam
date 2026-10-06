"use client";

import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { useCallback } from "react";
import { ApiError, request } from "./api";
import type { RestaurantDetail } from "./types";

// useApi() คืนฟังก์ชันเรียก API · path เริ่มด้วย /api/v1/... → route ของ Next แนบ token จาก session cookie แล้วส่งต่อไป Go
// หน้าเว็บไม่ต้องถือ token เอง (อ่านไม่ได้ด้วย)
export function useApi() {
  const { status } = useSession();
  const loggedIn = status === "authenticated";

  return useCallback(
    async <T,>(path: string, init?: Parameters<typeof request>[1]) => {
      try {
        return await request<T>(path, init);
      } catch (e) {
        // login อยู่แต่ Go ตอบ 401 = token หมดอายุ/ถูกยกเลิก → ออกจากระบบแล้วไปหน้า login
        if (e instanceof ApiError && e.status === 401 && loggedIn) {
          await signOut({ redirectTo: "/login" });
        }
        throw e;
      }
    },
    [loggedIn],
  );
}

// ข้อมูลร้าน 1 ร้าน · key ["restaurant", id] ใช้ร่วมกันทุกหน้า (หน้าร้าน / แก้ไขร้าน / แก้ไขการจอง)
export function useRestaurant(id: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["restaurant", id],
    queryFn: () => api<RestaurantDetail>(`/api/v1/restaurants/${id}`),
  });
}
