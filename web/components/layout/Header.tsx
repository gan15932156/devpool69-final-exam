import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { AvatarMenu } from "./AvatarMenu";
import { NavLinks } from "./NavLinks";

export async function Header() {
  const session = await auth();
  return (
    <>
      <header className="bg-paper">
        <div className="mx-auto flex h-[60px] max-w-[1200px] items-center justify-between px-4 md:h-20 md:px-8 xl:px-0">
          <Logo tagline />
          <NavLinks />
          {session ? (
            <AvatarMenu name={session.user.name ?? ""} />
          ) : (
            <ButtonLink href="/login" variant="outline" size="sm">
              เข้าสู่ระบบ
            </ButtonLink>
          )}
        </div>
      </header>
      <div className="band-kruay-choeng" aria-hidden />
    </>
  );
}
