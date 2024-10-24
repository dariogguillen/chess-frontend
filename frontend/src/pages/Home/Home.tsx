import { Box, CssBaseline, Typography } from "@mui/material";
import { useState } from "react";
import { Drawer, DrawerHeader } from "../../components/Drawer";
import Header from "../../components/Header";

const Home = () => {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <Header open={open} setOpen={setOpen} />
      <Drawer open={open} setOpen={setOpen} />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <DrawerHeader />
        {
          // CONTENT HERE
        }
        <Typography sx={{ marginBottom: 2 }}>TODO</Typography>
      </Box>
    </Box>
  );
};

export default Home;
