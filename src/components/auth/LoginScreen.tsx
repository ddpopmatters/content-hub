import React, { useState, type FormEvent } from 'react';
import { AUTH, SUPABASE_API } from '../../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string | null;
  is_admin?: boolean;
  features?: string[];
}

interface AuthResult {
  user: UserProfile;
  profile: UserProfile;
}

export interface LoginScreenProps {
  onAuthChange: (result: AuthResult) => void;
}

type AuthMode = 'signin' | 'link-sent';

export function LoginScreen({ onAuthChange }: LoginScreenProps): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await AUTH.signIn(email.trim(), password);
      if (result.error) {
        setError(result.error);
        return;
      }
      const profile = await SUPABASE_API.fetchCurrentUserProfile();
      if (profile) {
        onAuthChange({ user: profile as UserProfile, profile: profile as UserProfile });
      } else {
        setError('Signed in but could not load your profile. Please try again.');
      }
    } catch (err) {
      setError((err as Error).message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await AUTH.signInWithMagicLink(email.trim());
      if (result.error) {
        setError(result.error);
      } else {
        setMode('link-sent');
        setSuccess('Check your email for the sign-in link');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to send link.');
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
            {mode === 'signin' ? 'Sign in to your account' : 'Check your email'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

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
              Click the link in your email to sign in. The link expires in 1 hour.
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
              disabled={loading}
              className="w-full rounded-xl bg-ocean-500 py-3 font-semibold text-white transition hover:bg-ocean-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading || !email}
                className="text-sm text-ocean-600 hover:underline disabled:opacity-50"
              >
                Or sign in with magic link
              </button>
            </div>
          </form>
        )}

        {mode === 'signin' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-graystone-600">
              Need access? Ask an administrator to invite you to the Content Dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
