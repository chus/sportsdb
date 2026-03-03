"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  FormEvent,
} from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "./auth-provider";
import { cn } from "@/lib/utils/cn";

type AuthTab = "signin" | "signup";

interface AuthModalContextType {
  isOpen: boolean;
  tab: AuthTab;
  openModal: (tab?: AuthTab) => void;
  closeModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined
);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>("signin");

  const openModal = useCallback((t: AuthTab = "signin") => {
    setTab(t);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AuthModalContext.Provider value={{ isOpen, tab, openModal, closeModal }}>
      {children}
      {isOpen && <AuthModal tab={tab} onTabChange={setTab} onClose={closeModal} />}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
}

function AuthModal({
  tab,
  onTabChange,
  onClose,
}: {
  tab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">
            {tab === "signin" ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-sm text-neutral-500">
            {tab === "signin"
              ? "Sign in to your SportsDB account"
              : "Join SportsDB to follow your favorite teams and players"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex mx-8 border-b border-neutral-200">
          <button
            onClick={() => onTabChange("signin")}
            className={cn(
              "flex-1 pb-3 text-sm font-medium border-b-2 transition-colors",
              tab === "signin"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => onTabChange("signup")}
            className={cn(
              "flex-1 pb-3 text-sm font-medium border-b-2 transition-colors",
              tab === "signup"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            )}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          {tab === "signin" ? (
            <SignInForm onSuccess={onClose} />
          ) : (
            <SignUpForm onSuccess={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || "Invalid email or password");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="signin-email" className="block text-sm font-medium text-neutral-700 mb-1">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="signin-password" className="block text-sm font-medium text-neutral-700 mb-1">
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
          placeholder="Enter your password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Sign In
      </button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signup(email, password, name || undefined);
    setLoading(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || "Something went wrong");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="signup-name" className="block text-sm font-medium text-neutral-700 mb-1">
          Name <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-neutral-700 mb-1">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-700 mb-1">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
          placeholder="At least 8 characters"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Account
      </button>
    </form>
  );
}
