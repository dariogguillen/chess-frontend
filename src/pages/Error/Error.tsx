import { Container, Typography } from '@mui/material';
import { useRouteError } from 'react-router-dom';

type RouteErrorShape = Readonly<{
  statusText?: string;
  message?: string;
}>;

const isRouteErrorShape = (err: unknown): err is RouteErrorShape => {
  return typeof err === 'object' && err !== null;
};

/**
 * Catch-all error page used as the router's `errorElement`. The hook
 * `useRouteError` returns `unknown`; we narrow to a small shape before
 * pulling fields off it.
 */
const ErrorPage = () => {
  const error = useRouteError();
  // Surfacing this in the console is intentional: the page is a
  // last-resort UI; the actual debugging happens via devtools.
  console.error(error);

  const detail = isRouteErrorShape(error)
    ? error.statusText || error.message || 'Unknown error'
    : 'Unknown error';

  return (
    <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
      <Typography variant="h1" gutterBottom>
        Oops!
      </Typography>
      <Typography variant="body1" gutterBottom>
        Sorry, an unexpected error has occurred.
      </Typography>
      <Typography variant="body2" gutterBottom>
        <i>{detail}</i>
      </Typography>
    </Container>
  );
};

export default ErrorPage;
