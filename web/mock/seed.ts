// ข้อมูลตัวอย่างชุดเดียวกับ api/internal/seed/seed.go (ร้าน · บัญชีทดสอบ · รีวิว · การจอง)
// การจองนับจาก "ตอนที่ dev server เริ่ม" → เปิดมาเมื่อไหร่ก็มีการจองที่ยังไม่ถึงเวลา
import { cancelBooking, createBooking } from "./booking";
import { emptyStore, nextId, type Review, type Store, type User } from "./store";
import { addDays, at, dateOf, formatHHMM } from "./time";

export const SEED_PASSWORD = "toawang123";
export const TEST_PASSWORD = "123456"; // 2 บัญชี present: usr1@email.com (มะลิ) · usr2@email.com (สมชาย)
export const MIN_REVIEWS_FOR_RANKING = 5;

const hm = 60;

type Seed = {
  slug: string;
  name: string;
  cuisine: string;
  description: string;
  owner: string;
  seats: number;
  open: number;
  close: number;
  lead: number;
  stars: [number, number, number, number, number]; // จำนวนรีวิว 5★ 4★ 3★ 2★ 1★
  by?: { who: string; star: number; comment: string }[]; // รีวิวของบัญชี present (นับรวมใน stars)
};

const restaurants: Seed[] = [
  { slug: "krua-rim-klong", name: "ครัวริมคลอง", cuisine: "อาหารไทยภาคกลาง · ริมน้ำ",
    description: "กับข้าวไทยภาคกลางรสมือแม่ แกงเขียวหวาน ปลาทอดน้ำปลา ผัดผักบุ้งไฟแดง นั่งริมคลองรับลมเย็น ๆ\nมีที่จอดรถหน้าร้าน 4 คัน · แนะนำจองช่วงเที่ยงเพราะคนเยอะ",
    owner: "nid", seats: 10, open: 11 * hm, close: 22 * hm, lead: 30, stars: [104, 18, 3, 1, 0],
    by: [{ who: "somchai", star: 5, comment: "แกงเขียวหวานเข้มข้นมาก นั่งริมคลองลมเย็นสบาย" }, { who: "mali", star: 4, comment: "อร่อย แต่ช่วงเที่ยงรอนิดหน่อย จองก่อนดีกว่า" }] },
  { slug: "somtam-na-talad", name: "ส้มตำหน้าตลาด", cuisine: "อาหารอีสาน · ส้มตำ ไก่ย่าง",
    description: "ส้มตำครกใหญ่ ไก่ย่างเตาถ่าน ข้าวเหนียวร้อน ๆ รสจัดจ้านแบบอีสานแท้\nอยู่หน้าตลาดเช้า เดินจากป้ายรถเมล์ 2 นาที",
    owner: "somsak", seats: 24, open: 10 * hm, close: 20 * hm, lead: 60, stars: [220, 70, 15, 4, 2],
    by: [{ who: "somchai", star: 4, comment: "ไก่ย่างหนังกรอบ ส้มตำเผ็ดกำลังดี" }] },
  { slug: "kuay-tiew-ruea", name: "ก๋วยเตี๋ยวเรือหน้าวัด", cuisine: "ก๋วยเตี๋ยวเรือ · ชามเล็ก",
    description: "ก๋วยเตี๋ยวเรือน้ำตกชามเล็ก หมูตุ๋นเปื่อย กากหมูกรอบ สั่งทีละหลายชามเป็นเรื่องปกติ\nเปิดเช้าถึงบ่าย หมดแล้วปิดเลย",
    owner: "muay", seats: 16, open: 9 * hm, close: 16 * hm, lead: 120, stars: [30, 18, 6, 3, 1],
    by: [{ who: "mali", star: 4, comment: "น้ำตกเข้มข้น ชามเล็กกินได้หลายชาม" }] },
  { slug: "khao-tom-tha-nam", name: "ข้าวต้มโต้รุ่งท่าน้ำ", cuisine: "ข้าวต้ม กับข้าว · โต้รุ่ง",
    description: "ข้าวต้มร้อน ๆ กับข้าวกว่า 30 อย่าง ผัดคะน้าหมูกรอบ ไข่เจียวฟู ปลาทอด\nเปิดยาวถึงตีสอง ช่วงหลังเที่ยงคืนนับเป็นรอบของคืนเดียวกัน",
    owner: "mali", seats: 20, open: 18 * hm, close: 2 * hm, lead: 60, stars: [27, 11, 3, 1, 0] },
  { slug: "pa-daeng", name: "ร้านป้าแดงเปิดใหม่", cuisine: "ข้าวแกง · อาหารตามสั่ง",
    description: "ข้าวแกงหม้อใหญ่ แกงส้ม ไข่พะโล้ และอาหารตามสั่ง ร้านเพิ่งเปิดเดือนนี้",
    owner: "daeng", seats: 8, open: 11 * hm, close: 19 * hm, lead: 30, stars: [1, 0, 0, 0, 0] },
  { slug: "khanom-jeen-khun-yai", name: "บ้านขนมจีนคุณยาย", cuisine: "ขนมจีน · น้ำยาปักษ์ใต้",
    description: "ขนมจีนเส้นสดทำเองทุกเช้า น้ำยาปักษ์ใต้ แกงไตปลา ผักเหนาะเติมไม่อั้น",
    owner: "pen", seats: 12, open: 7 * hm, close: 14 * hm, lead: 30, stars: [68, 16, 4, 1, 0] },
  { slug: "kafae-tai-tun", name: "กาแฟใต้ถุนบ้าน", cuisine: "กาแฟ ขนมไทย",
    description: "กาแฟโบราณชงถุงผ้า ขนมชั้น ข้าวเหนียวสังขยา นั่งใต้ถุนบ้านไม้เก่าลมโกรก",
    owner: "mali", seats: 12, open: 8 * hm, close: 16 * hm, lead: 30, stars: [15, 2, 0, 0, 0] },
  { slug: "mookata-rim-tang", name: "หมูกระทะริมทาง", cuisine: "หมูกระทะ · บุฟเฟต์",
    description: "หมูกระทะเตาถ่าน บุฟเฟต์ไม่จำกัดเวลา น้ำจิ้มสูตรเด็ด เปิดถึงตีหนึ่ง",
    owner: "kaew", seats: 40, open: 17 * hm, close: 1 * hm, lead: 60, stars: [60, 40, 12, 5, 3],
    by: [{ who: "somchai", star: 5, comment: "หมูหมักนุ่ม น้ำจิ้มจัดจ้าน มากันเป็นแก๊งคุ้มมาก" }] },
  { slug: "khao-man-kai", name: "ข้าวมันไก่ประตูน้ำ", cuisine: "ข้าวมันไก่ · ต้ม ทอด",
    description: "ข้าวมันไก่ต้มนุ่ม ไก่ทอดกรอบ น้ำจิ้มเต้าเจี้ยวสูตรเก่า เปิดตั้งแต่ 6 โมงเช้า",
    owner: "chai", seats: 18, open: 6 * hm, close: 14 * hm, lead: 30, stars: [150, 30, 8, 2, 1],
    by: [{ who: "mali", star: 5, comment: "ข้าวหอมมัน ไก่นุ่ม น้ำจิ้มเด็ด" }, { who: "somchai", star: 5, comment: "มื้อเช้าที่ดีที่สุดในย่าน" }] },
  { slug: "suki-baan-mai", name: "สุกี้บ้านไม้", cuisine: "สุกี้ · ชาบู",
    description: "สุกี้น้ำซุปกระดูกเคี่ยว 8 ชั่วโมง หมูสไลซ์บาง ผักสดจากสวน โต๊ะใหญ่รองรับครอบครัว",
    owner: "noi", seats: 30, open: 11 * hm, close: 22 * hm, lead: 45, stars: [40, 35, 15, 6, 4],
    by: [{ who: "somchai", star: 4, comment: "น้ำซุปหวานกลมกล่อม เสียดายวันหยุดคนเยอะ" }] },
  { slug: "nam-cha-yam-chao", name: "ร้านน้ำชายามเช้า", cuisine: "ติ่มซำ · น้ำชา",
    description: "ติ่มซำนึ่งร้อน ๆ ขนมจีบ ซาลาเปา น้ำชาร้อน เปิดตีห้าครึ่ง ปิดก่อนเที่ยง",
    owner: "noi", seats: 16, open: 5 * hm + 30, close: 11 * hm, lead: 30, stars: [25, 10, 2, 0, 0] },
  { slug: "tom-yum-boran", name: "เตี๋ยวต้มยำโบราณ", cuisine: "ก๋วยเตี๋ยวต้มยำ",
    description: "ก๋วยเตี๋ยวต้มยำน้ำข้นสูตรโบราณ ใส่ถั่วลิสงคั่ว หมูกรอบ ลูกชิ้นปลาทำเอง",
    owner: "ya", seats: 14, open: 10 * hm, close: 21 * hm, lead: 30, stars: [12, 15, 8, 3, 2] },
  { slug: "krua-tai", name: "ครัวใต้หรอยจังฮู้", cuisine: "อาหารใต้ · แกงไตปลา คั่วกลิ้ง",
    description: "อาหารใต้รสจัด คั่วกลิ้ง แกงเหลือง แกงไตปลา ผักเหนาะจัดเต็ม เผ็ดตามสั่งได้",
    owner: "somsak", seats: 22, open: 10 * hm + 30, close: 21 * hm + 30, lead: 60, stars: [70, 20, 5, 1, 1] },
  { slug: "khao-soi-cm", name: "ข้าวซอยเชียงใหม่", cuisine: "อาหารเหนือ · ข้าวซอย",
    description: "ข้าวซอยไก่น้ำแกงเข้มข้น น้ำเงี้ยว ไส้อั่ว แคบหมู สูตรจากเชียงใหม่ เพิ่งย้ายมาเปิดสาขานี้",
    owner: "pen", seats: 20, open: 9 * hm, close: 17 * hm, lead: 30, stars: [3, 1, 0, 0, 0] },
  { slug: "jok-tee-ha", name: "ร้านโจ๊กตีห้า", cuisine: "โจ๊ก · ปาท่องโก๋ · โต้รุ่ง",
    description: "โจ๊กหมูสับใส่ไข่ ปาท่องโก๋ทอดใหม่ น้ำเต้าหู้ร้อน เปิดสี่ทุ่มถึงตีห้า",
    owner: "chai", seats: 12, open: 22 * hm, close: 5 * hm, lead: 30, stars: [30, 12, 3, 1, 0] },
  { slug: "somtam-saep", name: "ส้มตำปูปลาร้าแซ่บ", cuisine: "อาหารอีสาน · ปลาร้า",
    description: "ตำปูปลาร้านัว ลาบหมู คอหมูย่าง ต้มแซ่บ ร้านเพิงริมถนน",
    owner: "ya", seats: 18, open: 11 * hm, close: 21 * hm, lead: 30, stars: [20, 25, 20, 10, 5] },
  { slug: "cafe-rim-na", name: "คาเฟ่ริมนา", cuisine: "คาเฟ่ · เบเกอรี่",
    description: "คาเฟ่วิวทุ่งนา ครัวซองต์อบสดทุกเช้า ลาเต้เมล็ดคั่วเอง นั่งทำงานได้ทั้งวัน",
    owner: "noi", seats: 28, open: 8 * hm, close: 18 * hm, lead: 120, stars: [45, 20, 4, 1, 0] },
  { slug: "talay-chay-le", name: "บ้านชายเลซีฟู้ด", cuisine: "อาหารทะเล · ริมหาด",
    description: "ซีฟู้ดสดจากเรือประมง ปูผัดผงกะหรี่ กุ้งเผา ปลากะพงนึ่งมะนาว โต๊ะริมหาดรับลมทะเล\nร้านเตรียมวัตถุดิบตามยอดจอง จึงขอให้ยกเลิกล่วงหน้า 3 ชั่วโมง",
    owner: "kaew", seats: 50, open: 11 * hm, close: 23 * hm, lead: 180, stars: [85, 40, 10, 3, 2],
    by: [{ who: "mali", star: 5, comment: "ปูเนื้อแน่น กุ้งสดมาก วิวทะเลสวย" }] },
  { slug: "jay-jai-dee", name: "ครัวมังสวิรัติใจดี", cuisine: "มังสวิรัติ · อาหารเจ",
    description: "อาหารมังสวิรัติและอาหารเจ ผัดผักรวม แกงเขียวหวานเจ เต้าหู้ทอด ร้านเพิ่งเปิด ยังไม่มีรีวิว",
    owner: "ya", seats: 10, open: 7 * hm, close: 15 * hm, lead: 30, stars: [0, 0, 0, 0, 0] },
  { slug: "khanom-mae-mali", name: "ขนมไทยแม่มะลิ", cuisine: "ขนมไทย · เครื่องดื่ม",
    description: "บัวลอยไข่หวาน ทับทิมกรอบ ขนมถ้วย ชาใบเตยเย็น ร้านเล็ก ๆ ของมะลิ",
    owner: "mali", seats: 8, open: 9 * hm, close: 17 * hm, lead: 30, stars: [2, 0, 1, 0, 0] },
];

