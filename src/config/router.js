import { createBrowserRouter } from 'react-router-dom';
import { Home } from '../views/Home';
import { BiblePage } from '../views/bible/BiblePage';
import { PoetryPage } from '../views/PoetryPage';

export const router = createBrowserRouter([
    {
      path: "/",
      element: <Home />,
    },
    {
        path: '/bible',
        element: <BiblePage />
    },
    {
        path: '/poetry',
        element: <PoetryPage />
    },
    {
      path: '/poetry/:id',
      element: <PoetryPage />
    }
  ]);