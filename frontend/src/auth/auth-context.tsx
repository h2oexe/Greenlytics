import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren
} from "react";
import type { AuthResponse } from "../types/api";
import {
  clearSession,
  getCurrentSession,
  login,
  register,
  restoreSession,
  type LoginInput,
  type RegisterInput
} from "./auth-service";

interface AuthContextValue {
  session: AuthResponse | null;
  loading: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthResponse | null>(() => getCurrentSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const restored = await restoreSession();

      if (!cancelled) {
        setSession(restored);
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    session,
    loading,
    signIn: async (input) => {
      const next = await login(input);
      setSession(next);
    },
    signUp: async (input) => {
      const next = await register(input);
      setSession(next);
    },
    signOut: () => {
      clearSession();
      setSession(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
