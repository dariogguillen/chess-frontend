import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import Home from "./pages/Home";
import { ThemeProvider } from "@emotion/react";
import theme from "./theme.tsx";
import Error from "./pages/Error";

const router = createBrowserRouter([
  { path: "/", element: <App />, errorElement: <Error /> },
  { path: "/home", element: <Home /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme({ mode: "dark" })}>
      <RouterProvider router={router} />
      {/* <App /> */}
    </ThemeProvider>
  </StrictMode>,
);
