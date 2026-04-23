"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type Role = 'doctor' | 'admin';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
      Promise.race([
        Promise.resolve(p),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('profile-fetch-timeout')), ms)
        ),
      ]);

    const fetchRole = async (userId: string): Promise<Role | null> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await withTimeout(
            supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
            5000
          );
          const { data: profile, error } = result;
          if (!error && profile?.role) return profile.role as Role;
          if (error) await new Promise((r) => setTimeout(r, 400));
        } catch {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      return null;
    };

    const resolveSession = async (session: Session | null) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      try {
        const nextRole = currentUser ? await fetchRole(currentUser.id) : null;
        setRole(nextRole);
      } catch {
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void resolveSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
