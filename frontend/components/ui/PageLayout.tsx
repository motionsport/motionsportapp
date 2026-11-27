import type { ReactNode } from "react";
import { MotionGymLogo } from "./MotionGymLogo";
import { Header } from "./Header";
import { GymLoader } from "./GymLoader";

interface PageLayoutProps {
  children?: ReactNode;
  variant?: "centered" | "top";
  className?: string;
  action?: ReactNode;
  loading?: boolean;
  // A full-width strip above the header (home page: the review discount promo)
  topBar?: ReactNode;
}

export function PageLayout({ children, variant = "centered", className, action, loading, topBar }: PageLayoutProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <GymLoader className="flex flex-col items-center space-y-7 -mt-10" />
      </div>
    );
  }

  // Bottom room incl. the iPhone home indicator; not on centered pages, where it would push content off center
  if (variant === "top") {
    return (
      <div className="flex flex-col flex-1 pb-[calc(3rem+env(safe-area-inset-bottom))]">
        {topBar}
        <Header action={action} />
        {children}
      </div>
    );
  }

  // Centered by auto margins, not justify-center: on a page taller than the screen (the invite with what is waiting)
  // justify-center pushed the top, logo included, above the screen where it can't be scrolled to. The bottom padding
  // lifts the content a little above the middle, as the old -mt-10 did, and leaves room for the iPhone home indicator
  return (
    <div
      className={`flex-1 flex flex-col pt-6 pb-[calc(4rem+env(safe-area-inset-bottom))]${className ? ` ${className}` : ""}`}
    >
      <div className="my-auto">
        <MotionGymLogo className="w-[100px] h-[100px] sm:w-[150px] sm:h-[150px] mx-auto mb-8" />
        {children}
      </div>
    </div>
  );
}
