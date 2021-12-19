import holdingRoutes from './holdingRoutes';
import tradebookRoutes from './portfolioRoutes';
import tradeRoutes from './tradeRoutes';

export default (router) => {
	tradebookRoutes(router);
	holdingRoutes(router);
	tradeRoutes(router);
};
