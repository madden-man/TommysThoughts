// react-calendar ships untranspiled ESM that react-scripts' jest can't parse;
// it's irrelevant to routing, so stub it out.
jest.mock('react-calendar', () => ({
    __esModule: true,
    default: () => null,
    Calendar: () => null,
}));

import { router } from './router';
import { QuestionsPage } from '../views/questions/QuestionsPage';

describe('router', () => {
    it('registers /questions with the QuestionsPage', () => {
        const route = router.routes.find((r) => r.path === '/questions');

        expect(route).toBeDefined();
        expect(route.element.type).toBe(QuestionsPage);
    });
});
