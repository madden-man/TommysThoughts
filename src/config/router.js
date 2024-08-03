import { createBrowserRouter } from 'react-router-dom';
import { Home } from '../views/Home';
import { BiblePage } from '../views/bible/BiblePage';

export const router = createBrowserRouter([
    {
      path: "/",
      element: <Home />,
    },
    {
        path: '/bible',
        element: <BiblePage />
    }
  ]);