import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginScreen } from './LoginScreen';

vi.mock('../../lib/supabase', () => ({
  AUTH: {
    signIn: vi.fn(),
    signInWithMagicLink: vi.fn().mockResolvedValue({}),
  },
  SUPABASE_API: {
    fetchCurrentUserProfile: vi.fn(),
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose self-service sign-up controls', () => {
    render(<LoginScreen onAuthChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/ask an administrator to invite you to the content dashboard/i),
    ).toBeInTheDocument();
  });

  it('still allows magic-link sign-in for invited users', async () => {
    render(<LoginScreen onAuthChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /magic link/i }));

    expect(await screen.findByText(/we sent a link to/i)).toBeInTheDocument();
  });
});
