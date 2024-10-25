import { createTheme, PaletteOptions } from "@mui/material";

const theme = ({ mode }: PaletteOptions) =>
  createTheme({
    palette: { mode },
    components: {
      MuiListItem: {
        styleOverrides: {
          root: {
            "&.active": {
              backgroundColor: "rgba(200, 200, 200, 0.5)",
            },
          },
        },
      },
    },
  });

export default theme;