const named: { key: string; name: string; email?: string }[] = [
  { key: "mali", name: "มะลิ ศรีสุข", email: "usr1@email.com" }, // present: เจ้าของ 3 ร้าน + เป็นลูกค้าร้านอื่น
  { key: "somchai", name: "สมชาย ใจดี", email: "usr2@email.com" }, // present: ลูกค้า
  { key: "nid", name: "เชฟนิด ริมคลอง" },
  { key: "somsak", name: "ลุงสมศักดิ์" },
  { key: "muay", name: "เจ๊หมวย" },
  { key: "daeng", name: "ป้าแดง" },
  { key: "pen", name: "ยายเพ็ญ" },
  { key: "kaew", name: "พี่แก้ว ชายเล" },
  { key: "chai", name: "เฮียชัย" },
  { key: "noi", name: "น้อยหน่า" },
  { key: "ya", name: "ยาใจ" },
];

const firstNames = ["ต้นกล้า", "น้ำฝน", "ภูผา", "ใบเตย", "กานต์", "ปลายฟ้า", "ธนา", "มุกดา", "ก้อง", "พิมพ์", "เอกชัย", "ขวัญใจ",
  "นที", "ดาว", "วีระ", "แพรวา", "ชยพล", "อรุณี", "ปกรณ์", "จันทร์เพ็ญ", "สิทธิ", "บัว", "ณัฐ", "ลำดวน", "พงศ์", "ฝ้าย", "กิตติ", "มะปราง"];
