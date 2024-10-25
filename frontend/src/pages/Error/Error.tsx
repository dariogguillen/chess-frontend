import { Box, CssBaseline, Typography } from "@mui/material";
import { useRouteError } from "react-router-dom";

const Error = () => {
  const error = useRouteError();
  console.error(error);

  return (
    <Box
      sx={{
        margin: "auto",
        height: "100vh",
        width: "100vw",
        maxWidth: 500,
        alignContent: "center",
      }}
    >
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
    </Box>
  );
};

export default Error;
