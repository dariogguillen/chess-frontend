import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Error from "../pages/Error";
import PlayFriend from "../pages/PlayFriend";
import WIP from "../pages/WIP";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <Error />,
    children: [
      { path: "/home", element: <WIP str="Home" /> },
      { path: "/friend", element: <PlayFriend /> },
      { path: "/bot", element: <WIP str="Play Bot" /> },
      { path: "/login", element: <WIP str="Log in" /> },
      { path: "/about", element: <WIP str="About" /> },
    ],
  },
]);

export default router;
