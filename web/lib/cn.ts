// รวม className หลายตัว ตัดค่าว่าง/false ทิ้ง: cn("a", ok && "b") → "a b"
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
