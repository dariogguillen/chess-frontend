import { createTheme, PaletteMode } from "@mui/material";

export interface ThemeOpts {
  mode: PaletteMode;
}

const theme = ({ mode }: ThemeOpts) =>
  createTheme({
    palette: { mode },
  });

export default theme;
