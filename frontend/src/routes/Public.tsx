import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Error from "../pages/Error";
import NewGame from "../pages/NewGame";
import WIP from "../pages/WIP";
import Play from "../pages/Play";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <Error />,
    children: [
      { path: "/home", element: <WIP str="Home" /> },
      { path: "/new", element: <NewGame /> },
      { path: "/play", element: <Play /> },
      { path: "/login", element: <WIP str="Log in" /> },
      { path: "/about", element: <WIP str="About" /> },
    ],
  },
]);

export default router;
