import { Box, Container } from "@mui/material";
import { DRAWER_WIDTH } from "../Drawer/Drawer";

interface Props {
  children: React.ReactNode;
}
const CustomContaienr = ({ children }: Props) => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          margin: "auto",
          height: "100vh",
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          alignContent: "center",
        }}
      >
        {children}
      </Box>
    </Container>
  );
};

export default CustomContaienr;
