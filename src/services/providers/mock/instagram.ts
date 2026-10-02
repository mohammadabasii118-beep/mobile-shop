import type { InstagramProvider } from "../types";

const fakeId = (p: string) => `demo_${p}_${Math.random().toString(36).slice(2, 10)}`;

/** Never calls Meta. Returns fake external ids so the rest of the pipeline behaves like production. */
export class MockInstagramProvider implements InstagramProvider {
  async publishPost() { return { externalId: fakeId("media") }; }
  async publishStory() { return { externalId: fakeId("story") }; }
  async replyToComment() { return { externalId: fakeId("reply") }; }
  async sendDirectMessage() { return { externalId: fakeId("dm") }; }
}
