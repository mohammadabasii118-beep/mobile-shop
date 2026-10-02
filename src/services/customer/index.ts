import { getDb, nextId } from "@/database/store";
import type { Customer } from "@/types";

export const listCustomers = () => getDb().customers;

export function createCustomer(input: { name: string; username: string; phone?: string }) {
  const c: Customer = {
    id: nextId("cu"), name: input.name, username: input.username, phone: input.phone ?? "—",
    lastContact: new Date().toISOString(), orders: 0, totalSpent: 0, tags: [], status: "New",
  };
  getDb().customers.unshift(c);
  return c;
}
