import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import ErrorPage from './Error';

const FailingRoute = () => {
  throw new Error('boom');
};

describe('Error page', () => {
  it('renders the fallback when an underlying route throws', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <FailingRoute />,
          errorElement: <ErrorPage />,
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: /oops/i })).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    // The error message is surfaced verbatim.
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
