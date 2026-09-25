"use client";

import { useQuery } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { useCallback } from "react";
import { ApiError, request } from "./api";
import type { RestaurantDetail } from "./types";

// useApi() คืนฟังก์ชันเรียก API ที่แนบ token ของคนที่ login ให้อัตโนมัติ
// path เริ่มด้วย /api/v1/... → วิ่งผ่าน rewrite ของ Next ไปหา Go
export function useApi() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  return useCallback(
    async <T,>(path: string, init?: Parameters<typeof request>[1]) => {
      try {
        return await request<T>(path, { ...init, token });
      } catch (e) {
        // มี token แต่ Go ตอบ 401 = token หมดอายุ/ใช้ไม่ได้ → ออกจากระบบแล้วไปหน้า login
        if (e instanceof ApiError && e.status === 401 && token) {
          await signOut({ redirectTo: "/login" });
        }
        throw e;
      }
    },
    [token],
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
