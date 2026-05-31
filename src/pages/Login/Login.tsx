import {
  Alert,
  Box,
  Button,
  Container,
  Link,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import { IdentityKind, useUserContext } from '../../context';

const MIN_PASSWORD_LENGTH = 8;

const EMAIL_HELPER = 'Enter the email you registered with.';
const EMAIL_ERROR = 'Enter a valid email address.';
const PASSWORD_HELPER = 'At least 8 characters.';
const PASSWORD_ERROR = 'Passwords are at least 8 characters.';

/**
 * Loose client-side email check. The server is the source of truth for
 * "is this a real, registered email"; this gate only stops obviously
 * malformed input from making a round-trip. A single `@` with text on
 * both sides and no whitespace is the cheapest meaningful test.
 */
const looksLikeEmail = (value: string): boolean => /^\S+@\S+$/.test(value.trim());

/**
 * `/login` — email + password sign-in form.
 *
 * Submit flow: `login()` → `setAuthenticated(session)` (persists token +
 * flips identity to the Authenticated arm) → `navigate('/home')`. Errors
 * surface through the same Snackbar/Alert pattern as `NewGame`: an
 * `ApiError.code` (e.g. `INVALID_CREDENTIALS`) is mapped to a neutral
 * user message via `messageFor`.
 *
 * If the user is already authenticated, the page is meaningless — we
 * redirect to `/home` before rendering anything (the early `Navigate`
 * guard). Anonymous play is unaffected: this route is never gated.
 */
const Login = () => {
  const navigate = useNavigate();
  const { identity, setAuthenticated } = useUserContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Validation messages stay hidden until the user has interacted with a
  // field (touched) so the form does not shout errors on first paint.
  const [touched, setTouched] = useState({ email: false, password: false });

  if (identity.kind === IdentityKind.Authenticated) {
    return <Navigate to="/home" replace />;
  }

  const handleEmail = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value);
  const handlePassword = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value);

  const isEmailValid = looksLikeEmail(email);
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;
  const showEmailError = touched.email && !isEmailValid;
  const showPasswordError = touched.password && !isPasswordValid;
  const canSubmit = !submitting && isEmailValid && isPasswordValid;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const session = await login(email.trim(), password);
      setAuthenticated(session);
      navigate('/home');
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrorMessage(messageFor(cause.code));
      } else {
        // Defensive: auth.ts wraps everything as ApiError, but a future
        // refactor could regress that contract.
        setErrorMessage(messageFor(ApiErrorCode.UnknownError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ pt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Log in
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack direction="column" spacing={2}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            fullWidth
            required
            value={email}
            onChange={handleEmail}
            onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            error={showEmailError}
            helperText={showEmailError ? EMAIL_ERROR : EMAIL_HELPER}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            fullWidth
            required
            value={password}
            onChange={handlePassword}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            error={showPasswordError}
            helperText={showPasswordError ? PASSWORD_ERROR : PASSWORD_HELPER}
          />
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            Log in
          </Button>
          <Typography variant="body2" align="center">
            Need an account?{' '}
            <Link component={RouterLink} to="/register">
              Create one
            </Link>
          </Typography>
        </Stack>
      </Box>
      <Snackbar
        open={errorMessage !== null}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => setErrorMessage(null)}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Login;
