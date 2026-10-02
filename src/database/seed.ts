import { placeholderImage } from "@/lib/placeholder";
import type {
  ActivityLog, AISettings, AppNotification, AppSettings, Automation, AutomationExecution, Comment,
  Conversation, Customer, InstagramPost, Product, Story, TelegramChannelInfo, TelegramPost,
  TelegramToInstagramOptions,
} from "@/types";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export const PRODUCT_ICONS: Record<string, string> = {
  "قاب آیفون": "📱", "قاب سامسونگ": "📲", "گلس": "🛡️", "شارژر": "🔌", "کابل": "🔗", "هندزفری": "🎧",
};

export function buildSeed() {
  const products: Product[] = [
    { id: "p1", name: "قاب آیفون 17 Pro سیلیکونی", sku: "CL-IP17P-SIL", category: "قاب آیفون", price: 890_000, stock: 42, status: "active" },
    { id: "p2", name: "قاب آیفون 17 Pro شفاف مگسیف", sku: "CL-IP17P-MAG", category: "قاب آیفون", price: 1_290_000, stock: 18, status: "active" },
    { id: "p3", name: "قاب سامسونگ S25 Ultra", sku: "CL-S25U-ARM", category: "قاب سامسونگ", price: 780_000, stock: 25, status: "active" },
    { id: "p4", name: "گلس آیفون 17 Pro فول‌کاور", sku: "CL-GL-IP17P", category: "گلس", price: 320_000, stock: 120, status: "active" },
    { id: "p5", name: "شارژر سریع 45 وات", sku: "CL-CH-45W", category: "شارژر", price: 1_150_000, stock: 9, status: "active" },
    { id: "p6", name: "کابل تایپ‌سی به لایتنینگ", sku: "CL-CB-CL1", category: "کابل", price: 280_000, stock: 0, status: "out_of_stock" },
    { id: "p7", name: "هندزفری بلوتوثی ایرپاد‌طرح", sku: "CL-HF-BT7", category: "هندزفری", price: 1_890_000, stock: 14, status: "active" },
    { id: "p8", name: "قاب سامسونگ A56 چرمی", sku: "CL-A56-LTH", category: "قاب سامسونگ", price: 560_000, stock: 0, status: "draft" },
  ];

  const telegramPosts: TelegramPost[] = [
    { id: "tg1", title: "قاب آیفون 17 Pro مگسیف", caption: "قاب شفاف مگسیف آیفون 17 Pro ✨ قیمت: 1,290,000 تومان", imageUrl: placeholderImage("📱", 0, "iPhone 17 Pro"), mediaType: "photo", date: ago(95), views: 3120, status: "published", price: 1_290_000 },
    { id: "tg2", title: "شارژر سریع 45 وات", caption: "شارژر 45 وات اصلی ⚡ ارسال فوری", imageUrl: placeholderImage("🔌", 3, "Charger 45W"), mediaType: "video", date: ago(60 * 9), views: 2410, status: "published", price: 1_150_000 },
    { id: "tg3", title: "گلس فول‌کاور", caption: "گلس فول‌کاور با ضمانت تعویض 🛡️", imageUrl: placeholderImage("🛡️", 1, "Glass"), mediaType: "photo", date: ago(60 * 26), views: 1985, status: "published", price: 320_000 },
  ];

  const igBase: Omit<InstagramPost, "id">[] = [
    { caption: "قاب آیفون 17 Pro مگسیف ✨ #caseline #iphone17", imageUrl: placeholderImage("📱", 0, "iPhone 17 Pro"), kind: "post", likes: 842, comments: 31, date: ago(88), status: "published", source: "telegram", telegramPostId: "tg1" },
    { caption: "شارژر سریع 45 وات ⚡ #caseline", imageUrl: placeholderImage("🔌", 3, "Charger"), kind: "reel", likes: 1210, comments: 54, date: ago(60 * 9 - 6), status: "published", source: "telegram", telegramPostId: "tg2" },
    { caption: "گلس فول‌کاور 🛡️", imageUrl: placeholderImage("🛡️", 1, "Glass"), kind: "post", likes: 503, comments: 12, date: ago(60 * 26), status: "published", source: "telegram", telegramPostId: "tg3" },
    { caption: "کالکشن جدید قاب سامسونگ S25 🔥", imageUrl: placeholderImage("📲", 2, "Galaxy S25"), kind: "post", likes: 377, comments: 9, date: ago(60 * 50), status: "published", source: "manual" },
    { caption: "پست زمان‌بندی‌شده: تخفیف آخر هفته 🎁", imageUrl: placeholderImage("🎁", 4, "Weekend Sale"), kind: "post", likes: 0, comments: 0, date: ago(-60 * 20), status: "scheduled", source: "manual" },
    { caption: "هندزفری بلوتوثی - انتشار ناموفق", imageUrl: placeholderImage("🎧", 5, "Headphones"), kind: "post", likes: 0, comments: 0, date: ago(60 * 70), status: "failed", source: "telegram" },
  ];
  const instagramPosts: InstagramPost[] = igBase.map((p, i) => ({ id: `ig${i + 1}`, ...p }));

  const stories: Story[] = [
    { id: "st1", label: "iPhone 17 Pro", imageUrl: placeholderImage("📱", 0, "Story"), status: "published", publishedAt: ago(87), source: "telegram", views: 1240 },
    { id: "st2", label: "Charger", imageUrl: placeholderImage("🔌", 3, "Story"), status: "published", publishedAt: ago(60 * 9), source: "telegram", views: 980 },
    { id: "st3", label: "Weekend sale", imageUrl: placeholderImage("🎁", 4, "Story"), status: "published", publishedAt: ago(60 * 12), source: "manual", views: 760 },
    { id: "st4", label: "Next drop", imageUrl: placeholderImage("✨", 5, "Story"), status: "scheduled", publishedAt: ago(-60 * 3), source: "manual", views: 0 },
  ];

  const commentRows: [string, string, string, Comment["status"], string?][] = [
    ["ali123", "قیمت این قاب چنده؟", "ig1", "new"],
    ["sara.m", "رنگ مشکی هم دارید؟", "ig1", "new"],
    ["mehdi_tech", "ارسال به شیراز چند روزه؟", "ig2", "new"],
    ["negar.s", "موجوده؟", "ig3", "replied", "سلام 🌹 بله موجود هست، برای سفارش دایرکت بدید."],
    ["reza_k", "عالیه 😍", "ig1", "resolved"],
    ["parisa_n", "شارژرش اصل هست؟", "ig2", "new"],
    ["hamid77", "تخفیف نداره؟", "ig4", "ignored"],
    ["Zahra.d", "گلس برای سامسونگ هم دارید؟", "ig3", "new"],
    ["amir_gh", "قیمت هندزفری؟", "ig6", "new"],
    ["maryam.r", "ممنون، دریافت کردم 🙏", "ig1", "resolved"],
  ];
  const comments: Comment[] = commentRows.map(([username, text, postId, status, reply], i) => ({
    id: `c${i + 1}`, username, text, postId, createdAt: ago(5 + i * 17), status,
    aiSuggestion: "سلام 🌹 ممنون از پیام شما. برای اطلاعات دقیق‌تر لطفاً دایرکت بدید.", reply,
  }));

  const customerRows: [string, string, string, number, number, string[], Customer["status"]][] = [
    ["علی رضایی", "ali123", "0912 345 6789", 6, 7_400_000, ["قاب", "گلس"], "VIP"],
    ["سارا محمدی", "sara.m", "0935 222 1100", 1, 890_000, ["قاب آیفون"], "New"],
    ["مهدی کریمی", "mehdi_tech", "0919 876 5432", 3, 2_950_000, ["شارژر"], "Returning"],
    ["نگار صفوی", "negar.s", "0912 777 6655", 2, 1_100_000, [], "Returning"],
    ["رضا کاظمی", "reza_k", "0933 444 3322", 9, 12_300_000, ["عمده", "VIP"], "VIP"],
    ["پریسا نوری", "parisa_n", "0901 111 2233", 0, 0, ["سرنخ"], "New"],
    ["حمید رحیمی", "hamid77", "0912 000 9988", 1, 320_000, [], "New"],
    ["زهرا داودی", "Zahra.d", "0938 565 4545", 4, 3_600_000, ["سامسونگ"], "Returning"],
    ["امیر قاسمی", "amir_gh", "0921 909 0909", 0, 0, ["سرنخ"], "New"],
    ["مریم رستمی", "maryam.r", "0911 232 3232", 5, 5_200_000, ["VIP"], "VIP"],
    ["کیان احمدی", "kian.a", "0910 818 1818", 2, 1_780_000, [], "Returning"],
    ["نیلوفر شمس", "niloo_sh", "0936 727 2727", 1, 560_000, [], "New"],
  ];
  const customers: Customer[] = customerRows.map(([name, username, phone, orders, totalSpent, tags, status], i) => ({
    id: `cu${i + 1}`, name, username, phone, orders, totalSpent, tags, status, lastContact: ago(10 + i * 95),
  }));

  const convoRows: [number, boolean, boolean, [Conversation["messages"][number]["from"], string][]][] = [
    [0, true, true, [["customer", "سلام قاب آیفون 17 پرو دارید؟"], ["bot", "سلام 🌹 بله، چند مدل موجود داریم."], ["customer", "قیمتش چنده؟"], ["bot", "قیمت مدل‌های موجود از 890 هزار تومان شروع میشه."]]],
    [1, false, true, [["customer", "سلام، ارسال دارید؟"], ["bot", "سلام 🌹 بله به سراسر ایران ارسال داریم."]]],
    [2, false, true, [["customer", "شارژر 45 وات موجوده؟"], ["bot", "بله موجود هست، 1,150,000 تومان."], ["customer", "ممنون، سفارش میدم"]]],
    [4, true, false, [["customer", "سفارش عمده برای 30 عدد قاب دارم"], ["admin", "سلام آقا رضا، الان قیمت عمده رو می‌فرستم."]]],
    [5, false, true, [["customer", "کابل تایپ‌سی دارید؟"], ["bot", "متاسفانه فعلاً ناموجود هست. می‌خواید موجود شد خبرتون کنیم؟"]]],
    [7, false, false, [["customer", "گلس سامسونگ S25 چنده؟"]]],
    [9, true, false, [["customer", "سفارشم رسید، ممنون 🙏"], ["admin", "خواهش می‌کنم مریم جان 🌹"]]],
    [10, false, true, [["customer", "ساعت کاری شما چیه؟"], ["bot", "ما هر روز از 10 صبح تا 10 شب پاسخگو هستیم 🌹"]]],
  ];
  const conversations: Conversation[] = convoRows.map(([ci, important, aiHandled, msgs], i) => ({
    id: `cv${i + 1}`, customerId: customers[ci].id, important, aiHandled,
    unread: !aiHandled && msgs[msgs.length - 1][0] === "customer" ? 1 + (i % 2) : 0,
    lastAt: ago(3 + i * 41),
    messages: msgs.map(([from, text], j) => ({ id: `m${i}-${j}`, from, text, at: ago(3 + i * 41 + (msgs.length - j) * 2) })),
  }));

  const options: TelegramToInstagramOptions = {
    publishPost: true, publishStory: true, publishReel: true, copyCaption: true, aiCaption: true, addHashtags: true, notifyAdmin: true,
  };

  const automations: Automation[] = [
    { id: "a1", key: "tg-ig-post", name: "Telegram → Instagram Post", description: "Receives every new Telegram channel post and publishes it to Instagram according to your settings.", trigger: "New Telegram post", action: "Publish Instagram post", status: "active", lastRun: ago(88), successRate: 96, runs: 128,
      steps: [{ kind: "trigger", label: "New Telegram Post", detail: "@caseline channel" }, { kind: "condition", label: "Post contains media", detail: "photo or video" }, { kind: "action", label: "Generate Caption", detail: "AI caption + hashtags" }, { kind: "action", label: "Publish Instagram Post" }, { kind: "action", label: "Publish Instagram Story" }, { kind: "action", label: "Notify Admin" }] },
    { id: "a2", key: "tg-ig-story", name: "Telegram → Instagram Story", description: "Publishes Telegram posts as Instagram Stories.", trigger: "New Telegram post", action: "Publish Instagram story", status: "active", lastRun: ago(88), successRate: 98, runs: 121,
      steps: [{ kind: "trigger", label: "New Telegram Post" }, { kind: "condition", label: "Post contains media" }, { kind: "action", label: "Resize for 9:16" }, { kind: "action", label: "Publish Instagram Story" }] },
    { id: "a3", key: "comment-ai", name: "New Comment → AI Reply", description: "Automatically replies to new comments.", trigger: "New Instagram comment", action: "AI reply", status: "active", lastRun: ago(12), successRate: 91, runs: 342,
      steps: [{ kind: "trigger", label: "New Instagram Comment" }, { kind: "condition", label: "Not spam" }, { kind: "action", label: "AI analyzes comment" }, { kind: "action", label: "Generate reply" }, { kind: "action", label: "Send reply" }] },
    { id: "a4", key: "dm-ai", name: "New DM → AI Reply", description: "Replies to customer DMs using your store information.", trigger: "New Instagram DM", action: "AI reply", status: "active", lastRun: ago(7), successRate: 89, runs: 517,
      steps: [{ kind: "trigger", label: "New Instagram DM" }, { kind: "condition", label: "AI enabled" }, { kind: "action", label: "Read product catalog" }, { kind: "action", label: "Generate reply" }, { kind: "action", label: "Send DM" }] },
    { id: "a5", key: "keyword-dm", name: "Keyword Comment → DM", description: "When a comment contains “price”, sends the price by DM.", trigger: "Comment contains keyword", action: "Send DM", status: "paused", lastRun: ago(60 * 30), successRate: 94, runs: 63,
      steps: [{ kind: "trigger", label: "New Instagram Comment" }, { kind: "condition", label: "Contains «قیمت»" }, { kind: "action", label: "Send Direct Message" }] },
    { id: "a6", key: "new-customer", name: "New Customer → Notify Admin", description: "Notifies the admin when a new customer sends a first message.", trigger: "New customer", action: "Notify admin", status: "active", lastRun: ago(60 * 3), successRate: 100, runs: 41,
      steps: [{ kind: "trigger", label: "New Customer" }, { kind: "action", label: "Create customer profile" }, { kind: "action", label: "Notify Admin" }] },
  ];

  const executions: AutomationExecution[] = Array.from({ length: 10 }, (_, i) => {
    const a = automations[i % automations.length];
    const failed = i === 6;
    return { id: `ex${i + 1}`, automationId: a.id, status: failed ? "failed" : "success", startedAt: ago(10 + i * 70), durationMs: 900 + i * 230, summary: failed ? "Instagram media upload timed out" : `${a.name} completed` };
  });

  const logRows: [string, ActivityLog["status"], string, string][] = [
    ["telegram.post", "success", "Telegram Post Received", "@caseline · قاب آیفون 17 Pro"],
    ["ai.caption", "success", "AI Caption Generated", "Persian caption + 6 hashtags"],
    ["instagram.post", "success", "Instagram Post Published", "Post ig1"],
    ["instagram.story", "success", "Instagram Story Published", "Story st1"],
    ["instagram.comment", "info", "New Comment Received", "@ali123"],
    ["ai.reply", "success", "AI Reply Sent", "Comment c4"],
    ["instagram.dm", "info", "New Instagram DM", "@sara.m"],
    ["ai.reply", "warning", "AI couldn't answer customer", "Product not in catalog"],
    ["automation.run", "success", "Automation Executed", "New DM → AI Reply"],
    ["customer.new", "info", "New Customer", "niloo_sh"],
    ["instagram.post", "error", "Instagram Post Failed", "Media upload timed out"],
    ["system", "info", "Demo data loaded", "Seed complete"],
  ];
  const logs: ActivityLog[] = Array.from({ length: 20 }, (_, i) => {
    const [type, status, title, details] = logRows[i % logRows.length];
    return { id: `l${i + 1}`, at: ago(2 + i * 13), type, status, title, details };
  });

  const notifications: AppNotification[] = [
    { id: "n1", level: "success", title: "Instagram post published", at: ago(88), read: false },
    { id: "n2", level: "success", title: "Telegram post received", at: ago(95), read: false },
    { id: "n3", level: "warning", title: "AI couldn't answer customer", at: ago(130), read: false },
    { id: "n4", level: "warning", title: "Instagram connection expires in 3 days", at: ago(60 * 5), read: false },
    { id: "n5", level: "info", title: "New customer: niloo_sh", at: ago(60 * 7), read: true },
    { id: "n6", level: "success", title: "Story published", at: ago(60 * 9), read: true },
    { id: "n7", level: "warning", title: "Instagram post failed to publish", at: ago(60 * 70), read: true },
    { id: "n8", level: "info", title: "Weekly report is ready", at: ago(60 * 80), read: true },
  ];

  const channel: TelegramChannelInfo = { name: "CaseLine", username: "@caseline", status: "connected", members: 8421 };

  const aiSettings: AISettings = {
    enabled: true, tones: ["friendly", "persian"], businessName: "CaseLine", businessType: "فروش لوازم جانبی موبایل",
    workingHours: "10:00 - 22:00", autoReply: true,
    rules: ["قیمت را از دیتابیس بخوان", "اگر محصول موجود نبود حدس نزن", "اگر اطلاعات کافی نداری از مشتری سؤال بپرس", "پاسخ‌ها کوتاه باشند", "فارسی صحبت کن", "لحن دوستانه باشد"],
  };

  const settings: AppSettings = {
    appName: "Social Manager", demoMode: true, language: "fa", timezone: "Asia/Tehran", notifyEmail: true, notifyPush: false, twoFactor: false,
    instagram: { account: "@caseline.official", businessAccountId: "17841400000000000", accessToken: "DEMO_FAKE_TOKEN_EAAG1234567890abcdef", webhook: "verified" },
    telegram: { botToken: "0000000000:DEMO_FAKE_TOKEN_aBcDeFgHiJkLmNoPqRsTuV", channel: "@caseline", webhook: "verified" },
  };

  return {
    products, telegramPosts, instagramPosts, stories, comments, customers, conversations, automations, executions,
    logs, notifications, channel, aiSettings, settings, options,
    stats: { followers: 12842, members: 8421, published: 186 },
  };
}

export type SeedData = ReturnType<typeof buildSeed>;
