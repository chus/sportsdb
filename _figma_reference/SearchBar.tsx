import { Search, X } from "lucide-react";
import { useState } from "react";

interface SearchResult {
  id: string;
  type: "player" | "team" | "staff" | "match" | "competition";
  title: string;
  subtitle: string;
  meta?: string;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  onResultClick: (result: SearchResult) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

const mockResults: SearchResult[] = [
  { id: "1", type: "player", title: "Erling Haaland", subtitle: "Manchester City", meta: "Forward" },
  { id: "2", type: "player", title: "Kylian Mbappé", subtitle: "Real Madrid", meta: "Forward" },
  { id: "3", type: "team", title: "Manchester City", subtitle: "Premier League", meta: "England" },
  { id: "4", type: "team", title: "Manchester United", subtitle: "Premier League", meta: "England" },
  { id: "5", type: "match", title: "Man City 2-1 Man Utd", subtitle: "Premier League", meta: "Feb 8, 2026" },
];

export function SearchBar({ onSearch, onResultClick, autoFocus, placeholder = "Search players, teams, matches..." }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  
  const handleInputChange = (value: string) => {
    setQuery(value);
    if (value.length > 0) {
      // Mock autocomplete - filter results
      const filtered = mockResults.filter(r => 
        r.title.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      setIsFocused(false);
    }
  };
  
  const handleResultClick = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    setIsFocused(false);
    onResultClick(result);
  };
  
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      player: "Player",
      team: "Team",
      staff: "Staff",
      match: "Match",
      competition: "Competition"
    };
    return labels[type] || type;
  };
  
  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            autoFocus={autoFocus}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-3 border border-neutral-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
      
      {isFocused && results.length > 0 && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsFocused(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-300 rounded-lg shadow-lg overflow-hidden z-20 max-h-[400px] overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-3 text-left hover:bg-neutral-50 border-b border-neutral-100 last:border-b-0 flex items-center gap-3"
              >
                <div className="flex-1">
                  <div className="font-medium text-neutral-900">{result.title}</div>
                  <div className="text-sm text-neutral-600">{result.subtitle}</div>
                </div>
                <div className="flex items-center gap-2">
                  {result.meta && (
                    <span className="text-xs text-neutral-500">{result.meta}</span>
                  )}
                  <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                    {getTypeLabel(result.type)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
