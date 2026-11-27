import Link from "next/link";

// Under the sign-up button (/register, /invite). Opens in a new tab, so the form keeps what was typed
export function PrivacyNote() {
  return (
    <p className="text-subtle text-xs text-center">
      Реєструючись, ви погоджуєтеся з{" "}
      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">
        Політикою конфіденційності
      </Link>
    </p>
  );
}
