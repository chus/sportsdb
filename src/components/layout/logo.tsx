import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <Link
      href="/"
      className="flex items-center gap-3 hover:opacity-90 transition-opacity flex-shrink-0"
    >
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-lg shadow-md" />
        <svg
          className="absolute inset-0 w-full h-full p-2"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="12" cy="6" rx="7" ry="2.5" fill="white" fillOpacity="0.9" />
          <path
            d="M 5 6 L 5 12 C 5 13.38 8.13 14.5 12 14.5 C 15.87 14.5 19 13.38 19 12 L 19 6"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            strokeOpacity="0.9"
          />
          <path
            d="M 5 12 L 5 18 C 5 19.38 8.13 20.5 12 20.5 C 15.87 20.5 19 19.38 19 18 L 19 12"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
            strokeOpacity="0.9"
          />
        </svg>
      </div>

      {showText && (
        <div className="hidden sm:block">
          <div className={`font-bold ${textSizeClasses[size]} tracking-tight text-neutral-900`}>
            DataSports
          </div>
          <div className="text-xs text-neutral-500 -mt-0.5 leading-tight">
            The Sports Database
          </div>
        </div>
      )}
    </Link>
  );
}
