import { Clock, Star, Users } from "lucide-react";
import { FewReviewsBadge, LateNightBadge, OwnBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DomeImage } from "@/components/ui/DomeImage";
import { RatingSeal } from "@/components/ui/RatingSeal";
import { hoursText, ratingText, reviewCountText } from "@/lib/format";
import type { Restaurant } from "@/lib/types";

// การ์ดร้านในหน้าค้นหา (และตัวอย่างในฟอร์มร้าน) · isOwn = ร้านของคนที่ login อยู่
export function RestaurantCard({ restaurant: r, isOwn, preview }: { restaurant: Restaurant; isOwn: boolean; preview?: boolean }) {
  return (
    <article className="relative flex flex-col rounded-xl border border-line bg-surface p-3 shadow-card">
      <div className="relative">
        <DomeImage src={r.images[0]} alt={r.name} className="h-[200px]" />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {isOwn && <OwnBadge />}
          {r.crossesMidnight && <LateNightBadge />}
        </div>
      </div>
      <RatingSeal
        avg={r.avgRating}
        count={r.reviewCount}
        enough={r.hasEnoughReviews}
        className="absolute top-[178px] right-[26px] ring-4 ring-surface"
      />
      <div className="flex flex-1 flex-col gap-2.5 px-2 pt-[18px] pb-1.5">
        <div className="pr-[70px]">
          <h3 className="font-heading text-[22px] leading-[1.35]">{r.name}</h3>
          {r.cuisine && <p className="mt-0.5 text-[15px] text-muted">{r.cuisine}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
          <Star size={16} className="fill-gold text-gold" aria-hidden />
          <span className="font-bold">{ratingText(r.avgRating)}</span>
          <span className="text-muted">· {reviewCountText(r.reviewCount)}</span>
          {!r.hasEnoughReviews && <FewReviewsBadge />}
        </div>
        <div className="flex items-center gap-4 border-t border-dashed border-line-strong pt-2.5 text-[15px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <Users size={16} aria-hidden />
            {r.seats} ที่นั่ง
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={16} aria-hidden />
            {hoursText(r.openTime, r.closeTime)}
          </span>
        </div>
        {!preview && (
          <ButtonLink
            href={isOwn ? `/owner?r=${r.id}` : `/restaurants/${r.id}`}
            variant={isOwn ? "outline" : "primary"}
            className="mt-auto"
          >
            {isOwn ? "จัดการร้าน" : "ดูร้านและจอง"}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
