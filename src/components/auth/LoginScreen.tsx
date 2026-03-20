import React, { useState, useEffect, type FormEvent } from 'react';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
}

interface AuthResult {
  user: UserProfile;
  profile: UserProfile;
}

export interface LoginScreenProps {
  /** Callback when authentication state changes */
  onAuthChange: (result: AuthResult) => void;
}

type AuthMode = 'signin' | 'signup' | 'link-sent';

export function LoginScreen({ onAuthChange }: LoginScreenProps): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  // Wait for API to be ready
  useEffect(() => {
    const checkApi = (): boolean => {
      const enabled = (window as unknown as { api?: { enabled?: boolean } }).api?.enabled;
      if (enabled) {
        setApiReady(true);
        setApiUnavailable(false);
        return true;
      }
      if (typeof enabled === 'boolean' && !enabled) {
        setApiReady(false);
        setApiUnavailable(true);
        return true;
      }
      return false;
    };

    if (checkApi()) return;

    // Listen for API ready event
    const handleApiReady = () => checkApi();
    window.addEventListener('pm-api-ready', handleApiReady);

    // Poll as fallback
    const interval = setInterval(() => {
      if (checkApi()) clearInterval(interval);
    }, 100);

    return () => {
      window.removeEventListener('pm-api-ready', handleApiReady);
      clearInterval(interval);
    };
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    if (!apiReady) return;

    const api = (window as unknown as { api: Record<string, unknown> }).api;

    const checkSession = async () => {
      try {
        const session = await (api.getSession as () => Promise<{ user?: UserProfile } | null>)();
        if (session?.user) {
          const profile = await (api.getCurrentUser as () => Promise<UserProfile | null>)();
          if (profile) {
            onAuthChange({ user: session.user, profile });
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    };

    checkSession();

    // Listen for auth state changes (e.g., magic link redirect)
    const unsubscribe = (
      api.onAuthStateChange as (
        callback: (event: string, session: { user?: UserProfile } | null) => void,
      ) => () => void
    )(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await (api.getCurrentUser as () => Promise<UserProfile | null>)();
        if (profile) {
          onAuthChange({ user: session.user, profile });
        }
      }
    });

    return unsubscribe;
  }, [apiReady, onAuthChange]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiReady) return;
    setLoading(true);
    setError('');

    const api = (window as unknown as { api: Record<string, unknown> }).api;

    try {
      const normalizedEmail = email.trim();
      const result = await (
        api.signInWithMagicLink as (params: { email: string }) => Promise<{
          ok: boolean;
          message?: string;
          error?: string;
        }>
      )({ email: normalizedEmail });
      if (result.ok) {
        setMode('link-sent');
        setSuccess(result.message || 'Check your email for the sign-in link');
      } else {
        setError(result.error || 'Sign in failed. Please try again.');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError((err as Error).message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiReady) return;

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const api = (window as unknown as { api: Record<string, unknown> }).api;

    try {
      const normalizedEmail = email.trim();
      const result = await (
        api.signUp as (params: { email: string; password: string }) => Promise<{
          ok: boolean;
          needsVerification?: boolean;
          message?: string;
          user?: UserProfile;
          error?: string;
        }>
      )({ email: normalizedEmail, password });

      if (result.ok) {
        if (result.needsVerification) {
          setMode('link-sent');
          setSuccess(result.message || 'Check your email for verification link');
        } else if (result.user) {
          const profile = await (api.getCurrentUser as () => Promise<UserProfile | null>)();
          if (profile) {
            onAuthChange({ user: result.user, profile });
          }
        }
      } else {
        setError(result.error || 'Sign up failed. Please try again.');
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError((err as Error).message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiReady) return;
    setLoading(true);
    setError('');

    const api = (window as unknown as { api: Record<string, unknown> }).api;

    try {
      const normalizedEmail = email.trim();
      const result = await (
        api.login as (params: { email: string; password: string }) => Promise<{
          ok: boolean;
          user?: UserProfile;
          error?: string;
        }>
      )({ email: normalizedEmail, password });
      if (result.ok && result.user) {
        const profile = await (api.getCurrentUser as () => Promise<UserProfile | null>)();
        if (profile) {
          onAuthChange({ user: result.user, profile });
        }
      } else {
        setError(result.error || 'Invalid email or password.');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError((err as Error).message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: '#cfebf8' }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-ocean-900">Content Dashboard</h1>
          <p className="text-graystone-600">
            {mode === 'signin'
              ? 'Sign in to your account'
              : mode === 'signup'
                ? 'Create your account'
                : 'Check your email'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {apiUnavailable && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Live authentication is currently unavailable. The app has paused backend requests for
            this session to avoid repeated network errors.
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Link Sent Confirmation */}
        {mode === 'link-sent' && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ocean-100">
              <svg
                className="h-8 w-8 text-ocean-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-graystone-600">
              We sent a link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-graystone-500">
              Click the link in your email to sign in. The link will expire in 1 hour.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setSuccess('');
              }}
              className="text-sm text-ocean-600 hover:underline"
            >
              Use a different email
            </button>
          </div>
        )}

        {/* Sign In Form */}
        {mode === 'signin' && (
          <form onSubmit={handlePasswordSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="signin-email"
                className="mb-1 block text-sm font-medium text-graystone-700"
              >
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label
                htmlFor="signin-password"
                className="mb-1 block text-sm font-medium text-graystone-700"
              >
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !apiReady}
              className="w-full rounded-xl bg-ocean-500 py-3 font-semibold text-white transition hover:bg-ocean-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading || !apiReady || !email}
                className="text-sm text-ocean-600 hover:underline disabled:opacity-50"
              >
                Or sign in with magic link
              </button>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label
                htmlFor="signup-email"
                className="mb-1 block text-sm font-medium text-graystone-700"
              >
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label
                htmlFor="signup-password"
                className="mb-1 block text-sm font-medium text-graystone-700"
              >
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="mb-1 block text-sm font-medium text-graystone-700"
              >
                Confirm Password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !apiReady}
              className="w-full rounded-xl bg-ocean-500 py-3 font-semibold text-white transition hover:bg-ocean-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Toggle between sign in and sign up */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="mt-6 text-center">
            {mode === 'signin' ? (
              <p className="text-sm text-graystone-600">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className="font-semibold text-ocean-600 hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-sm text-graystone-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className="font-semibold text-ocean-600 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        )}

        {!apiReady && (
          <div className="mt-4 text-center text-sm text-amber-600">Loading authentication...</div>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
