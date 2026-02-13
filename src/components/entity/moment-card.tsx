import { ChevronRight } from "lucide-react";

interface MomentCardProps {
  title: string;
  description: string;
  imageUrl: string;
  label?: string;
  onClick?: () => void;
}

export function MomentCard({ 
  title, 
  description, 
  imageUrl, 
  label,
  onClick 
}: MomentCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-2xl overflow-hidden border border-neutral-200 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-left"
    >
      {/* Image with overlay */}
      <div className="relative h-64 overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        {/* Label */}
        {label && (
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full">
            <span className="text-xs font-semibold text-neutral-900">{label}</span>
          </div>
        )}
        
        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="font-bold text-2xl text-white mb-2 group-hover:text-blue-300 transition-colors">
            {title}
          </h3>
          <p className="text-white/90 text-sm mb-3 line-clamp-2">
            {description}
          </p>
          <div className="flex items-center gap-2 text-white font-medium text-sm">
            <span>Explore</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </button>
  );
}
