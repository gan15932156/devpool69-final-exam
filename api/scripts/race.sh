#!/bin/bash
# ทดสอบ "สองคนกดจองที่นั่งสุดท้ายพร้อมกัน" — รันใน Git Bash: bash api/scripts/race.sh
# สร้างร้านทดสอบ 5 ที่ แล้วให้ 2 คนยิงจองคนละ 3 ที่ในเวลาเดียวกันพร้อมกัน 5 รอบ
# ผลที่ต้องได้ทุกรอบ: 201 หนึ่งตัว + 409 หนึ่งตัว (ถ้าได้ 201 ทั้งคู่ = ที่นั่งเกิน = lock ไม่ทำงาน)
API=${API:-http://localhost:8080/api/v1}
D=$(date -d tomorrow +%F)

token() {
  curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"toawang123\"}" | sed 's/.*"accessToken":"\([^"]*\)".*/\1/'
}
A=$(token somchai@example.com)
B=$(token mali@example.com)
OWNER=$(token nid@example.com)

IMG=$(curl -s -H "Authorization: Bearer $OWNER" -F "file=@$(dirname "$0")/race.png" "$API/uploads" | sed 's/.*"url":"\([^"]*\)".*/\1/')
RID=$(curl -s -X POST "$API/restaurants" -H "Authorization: Bearer $OWNER" -H "Content-Type: application/json" \
  -d "{\"name\":\"race test\",\"seats\":5,\"openTime\":\"10:00\",\"closeTime\":\"20:00\",\"cancelLeadMinutes\":30,\"images\":[\"$IMG\"]}" \
  | sed 's/^{"id":\([0-9]*\).*/\1/')
echo "ร้านทดสอบ id=$RID (5 ที่) · วันที่ $D"

for h in 10 11 12 13 14; do
  body="{\"date\":\"$D\",\"start\":\"$h:00\",\"end\":\"$h:30\",\"partySize\":3}"
  curl -s -o /dev/null -w "%{http_code}" -X POST "$API/restaurants/$RID/bookings" \
    -H "Authorization: Bearer $A" -H "Content-Type: application/json" -d "$body" > /tmp/race1 &
  curl -s -o /dev/null -w "%{http_code}" -X POST "$API/restaurants/$RID/bookings" \
    -H "Authorization: Bearer $B" -H "Content-Type: application/json" -d "$body" > /tmp/race2 &
  wait
  echo "รอบ $h:00  สมชาย=$(cat /tmp/race1)  มะลิ=$(cat /tmp/race2)"
done
