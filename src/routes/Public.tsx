import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import App from '../App';
import About from '../pages/About';
import ErrorPage from '../pages/Error';
import Home from '../pages/Home';

const NewGame = lazy(() => import('../pages/NewGame'));
const Play = lazy(() => import('../pages/Play'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));

/**
 * Normalise Vite's `import.meta.env.BASE_URL` into the form
 * `createBrowserRouter` expects as `basename` (no trailing slash).
 *
 * Cloudflare Pages serves the SPA at the root, so `BASE_URL` is `/`
 * and the trim is a no-op in production. The defensive strip is kept
 * so any future base-path configuration (e.g. serving under a
 * sub-path again) works without touching this file.
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
        { path: 'home', element: <Home /> },
        { path: 'new', element: <NewGame /> },
        { path: 'play', element: <Play /> },
        { path: 'login', element: <Login /> },
        { path: 'register', element: <Register /> },
        { path: 'about', element: <About /> },
      ],
    },
  ],
  { basename },
);

export default router;
