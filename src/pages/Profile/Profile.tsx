import { Box, CircularProgress, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { me } from '../../api/auth';
import { FriendsSection } from '../../components/FriendsSection';
import { IdentityKind, useUserContext } from '../../context';

/**
 * The placeholder sections that still mark where the social epic slots in.
 * "Friends" graduated to its own live `FriendsSection` (below); "My games"
 * and "Stats" remain real headings + copy (not colour-only chips) so the
 * page is navigable today and those future features have a stable,
 * accessible home to grow into.
 */
const COMING_SOON: ReadonlyArray<Readonly<{ title: string; body: string }>> = [
  {
    title: 'My games',
    body: 'Review the games you have played, replay them move by move. Coming soon.',
  },
  {
    title: 'Stats',
    body: 'Your win/loss record and rating over time. Coming soon.',
  },
];

/**
 * `/profile` — the authenticated user's account home and the stable anchor
 * for the social epic (friends / my games / stats land here as their own
 * features later).
 *
 * Auth guard: this page is the inverse of `Login`. Login redirects an
 * already-authenticated user away; Profile redirects a guest away — a
 * guest has no account to show, so the early `Navigate` sends them to
 * `/home` before rendering anything. Anonymous play is unaffected; this is
 * the only gated, account-only route so far.
 *
 * The email lives only on the wire (`AuthenticatedIdentity` carries
 * `userId` + `displayName`, not `email`), so we fetch it via `me()` on
 * mount. While that request is in flight we show a spinner; if it rejects
 * (stale token, transport blip) we fall back to the identity's
 * `displayName` and omit the email rather than crash — the page stays
 * usable either way.
 */
const Profile = () => {
  const { identity } = useUserContext();

  // `me()` result. `loading` gates the spinner; `email` is null until the
  // profile resolves (and stays null if the fetch fails). We seed the
  // shown display name from the identity and let the fresh `me()` response
  // overwrite it when it arrives.
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(
    identity.kind === IdentityKind.Authenticated ? identity.displayName : '',
  );

  useEffect(() => {
    // Only fetch for an authenticated user; a guest is redirected below and
    // never reaches a meaningful render, but the effect still runs before
    // the early return is evaluated on re-render, so we guard explicitly.
    if (identity.kind !== IdentityKind.Authenticated) return;

    // `loading` initialises to `true`, so we do NOT set it synchronously
    // here — react-hooks forbids a synchronous setState in an effect body
    // (it cascades a render). We only flip state once the async `me()`
    // settles, inside the callbacks below.
    let cancelled = false;
    me()
      .then((user) => {
        if (cancelled) return;
        setDisplayName(user.displayName);
        setEmail(user.email);
      })
      .catch(() => {
        // Stale token / transport failure: keep the identity's displayName
        // and omit the email. The page must not crash on a failed profile
        // fetch — the user is still logged in as far as the client knows.
        if (cancelled) return;
        setEmail(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identity]);

  // Inverse of Login's guard: a guest has no profile to show.
  if (identity.kind !== IdentityKind.Authenticated) {
    return <Navigate to="/home" replace />;
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, sm: 8, md: 10 } }}>
      <Stack spacing={{ xs: 4, sm: 5 }} alignItems="flex-start" sx={{ width: '100%' }}>
        <Typography variant="h3" component="h1">
          My account
        </Typography>

        {loading ? (
          <Box
            role="status"
            aria-live="polite"
            sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
          >
            <CircularProgress size={24} aria-hidden />
            <Typography variant="body1">Loading your profile…</Typography>
          </Box>
        ) : (
          <Stack spacing={1} alignItems="flex-start">
            <Typography variant="h5" component="h2">
              {displayName}
            </Typography>
            {email !== null && (
              <Typography variant="body1" color="text.secondary">
                {email}
              </Typography>
            )}
          </Stack>
        )}

        <Divider flexItem />

        <FriendsSection />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          sx={{ width: '100%' }}
        >
          {COMING_SOON.map((section) => (
            <Paper key={section.title} variant="outlined" sx={{ p: 3, flex: 1, borderRadius: 2 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {section.body}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
};

export default Profile;
