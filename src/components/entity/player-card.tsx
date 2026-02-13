import { TrendingUp } from "lucide-react";

interface PlayerCardProps {
  name: string;
  position: string;
  team: string;
  imageUrl?: string;
  trending?: boolean;
  stats?: string;
  onClick?: () => void;
}

export function PlayerCard({ 
  name, 
  position, 
  team, 
  imageUrl, 
  trending,
  stats,
  onClick 
}: PlayerCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-white rounded-xl overflow-hidden border border-neutral-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative h-56 bg-gradient-to-br from-neutral-100 to-neutral-200 overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            👤
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Trending badge */}
        {trending && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full flex items-center gap-1 shadow-lg">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Trending</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-neutral-900 mb-1 group-hover:text-blue-600 transition-colors">
          {name}
        </h3>
        <p className="text-sm text-neutral-600 mb-2">{position}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">{team}</span>
          {stats && (
            <span className="text-xs text-neutral-500">{stats}</span>
          )}
        </div>
      </div>
    </button>
  );
}
