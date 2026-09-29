import bcrypt from "bcryptjs";

const COST = 12;
export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

let dummy: string | undefined;
/** Burns the same time as a real check so login timing does not reveal which numbers are registered. */
export async function dummyVerify(plain: string) {
  dummy ??= await bcrypt.hash("caseline-dummy-password", COST);
  await bcrypt.compare(plain, dummy);
}
