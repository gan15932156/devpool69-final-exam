# ---------- build: คอมไพล์ Go เป็นไฟล์เดียว ----------
FROM golang:1.27-alpine AS build
WORKDIR /src
# copy go.mod ก่อน → ถ้า dependency ไม่เปลี่ยน Docker ใช้ cache ชั้นนี้ ไม่ต้องดาวน์โหลดใหม่
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO_ENABLED=0 → ไฟล์โปรแกรมไม่พึ่ง C library รันบน alpine เปล่า ๆ ได้
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

# ---------- run: image เล็ก มีแค่ไฟล์โปรแกรม ----------
FROM alpine:3.22
WORKDIR /app
# รันเป็น user ธรรมดา ไม่ใช่ root · โฟลเดอร์รูปต้องเป็นของ user นี้เพราะ API เขียนไฟล์ลงไป
RUN addgroup -g 10001 app && adduser -D -H -u 10001 -G app app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=build /out/api /app/api
# timezone ฝังอยู่ในโปรแกรมแล้ว (import _ "time/tzdata") ไม่ต้องติดตั้ง tzdata
ENV PORT=8080 UPLOAD_DIR=/app/uploads
USER app
EXPOSE 8080
CMD ["/app/api"]
