import { Typography } from "@mui/material";
import Container from "../../components/Container";

interface WIProps {
  str: string;
}
const Wip = ({ str }: WIProps) => {
  return (
    <Container>
      <Typography variant="h2" gutterBottom align="center">
        Chess App {str} WIP
      </Typography>
      <Typography variant="h5" gutterBottom align="center">
        Bienvendo, este es un ejercicio de Desarrollo Web utilizando React y
        Typescript
      </Typography>
    </Container>
  );
};

export default Wip;
