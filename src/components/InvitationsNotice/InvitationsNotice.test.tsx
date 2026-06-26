import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InvitationsContext } from '../../context';
import type { InvitationsContextValue } from '../../context';
import { InvitationsNotice } from './InvitationsNotice';

const baseValue: InvitationsContextValue = {
  invitations: [],
  accept: vi.fn(),
  decline: vi.fn(),
  outgoing: [],
  invite: vi.fn(),
  cancelOutgoing: vi.fn(),
  notice: null,
  clearNotice: vi.fn(),
};

const renderWith = (value: InvitationsContextValue) =>
  render(
    <InvitationsContext.Provider value={value}>
      <InvitationsNotice />
    </InvitationsContext.Provider>,
  );

describe('InvitationsNotice', () => {
  it('renders nothing visible when there is no notice', () => {
    renderWith(baseValue);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces the notice in an alert region', () => {
    renderWith({ ...baseValue, notice: 'Alice declined your invitation.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Alice declined your invitation.');
  });

  it('clears the notice when dismissed', async () => {
    const clearNotice = vi.fn();
    renderWith({ ...baseValue, notice: 'Bob declined your invitation.', clearNotice });

    await userEvent.click(screen.getByLabelText('Close'));

    expect(clearNotice).toHaveBeenCalled();
  });
});
