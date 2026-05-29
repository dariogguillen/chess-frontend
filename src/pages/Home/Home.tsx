import { Button, Container, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * The capabilities surfaced in the "what you get" block.
 *
 * Each entry maps to an already-shipped behaviour — real-time move sync
 * (STOMP over WebSocket), shareable rooms with no signup, and the five
 * board themes from `src/boardThemes.ts`. Deliberately omits user
 * accounts (future feature 20), bots and timers (disabled in NewGame
 * today): the landing copy must describe only what the app actually does.
 */
const CAPABILITIES: ReadonlyArray<Readonly<{ title: string; body: string }>> = [
  {
    title: 'Real-time play',
    body: 'Moves sync instantly over the live connection — no refresh, no polling.',
  },
  {
    title: 'Just share a link',
    body: 'No signup. Create a room and send the link to a friend to start playing.',
  },
  {
    title: 'Your board, your style',
    body: 'Pick from five board themes and keep your choice across games.',
  },
];

/**
 * The landing page at `/home` — the default-redirect target and the
 * first screen a visitor sees.
 *
 * Imported eagerly (not via `React.lazy`) in `src/routes/Public.tsx`: a
 * Suspense spinner on the first paint of the default route would be the
 * wrong UX, and the page is light (MUI is already in the initial bundle).
 *
 * Pure client-side: no providers beyond the router, no API calls. The
 * single `<button>` CTA fires an SPA-internal `navigate('/new')`; the
 * secondary nav fires `navigate('/about')`.
 */
const Home = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, sm: 8, md: 10 } }}>
      <Stack spacing={{ xs: 4, sm: 5 }} alignItems="flex-start">
        {/* Hero: one h1 styled at display size, decoupled via `component`. */}
        <Stack spacing={2}>
          <Typography variant="h3" component="h1">
            Play chess in a shared room
          </Typography>
          <Typography variant="h6" component="p" color="text.secondary">
            Create a room, share the link, and play a friend in real time.
          </Typography>
        </Stack>

        {/* Primary action + secondary nav. */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button variant="contained" size="large" onClick={() => navigate('/new')}>
            New Game
          </Button>
          <Button variant="text" size="large" onClick={() => navigate('/about')}>
            About
          </Button>
        </Stack>

        {/* "What you get": three real, already-shipped capabilities. */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          sx={{ width: '100%' }}
        >
          {CAPABILITIES.map((capability) => (
            <Paper
              key={capability.title}
              variant="outlined"
              sx={{ p: 3, flex: 1, borderRadius: 2 }}
            >
              <Typography variant="h6" component="h2" gutterBottom>
                {capability.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {capability.body}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
};

export default Home;
