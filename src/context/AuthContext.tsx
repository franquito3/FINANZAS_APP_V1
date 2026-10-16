import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/client';
import { signInWithGoogleOAuth, signOutUser } from '../services/auth/googleAuth';
import { connectPowerSync, disconnectAndClearPowerSync, initLocalDatabase } from '../db/powersync';
import { seedLocalDefaults } from '../services/data/seedData';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeUserId = useRef<string | null>(null);

  useEffect(() => {
    // Open local SQLite right away (works offline, before/without login)
    initLocalDatabase().catch((e) => console.error('[Auth] Error abriendo SQLite', e));

    // The persisted session is read from SecureStore, so this works offline too
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Note: no async Supabase calls inside this callback (supabase-js recommendation)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Start sync + seed defaults when a user becomes active
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId || activeUserId.current === userId) return;
    activeUserId.current = userId;

    (async () => {
      await initLocalDatabase();
      await seedLocalDefaults(userId);
      await connectPowerSync();
    })().catch((e) => console.error('[Auth] Error iniciando sesión de datos', e));
  }, [userId]);

  const signInWithGoogle = () => signInWithGoogleOAuth();

  const signOut = async () => {
    const result = await signOutUser();
    activeUserId.current = null;
    await disconnectAndClearPowerSync();
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
