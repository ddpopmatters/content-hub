// src/components/ui/__tests__/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('defaults to type="button" to prevent accidental form submission', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('forwards aria-label and data attributes', () => {
    render(
      <Button aria-label="Save entry" data-testid="save-btn">
        Save
      </Button>,
    );
    const btn = screen.getByTestId('save-btn');
    expect(btn.getAttribute('aria-label')).toBe('Save entry');
  });

  it('merges custom className without losing base styles', () => {
    render(<Button className="my-custom">Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('my-custom');
    // Base style class should still be present
    expect(btn.className).toContain('rounded-xl');
  });

  it('renders all variants without crashing', () => {
    const variants = [
      'default',
      'secondary',
      'ghost',
      'outline',
      'destructive',
      'success',
    ] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole('button')).toBeTruthy();
      unmount();
    });
  });
});
