import { Box, Container, Typography } from "@mui/material";
interface WIProps {
  str: string;
}
const Wip = ({ str }: WIProps) => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          margin: "auto",
          height: "100vh",
          width: "100vw",
          maxWidth: 500,
          alignContent: "center",
        }}
      >
        <Typography variant="h2" gutterBottom align="center">
          Chess App {str} WIP
        </Typography>
        <Typography variant="h5" gutterBottom align="center">
          Bienvendo, este es un ejercicio de Desarrollo Web utilizando React y
          Typescript
        </Typography>
      </Box>
    </Container>
  );
};

export default Wip;
