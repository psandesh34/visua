import { Order } from "../models/orderModel";

export async function deleteOrders(userId: string) {
    //todo:  Add a check if userId exists once userId table is added.
    const result = await Order.deleteMany({ userId });
    return result;
}