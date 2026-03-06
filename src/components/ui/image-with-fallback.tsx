"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ImageWithFallbackProps = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
  fallbackClassName?: string;
  iconClassName?: string;
};

export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackClassName,
  iconClassName,
  style,
  onError,
  ...props
}: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false);

  if (!src || didError) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center bg-neutral-100 text-neutral-400",
          className,
          fallbackClassName
        )}
        style={style}
      >
        <ImageIcon className={cn("h-1/2 w-1/2 max-h-8 max-w-8", iconClassName)} />
      </div>
    );
  }

  return (
    <Image
      {...props}
      alt={alt}
      className={className}
      src={src}
      style={style}
      unoptimized
      onError={(event) => {
        setDidError(true);
        onError?.(event);
      }}
    />
  );
}
