import React, { useState, type FormEvent } from 'react';
import { Button } from '../ui';
import { APP_CONFIG } from '../../lib/config';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,157,222,0.18),_transparent_34%),linear-gradient(180deg,_#f5fcff_0%,_#ffffff_100%)] text-ocean-950">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
        <section className="order-2 rounded-[2rem] border border-aqua-100 bg-white/80 p-6 shadow-[0_24px_70px_-34px_rgba(11,44,75,0.45)] backdrop-blur lg:order-1 lg:p-10">
          <div className="flex items-center gap-4">
            <img
              src={APP_CONFIG.LOGO_URL}
              alt={APP_CONFIG.ORG_NAME}
              className="h-14 w-14 rounded-[1.25rem] border border-aqua-200 bg-white p-2.5 object-contain shadow-sm"
            />
            <div>
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ocean-500">
                Population Matters
              </div>
              <h1 className="heading-font text-3xl font-semibold text-ocean-950 sm:text-4xl">
                Content Hub
              </h1>
            </div>
          </div>

          <div className="mt-8 max-w-xl">
            <p className="text-lg leading-8 text-graystone-700">
              The internal workspace for planning content peaks, managing approvals and keeping
              publishing organised across the team.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ['Plan clearly', 'Keep campaigns, responses and requests in one place.'],
              [
                'Review quickly',
                'Share clean approval links without dragging people into the full app.',
              ],
              [
                'Publish with context',
                'Carry captions, assets and publishing notes through to the finish.',
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-[1.5rem] border border-aqua-100 bg-aqua-50/70 p-4"
              >
                <div className="text-sm font-semibold text-ocean-900">{title}</div>
                <p className="mt-2 text-sm leading-6 text-graystone-600">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-ocean-700">
            <span className="rounded-full bg-ocean-100 px-3 py-1.5">Rights-based messaging</span>
            <span className="rounded-full bg-ocean-100 px-3 py-1.5">Team approvals</span>
            <span className="rounded-full bg-ocean-100 px-3 py-1.5">
              Shared publishing workflow
            </span>
          </div>
        </section>

        <div className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-md rounded-[2rem] border border-aqua-100 bg-white p-8 shadow-[0_24px_70px_-34px_rgba(11,44,75,0.45)] sm:p-9">
            <div className="mb-8">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-ocean-500">
                Sign in
              </div>
              <h2 className="mt-3 heading-font text-3xl font-semibold text-ocean-950">
                {mode === 'signin' ? 'Welcome back' : 'Check your email'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-graystone-600">
                {mode === 'signin'
                  ? 'Use your email and password, or request a magic link if you are on a trusted device.'
                  : 'We have sent a secure sign-in link to your inbox.'}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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
                <p className="text-graystone-700">
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
                  className="text-sm font-medium text-ocean-600 hover:underline"
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
                    className="w-full rounded-2xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-aqua-300"
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
                    className="w-full rounded-2xl border border-graystone-300 px-4 py-3 outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-aqua-300"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-2xl py-3.5">
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={loading || !email}
                    className="text-sm font-medium text-ocean-600 hover:underline disabled:opacity-50"
                  >
                    Or send a magic link
                  </button>
                </div>
              </form>
            )}

            {mode === 'signin' && (
              <div className="mt-6 rounded-2xl border border-aqua-100 bg-aqua-50/70 px-4 py-4 text-sm text-graystone-700">
                Need access? Ask an administrator to invite you to Content Hub.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
