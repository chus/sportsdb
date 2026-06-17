interface TeamCardProps {
  name: string;
  league: string;
  country: string;
  logoText?: string;
  record?: string;
  onClick?: () => void;
}

export function TeamCard({ 
  name, 
  league, 
  country, 
  logoText,
  record,
  onClick 
}: TeamCardProps) {
  return (
    <button
      onClick={onClick}
      className="group bg-surface rounded-xl p-5 border border-line hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg group-hover:scale-105 transition-transform">
          {logoText || name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-ink mb-1 group-hover:text-blue-600 transition-colors truncate">
            {name}
          </h3>
          <p className="text-sm text-muted">{league}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{country}</span>
        {record && (
          <span className="font-medium text-ink">{record}</span>
        )}
      </div>
    </button>
  );
}
