import { ChevronRight } from "lucide-react";

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
      className={`w-full text-left border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors rounded flex items-center gap-3 group ${
        isCompact ? "p-2" : "p-3"
      }`}
    >
      {imageUrl && (
        <div className={`flex-shrink-0 bg-neutral-200 rounded overflow-hidden ${
          isCompact ? "w-10 h-10" : "w-12 h-12"
        }`}>
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-neutral-900 truncate ${
          isCompact ? "text-sm" : "text-base"
        }`}>
          {title}
        </div>
        {subtitle && (
          <div className={`text-neutral-600 truncate ${
            isCompact ? "text-xs" : "text-sm"
          }`}>
            {subtitle}
          </div>
        )}
        {meta && meta.length > 0 && (
          <div className={`text-neutral-500 truncate ${
            isCompact ? "text-xs" : "text-xs"
          }`}>
            {meta.join(" · ")}
          </div>
        )}
      </div>
      <ChevronRight className={`flex-shrink-0 text-neutral-400 group-hover:text-neutral-600 ${
        isCompact ? "w-4 h-4" : "w-5 h-5"
      }`} />
    </button>
  );
}
