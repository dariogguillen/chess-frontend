import { Box, CssBaseline, Typography } from "@mui/material";
import { useRouteError } from "react-router-dom";
import Container from "../../components/Container";

const Error = () => {
  const error = useRouteError();
  console.error(error);

  return (
    <Container>
      <CssBaseline />
      <Typography variant="h1" gutterBottom align="center">
        Oops!
      </Typography>
      <Typography variant="body1" gutterBottom align="center">
        Sorry, an unexpected error has occurred.
      </Typography>
      <Typography variant="body2" gutterBottom align="center">
        <i>{error.statusText || error.message}</i>
      </Typography>
    </Container>
  );
};

export default Error;