const initials = ["ก.", "ข.", "จ.", "ช.", "ด.", "ต.", "ท.", "น.", "บ.", "ป.", "พ.", "ม.", "ร.", "ล.", "ว.", "ส.", "อ."];

const comments: Record<number, string[]> = {
  5: ["อร่อยมาก ต้องกลับมาอีก", "รสชาติจัดจ้าน ถูกปากสุด ๆ", "บริการดี อาหารออกไว", "บรรยากาศดีมาก พาครอบครัวมาทุกคนชอบ", "",
    "คุ้มค่ามาก ราคาไม่แรง", "จองผ่านแอปสะดวก ไปถึงมีโต๊ะรอเลย", "วัตถุดิบสด ปรุงถึงเครื่อง", "พนักงานยิ้มแย้ม แนะนำเมนูดี", ""],
  4: ["อร่อย แต่ช่วงเที่ยงคนเยอะรอนิดหน่อย", "โดยรวมดี ที่จอดรถหายาก", "อาหารดี น้ำจิ้มเด็ด", "", "รสชาติดี ราคาสูงไปนิด", "ร้านสะอาด อาหารออกช้านิดหน่อย"],
  3: ["พอใช้ได้ รสชาติกลาง ๆ", "วันนี้อาหารออกช้า", "", "ที่นั่งแคบไปหน่อย"],
  2: ["รสชาติไม่เหมือนเดิม", "รอนานเกินไป", "เค็มไปหน่อย"],
  1: ["ผิดหวังกับรอบนี้", "จองแล้วยังต้องรอโต๊ะ"],
};

