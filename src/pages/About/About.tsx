import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Container, Divider, Link, Paper, Stack, Typography } from '@mui/material';

/**
 * A single external link in the "Links" block.
 *
 * Every entry is rendered as a real anchor (MUI `Link` → `<a href>`)
 * that opens in a new tab. `target="_blank"` without `rel` would expose
 * the new page to `window.opener` (reverse tabnabbing) and leak the full
 * referrer, so each link carries `rel="noopener noreferrer"`. The trailing
 * `OpenInNew` icon is the visible new-tab affordance.
 */
const LINKS: ReadonlyArray<Readonly<{ label: string; href: string }>> = [
  {
    label: 'Frontend repository on GitHub',
    href: 'https://github.com/dariogguillen/chess-frontend',
  },
  {
    label: 'Backend repository on GitHub',
    href: 'https://github.com/dariogguillen/chess-backend-java',
  },
  {
    label: 'REST API reference (OpenAPI / Swagger UI)',
    href: 'https://chess-backend.duckdns.org/swagger-ui.html',
  },
  {
    label: 'License (MIT)',
    href: 'https://github.com/dariogguillen/chess-frontend/blob/main/LICENSE',
  },
];

/**
 * The agent-harness docs, called out separately from the repo links so
 * the "real differentiator" framing in the copy has a concrete landing
 * spot. Same safe-external-link rules as `LINKS`.
 */
const HARNESS_LINKS: ReadonlyArray<Readonly<{ label: string; href: string }>> = [
  {
    label: 'CLAUDE.md — the orchestration role',
    href: 'https://github.com/dariogguillen/chess-frontend/blob/main/CLAUDE.md',
  },
  {
    label: 'AGENTS.md — the project map',
    href: 'https://github.com/dariogguillen/chess-frontend/blob/main/AGENTS.md',
  },
  {
    label: 'progress/ — the session log on disk',
    href: 'https://github.com/dariogguillen/chess-frontend/tree/main/progress',
  },
];

/**
 * Render a list of safe external links as a vertical stack of anchors.
 *
 * Each `Link` opens in a new tab and carries `rel="noopener noreferrer"`;
 * the `OpenInNew` icon (marked `aria-hidden` — the link text already says
 * what it is, the icon only signals the new-tab behaviour visually) keeps
 * the affordance discoverable without polluting the accessible name.
 */
const LinkGroup = ({
  links,
}: Readonly<{ links: ReadonlyArray<Readonly<{ label: string; href: string }>> }>) => (
  <Stack spacing={1} alignItems="flex-start">
    {links.map(({ label, href }) => (
      <Link
        key={href}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        {label}
        <OpenInNewIcon fontSize="inherit" aria-hidden />
      </Link>
    ))}
  </Stack>
);

/**
 * The `/about` page — a static, informational screen describing what the
 * project is, the stack it runs on, and the agent harness that builds it.
 *
 * Imported eagerly (not via `React.lazy`) in `src/routes/Public.tsx`,
 * consistent with the `<WIP str="About" />` placeholder it replaces and
 * with `Home`: the page is light (MUI is already in the initial bundle)
 * and a Suspense spinner would be the wrong UX for a one-paint static
 * page. Router-only: no providers, no API calls.
 */
const About = () => {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, sm: 8, md: 10 } }}>
      <Stack spacing={{ xs: 4, sm: 5 }} alignItems="flex-start">
        <Typography variant="h3" component="h1">
          About
        </Typography>

        <Stack spacing={2}>
          <Typography variant="body1">
            This is an online multiplayer chess game. Create a room, share the link or code with a
            friend, and play in real time — no signup required.
          </Typography>
          <Typography variant="body1">
            The backend is the source of truth. It validates and records every move, so the game
            state you see is always the one the server agrees with. chess.js runs in the browser
            purely as a local UX aid — previewing legal moves and animating the board — never as the
            authority on what is legal.
          </Typography>
        </Stack>

        <Stack spacing={1.5} alignItems="flex-start">
          <Typography variant="h5" component="h2">
            The stack
          </Typography>
          <Typography variant="body1">
            React 19 and TypeScript on the front, MUI for the UI, built with Vite. It talks to a
            Spring Boot backend over REST for the room and game lifecycle, and over
            STOMP-over-WebSocket for live move updates.
          </Typography>
        </Stack>

        <Stack spacing={1.5} alignItems="flex-start">
          <Typography variant="h5" component="h2">
            How it is built
          </Typography>
          <Typography variant="body1">
            This is a portfolio piece, and its real differentiator is how it gets built: an agent
            harness drives every feature through the same loop — plan, implement, review, and record
            the outcome on disk. The engineering docs below show that loop in the open.
          </Typography>
        </Stack>

        <Divider flexItem />

        <Stack spacing={3} alignItems="flex-start" sx={{ width: '100%' }}>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h5" component="h2">
              <GitHubIcon
                fontSize="inherit"
                aria-hidden
                sx={{ verticalAlign: 'text-bottom', mr: 1 }}
              />
              Project links
            </Typography>
            <LinkGroup links={LINKS} />
          </Stack>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, width: '100%' }}>
            <Stack spacing={2} alignItems="flex-start">
              <Typography variant="h6" component="h2">
                The agent harness
              </Typography>
              <LinkGroup links={HARNESS_LINKS} />
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  );
};

export default About;
