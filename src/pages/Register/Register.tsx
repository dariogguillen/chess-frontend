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
import { register } from '../../api/auth';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import { IdentityKind, useUserContext } from '../../context';

const MIN_PASSWORD_LENGTH = 8;

const EMAIL_HELPER = 'We will never share it.';
const EMAIL_ERROR = 'Enter a valid email address.';
const PASSWORD_HELPER = 'At least 8 characters.';
const PASSWORD_ERROR = 'Choose a password of at least 8 characters.';
const DISPLAY_NAME_HELPER = 'Shown to your opponents.';
const DISPLAY_NAME_ERROR = 'Enter a display name.';

const looksLikeEmail = (value: string): boolean => /^\S+@\S+$/.test(value.trim());

/**
 * `/register` — email + password + display name sign-up form.
 *
 * Mirrors `Login`: submit → `register()` → `setAuthenticated(session)` →
 * `navigate('/home')`. The backend returns a session directly on
 * register (no separate login step), so the authenticated flow is the
 * same seam. Error path covers `EMAIL_ALREADY_TAKEN` (409) and
 * `VALIDATION_FAILED` (400) via `messageFor`.
 *
 * Already-authenticated users are redirected to `/home` before render.
 */
const Register = () => {
  const navigate = useNavigate();
  const { identity, setAuthenticated } = useUserContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false, displayName: false });

  if (identity.kind === IdentityKind.Authenticated) {
    return <Navigate to="/home" replace />;
  }

  const handleEmail = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value);
  const handlePassword = (event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value);
  const handleDisplayName = (event: ChangeEvent<HTMLInputElement>) =>
    setDisplayName(event.target.value);

  const isEmailValid = looksLikeEmail(email);
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;
  const isDisplayNameValid = displayName.trim().length > 0;
  const showEmailError = touched.email && !isEmailValid;
  const showPasswordError = touched.password && !isPasswordValid;
  const showDisplayNameError = touched.displayName && !isDisplayNameValid;
  const canSubmit = !submitting && isEmailValid && isPasswordValid && isDisplayNameValid;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true, displayName: true });
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const session = await register(email.trim(), password, displayName.trim());
      setAuthenticated(session);
      navigate('/home');
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrorMessage(messageFor(cause.code));
      } else {
        setErrorMessage(messageFor(ApiErrorCode.UnknownError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ pt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Create an account
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
            label="Display name"
            type="text"
            autoComplete="name"
            fullWidth
            required
            value={displayName}
            onChange={handleDisplayName}
            onBlur={() => setTouched((prev) => ({ ...prev, displayName: true }))}
            error={showDisplayNameError}
            helperText={showDisplayNameError ? DISPLAY_NAME_ERROR : DISPLAY_NAME_HELPER}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            fullWidth
            required
            value={password}
            onChange={handlePassword}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
            error={showPasswordError}
            helperText={showPasswordError ? PASSWORD_ERROR : PASSWORD_HELPER}
          />
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            Create account
          </Button>
          <Typography variant="body2" align="center">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Log in
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

export default Register;