// สุ่มแบบกำหนด seed (mulberry32) → เริ่มกี่ครั้งก็ได้ข้อมูลหน้าตาเดิม
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const perm = (n: number) => {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = int(i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  };
  return { int, perm };
}

export function seedStore(now = Date.now()): Store {
  const s = emptyStore();
  const r = rng(2569);
  const addUser = (name: string, email: string): User => {
    const u = { id: nextId(s, "user"), name, email, password: SEED_PASSWORD, createdAt: now };
    s.users.push(u);
    return u;
  };

  const users: Record<string, User> = {};
  for (const n of named) users[n.key] = addUser(n.name, n.email ?? `${n.key}@example.com`);
  // 2 บัญชี present ใช้รหัส 123456 (ตรงกับ TestPassword ใน seed.go)
  users.mali.password = users.somchai.password = TEST_PASSWORD;
  // ผู้รีวิว 400 คน (1 คนรีวิวได้ครั้งเดียวต่อร้าน → ร้านที่มี 311 รีวิวต้องมีคนอย่างน้อย 311 คน)
  const reviewers = Array.from({ length: 400 }, (_, i) =>
    addUser(
      `${firstNames[i % firstNames.length]} ${initials[Math.floor(i / firstNames.length) % initials.length]}`,
      `reviewer${String(i + 1).padStart(3, "0")}@example.com`,
    ),
  );

  // ---- ร้าน · รูปเสิร์ฟจาก api/internal/seed/images ผ่าน /uploads/seed-<slug>-N.jpg ----
  const shops: Record<string, number> = {};
  for (const x of restaurants) {
    const id = nextId(s, "restaurant");
    shops[x.slug] = id;
    s.restaurants.push({
      id, ownerId: users[x.owner].id, name: x.name, cuisine: x.cuisine, description: x.description,
      seats: x.seats, open: x.open, close: x.close, lead: x.lead,
      images: [1, 2].map((n) => `/uploads/seed-${x.slug}-${n}.jpg`),
    });
  }

  // ---- รีวิว: จำนวนแต่ละดาวตามที่กำหนด → ค่าเฉลี่ย/จำนวนรีวิวตรงกับ Go ----
  for (const x of restaurants) {
    const stars = x.stars.flatMap((count, i) => Array<number>(count).fill(5 - i));
    const authors: (User | undefined)[] = [];
    const texts: string[] = [];
    for (const p of x.by ?? []) {
      const i = stars.findIndex((star, k) => star === p.star && !authors[k]);
      authors[i] = users[p.who];
      texts[i] = p.comment;
    }
    const pool = r.perm(reviewers.length);
    let k = 0;
    stars.forEach((star, i) => {
      if (!authors[i]) {
        authors[i] = reviewers[pool[k++]];
        texts[i] = comments[star][r.int(comments[star].length)];
      }
      const time = now - (1 + r.int(180 * 24)) * 3600_000;
      const review: Review = {
        id: nextId(s, "review"), restaurantId: shops[x.slug], userId: authors[i]!.id, rating: star,
        comment: texts[i], createdAt: time, updatedAt: time,
      };
      s.reviews.push(review);
    });
  }

  // ---- การจอง: ใช้ createBooking ตัวเดียวกับ API → ผ่านกติกาจริงทุกข้อ ----
  const today = dateOf(now);
  const day = (offset: number) => addDays(today, offset);
  const book = (slug: string, user: User, date: string, start: string, end: string, partySize: number) => {
    try {
      return createBooking(s, shops[slug], user.id, { date, start, end, partySize }, now);
    } catch {
      return null; // เช่น เวลาวันนี้ผ่านไปแล้ว → ข้ามเหมือน Go
    }
  };
  const cancel = (b: ReturnType<typeof book>, user: User) => {
    try {
      if (b) cancelBooking(s, b.id, user.id, now);
    } catch {
      // เลยเวลายกเลิกแล้ว (การจองวันนี้ที่ใกล้ถึงเวลา) → ข้ามเหมือน Go (`_ = booking.Cancel(...)`)
      // ไม่งั้น seed ล่มทั้งก้อน และ mock ตอบ 500 ทุก request ในบางช่วงเวลาของวัน
    }
  };
  const { somchai, mali } = users;

  // สมชาย: เคสเดโม ครัวริมคลอง 10 ที่ พรุ่งนี้ 12:00–13:00 สมชาย 7 + อีกคน 3 = เต็มพอดี → ลองแก้ 7→8 ✕ / 7→5 ✓
  book("krua-rim-klong", somchai, day(1), "12:00", "13:00", 7);
  book("krua-rim-klong", reviewers[0], day(1), "12:00", "13:00", 3);
  book("mookata-rim-tang", somchai, day(0), "20:00", "21:30", 4);
  book("khao-tom-tha-nam", somchai, day(0), "22:00", "23:00", 2);
  // เลยเวลายกเลิกแล้ว: ร้านทะเลให้ยกเลิกล่วงหน้า 3 ชม. แต่การจองนี้เริ่มในอีกไม่ถึงชั่วโมง → ปุ่มแก้/ยกเลิก disabled
  const halfHour = 30 * 60_000;
  const start = Math.floor(now / halfHour) * halfHour + 2 * halfHour;
  const startMin = Math.round((start - at(today, 0)) / 60_000);
  if (dateOf(start) === today && startMin >= 11 * hm && startMin < 22 * hm) {
    book("talay-chay-le", somchai, today, formatHHMM(startMin), formatHHMM(Math.min(startMin + 120, 23 * hm)), 2);
  }
  book("khao-tom-tha-nam", somchai, day(1), "23:30", "01:00", 2); // ร้านข้ามเที่ยงคืน
  book("suki-baan-mai", somchai, day(2), "19:00", "20:30", 4);
  book("cafe-rim-na", somchai, day(3), "14:00", "15:00", 2);
  book("talay-chay-le", somchai, day(4), "18:00", "20:00", 6);
  book("jok-tee-ha", somchai, day(5), "02:00", "03:00", 2);
  book("khao-soi-cm", somchai, day(6), "12:00", "13:00", 3);
  book("krua-tai", somchai, day(7), "18:30", "20:00", 5);
  cancel(book("somtam-na-talad", somchai, day(2), "18:00", "19:00", 4), somchai);
  cancel(book("kuay-tiew-ruea", somchai, day(1), "10:00", "11:00", 2), somchai);

  // มะลิ (เจ้าของ 3 ร้าน) เป็นลูกค้าร้านอื่นด้วย
  book("cafe-rim-na", mali, day(1), "10:00", "11:00", 2);
  book("krua-tai", mali, day(2), "18:00", "19:30", 3);
  book("khanom-jeen-khun-yai", mali, day(3), "09:00", "10:00", 2);
  book("suki-baan-mai", mali, day(5), "12:00", "13:00", 4);
  cancel(book("tom-yum-boran", mali, day(4), "12:00", "13:00", 2), mali);

  // การจองที่ผ่านมาแล้ว — กติกา "ห้ามจองเวลาที่ผ่านไปแล้ว" ทำให้สร้างผ่าน createBooking ไม่ได้ จึงใส่ตรง ๆ
  const past: [string, User, number, number, number, number, boolean][] = [
    ["cafe-rim-na", somchai, 2, 10 * hm, 11 * hm, 2, false], // ยังไม่รีวิว
    ["khanom-jeen-khun-yai", somchai, 3, 9 * hm, 10 * hm, 3, false], // ยังไม่รีวิว
    ["somtam-na-talad", somchai, 6, 12 * hm, 13 * hm, 4, false],
    ["krua-rim-klong", somchai, 10, 18 * hm, 19 * hm + 30, 2, false],
    ["mookata-rim-tang", somchai, 12, 19 * hm, 21 * hm, 5, false],
    ["suki-baan-mai", somchai, 18, 18 * hm + 30, 20 * hm, 3, false],
    ["khao-soi-cm", somchai, 25, 12 * hm, 13 * hm, 2, false], // ยังไม่รีวิว
    ["khao-man-kai", somchai, 30, 7 * hm, 7 * hm + 30, 1, false],
    ["khao-tom-tha-nam", somchai, 9, 19 * hm, 20 * hm, 2, true],
    ["talay-chay-le", mali, 8, 18 * hm, 20 * hm, 4, false],
    ["khao-man-kai", mali, 15, 8 * hm, 9 * hm, 2, false],
    ["kuay-tiew-ruea", mali, 20, 11 * hm, 12 * hm, 2, false],
    ["krua-rim-klong", mali, 5, 12 * hm, 13 * hm, 2, false],
    ["nam-cha-yam-chao", mali, 4, 7 * hm, 8 * hm, 3, false], // ยังไม่รีวิว
  ];
  for (const [slug, user, daysAgo, startM, endM, partySize, cancelled] of past) {
    const date = day(-daysAgo);
    s.bookings.push({
      id: nextId(s, "booking"), restaurantId: shops[slug], userId: user.id, partySize,
      serviceDate: date, startAt: at(date, startM), endAt: at(date, endM), status: cancelled ? "cancelled" : "confirmed",
    });
  }

  // การจองสุ่มของผู้รีวิว วันนี้ถึงอีก 7 วัน → กราฟที่นั่งและ dashboard มีข้อมูล
  for (const x of restaurants) {
    const closeM = x.close <= x.open ? x.close + 1440 : x.close;
    const perDay = 3 + Math.floor(x.seats / 5) + (x.owner === "mali" ? 4 : 0);
    for (let d = 0; d <= 7; d++) {
      const n = perDay + r.int(3);
      for (let i = 0; i < n; i++) {
        const length = 60 + 30 * r.int(3);
        const slots = Math.floor((closeM - x.open - length) / 30);
        if (slots < 0) continue;
        const startM = x.open + 30 * r.int(slots + 1);
        const party = 1 + r.int(Math.max(1, Math.min(8, Math.floor(x.seats / 3))));
        // ช่วงเดโมของครัวริมคลองพรุ่งนี้ ให้เคส 7 + 3 = 10 คงเดิม
        if (x.slug === "krua-rim-klong" && d === 1 && startM < 14 * hm && startM + length > 11 * hm) continue;
        const who = reviewers[r.int(reviewers.length)];
        const b = book(x.slug, who, day(d), formatHHMM(startM), formatHHMM(startM + length), party);
        if (r.int(100) < 8) cancel(b, who); // ~8% ยกเลิก → เจ้าของร้านเห็นสถานะ "ยกเลิกแล้ว"
      }
    }
  }

  return s;
}
