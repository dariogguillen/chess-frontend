import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ErrorPage from '../pages/Error';
import WIP from '../pages/WIP';

const NewGame = lazy(() => import('../pages/NewGame'));
const Play = lazy(() => import('../pages/Play'));

/**
 * Strip a single trailing slash from a basename so that
 * `createBrowserRouter`'s pattern (`/chess-frontend`, not
 * `/chess-frontend/`) matches the GitHub Pages sub-path served by Vite.
 *
 * Vite exposes `import.meta.env.BASE_URL` ending with `/`; the router
 * wants the form without it. We normalise here so both forms work.
 */
const stripTrailingSlash = (value: string): string => {
  if (value.length > 1 && value.endsWith('/')) return value.slice(0, -1);
  return value;
};

const basename = stripTrailingSlash(import.meta.env.BASE_URL);

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <Navigate to="/home" replace /> },
        { path: 'home', element: <WIP str="Home" /> },
        { path: 'new', element: <NewGame /> },
        { path: 'play', element: <Play /> },
        { path: 'login', element: <WIP str="Log in" /> },
        { path: 'about', element: <WIP str="About" /> },
      ],
    },
  ],
  { basename },
);

export default router;
