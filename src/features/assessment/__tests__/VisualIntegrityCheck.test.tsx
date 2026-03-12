// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisualIntegrityCheck } from '../VisualIntegrityCheck';

describe('VisualIntegrityCheck', () => {
  it('renders all three check labels', () => {
    render(<VisualIntegrityCheck values={{}} onChange={vi.fn()} />);
    expect(screen.getByText('Victim imagery')).toBeInTheDocument();
    expect(screen.getByText('Anonymous without context')).toBeInTheDocument();
    expect(screen.getByText('Recipient framing')).toBeInTheDocument();
  });

  it('calls onChange with flag raised when Yes is clicked', () => {
    const onChange = vi.fn();
    render(<VisualIntegrityCheck values={{}} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
    expect(onChange).toHaveBeenCalledWith({ victimImagery: true });
  });

  it('calls onChange with flag cleared when No is clicked', () => {
    const onChange = vi.fn();
    render(<VisualIntegrityCheck values={{ victimImagery: true }} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'No' })[0]);
    expect(onChange).toHaveBeenCalledWith({ victimImagery: false });
  });

  it('shows reframe guidance when victim imagery is flagged', () => {
    render(<VisualIntegrityCheck values={{ victimImagery: true }} onChange={vi.fn()} />);
    expect(screen.getByText(/Replace with imagery showing agency/i)).toBeInTheDocument();
  });

  it('shows all-clear message when all checks answered No', () => {
    render(
      <VisualIntegrityCheck
        values={{ victimImagery: false, anonWithoutContext: false, recipientFraming: false }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Visual integrity passed/i)).toBeInTheDocument();
  });

  it('disables all buttons in readOnly mode', () => {
    render(<VisualIntegrityCheck values={{}} onChange={vi.fn()} readOnly />);
    screen.getAllByRole('button', { name: 'Yes' }).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
    screen.getAllByRole('button', { name: 'No' }).forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
