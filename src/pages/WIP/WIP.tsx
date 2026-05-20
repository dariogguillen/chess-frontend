import { Container, Typography } from '@mui/material';

export type WIPProps = Readonly<{
  /** Label describing what the page will eventually show
   * (e.g. "Home", "Log in", "About"). */
  str: string;
}>;

/**
 * Placeholder page used for routes that exist in the IA but are not
 * yet implemented. Routes still need a destination so navigation never
 * dead-ends.
 */
const WIP = ({ str }: WIPProps) => {
  return (
    <Container maxWidth="md" sx={{ pt: 8, textAlign: 'center' }}>
      <Typography variant="h2" gutterBottom>
        {str} — coming soon
      </Typography>
      <Typography variant="h5" gutterBottom>
        This page is still under construction.
      </Typography>
    </Container>
  );
};

export default WIP;
