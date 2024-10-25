import { createTheme, PaletteOptions } from "@mui/material";

const theme = ({ mode }: PaletteOptions) =>
  createTheme({
    palette: { mode },
    components: {
      MuiListItem: {
        styleOverrides: {
          root: {
            "&.active": {
              backgroundColor: "#1c1c1c", // or any other color
            },
          },
        },
      },
    },
  });

export default theme;
