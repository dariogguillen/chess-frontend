import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiErrorCode, messageFor } from '../../api/errors';
import { useUserContext } from '../../context';

/**
 * Friendly messages for the OAuth error fragments the backend can send.
 * The backend redirects to `/auth/callback#error=<code>` on failure; we
 * map the known codes to user-facing copy and fall back to the neutral
 * "something went wrong" message for anything unexpected.
 */
const OAUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  email_taken:
    "That Google account's email is already registered — sign in with your email and password instead.",
  oauth_missing_profile: "Google didn't share enough profile info to sign you in.",
};

/**
 * `/auth/callback` — the OAuth redirect landing page.
 *
 * The backend bounces the browser here after Google authentication with
 * the result in the URL fragment (the `#...` part, which never reaches a
 * server and is the conventional place to stash a token):
 *
 *   - success → `#token=<jwt>`
 *   - failure → `#error=email_taken` / `#error=oauth_missing_profile`
 *
 * This page has no UI of its own beyond a loading spinner: it reads the
 * fragment, acts on it, and redirects (always `replace: true`, so the
 * callback URL — token and all — never lands in the back-stack).
 *
 * Token path: persist + `me()` via `authenticateWithToken`, then go to
 * `/home`. OAuth hands us only the token, so the `me()` round-trip is how
 * we learn who the user is.
 *
 * Error path / failure / no-fragment: redirect to `/login`, carrying a
 * friendly message in `location.state.authError` where one applies.
 *
 * The first thing we do is scrub the fragment from the address bar via
 * `history.replaceState` so the JWT is not left visible or in history.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { authenticateWithToken } = useUserContext();

  // Ran-once guard. StrictMode double-invokes effects in dev, and we must
  // process the fragment exactly once — re-running after we have already
  // scrubbed `window.location.hash` would see an empty fragment and bounce
  // a legitimately-authenticating user to /login.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Capture the fragment, then immediately scrub it from the address bar
    // (and history) so the JWT is never left visible. `replaceState` keeps
    // the same path; only the `#...` is dropped.
    const hash = window.location.hash;
    window.history.replaceState(null, '', window.location.pathname);

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const token = params.get('token');
    const errorCode = params.get('error');

    let cancelled = false;

    if (token !== null && token.length > 0) {
      authenticateWithToken(token)
        .then(() => {
          if (cancelled) return;
          navigate('/home', { replace: true });
        })
        .catch(() => {
          if (cancelled) return;
          navigate('/login', {
            replace: true,
            state: { authError: messageFor(ApiErrorCode.UnknownError) },
          });
        });
      return () => {
        cancelled = true;
      };
    }

    if (errorCode !== null) {
      const message = OAUTH_ERROR_MESSAGES[errorCode] ?? messageFor(ApiErrorCode.UnknownError);
      navigate('/login', { replace: true, state: { authError: message } });
      return;
    }

    // Neither token nor error: a direct hit or a cancelled flow. Send the
    // user to /login without an error message — nothing went wrong, there
    // is just nothing to do here.
    navigate('/login', { replace: true });
  }, [authenticateWithToken, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: '50vh',
      }}
    >
      <CircularProgress aria-hidden />
      {/*
        role="status" + aria-live="polite" announces the loading state to
        assistive tech without stealing focus. The visible text doubles as
        the accessible name.
      */}
      <Typography role="status" aria-live="polite">
        Signing you in…
      </Typography>
    </Box>
  );
};

export default AuthCallback;
