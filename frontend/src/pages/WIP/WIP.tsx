import { Box, Container, Typography } from "@mui/material";
import { DRAWER_WIDTH } from "../../components/Drawer/Drawer";
interface WIProps {
  str: string;
}
const Wip = ({ str }: WIProps) => {
  return (
    <Container maxWidth="sm">
      <Box
        component="main"
        sx={{
          margin: "auto",
          height: "100vh",
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
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
