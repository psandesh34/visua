import holdingRoutes from "./holdingRoutes";
import tradebookRoutes from "./portfolioRoutes";

export default (router) => {
  tradebookRoutes(router);
  holdingRoutes(router);
};