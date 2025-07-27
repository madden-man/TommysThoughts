import { createBrowserRouter } from 'react-router-dom';
import { Home } from '../views/Home';
import { BiblePage } from '../views/bible/BiblePage';
import { BingoPage } from '../views/bingo/BingoPage';
import { PoetryPage } from '../views/PoetryPage';
import { NotFoundPage } from '../views/NotFoundPage';
import { ProjectsPage } from '../views/ProjectsPage';
import { DartWallPage } from '../views/darts/DartWallPage';
import { NeighborhoodPage } from '../views/neighborhoods/NeighborhoodPage';

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
        path: '/bingo',
        element: <BingoPage />
    },
    {
      path: '/darts',
      element: <DartWallPage />
    },
    {
        path: '/poetry',
        element: <PoetryPage />
    },
    {
      path: '/poetry/:id',
      element: <PoetryPage />
    },
    {
      path: '/earth',
      element: <ProjectsPage />
    },
    {
      path: '/neighborhoods',
      element: <NeighborhoodPage />
    },
    {
      path: '*',
      element: <NotFoundPage />
    }
  ]);