import { ChevronRight } from "lucide-react";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

interface KnowledgeCardProps {
  title: string;
  subtitle?: string;
  meta?: string[];
  imageUrl?: string;
  onClick?: () => void;
  size?: "compact" | "default";
}

export function KnowledgeCard({ 
  title, 
  subtitle, 
  meta, 
  imageUrl, 
  onClick, 
  size = "default" 
}: KnowledgeCardProps) {
  const isCompact = size === "compact";
  
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border border-line bg-surface hover:bg-surface-2 transition-colors rounded flex items-center gap-3 group ${
        isCompact ? "p-2" : "p-3"
      }`}
    >
      {imageUrl && (
        <div className={`flex-shrink-0 bg-surface-2 rounded overflow-hidden ${
          isCompact ? "w-10 h-10" : "w-12 h-12"
        }`}>
          <ImageWithFallback
            src={imageUrl}
            alt={title}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-ink truncate ${
          isCompact ? "text-sm" : "text-base"
        }`}>
          {title}
        </div>
        {subtitle && (
          <div className={`text-muted truncate ${
            isCompact ? "text-xs" : "text-sm"
          }`}>
            {subtitle}
          </div>
        )}
        {meta && meta.length > 0 && (
          <div className={`text-muted truncate ${
            isCompact ? "text-xs" : "text-xs"
          }`}>
            {meta.join(" · ")}
          </div>
        )}
      </div>
      <ChevronRight className={`flex-shrink-0 text-faint group-hover:text-muted ${
        isCompact ? "w-4 h-4" : "w-5 h-5"
      }`} />
    </button>
  );
}
