import { getProviders } from "@/services/providers";

export const getChannel = () => getProviders().telegram.getChannel();
export const listTelegramPosts = () => getProviders().telegram.listPosts();
