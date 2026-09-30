-- Default items of the mobile side-menu (editable in /admin/menus → "موبایل"). Inserted only when that menu has no rows yet.
INSERT INTO "MenuItem" ("id", "menu", "label", "link", "isActive", "sortOrder")
SELECT gen_random_uuid()::text, 'mobile', v.label, v.link, true, v.ord
FROM (VALUES ('ورود / ثبت‌نام', '/account', 0), ('فروشگاه', '/shop', 1), ('وبلاگ', '/blog', 2), ('پشتیبانی', '/support', 3)) AS v(label, link, ord)
WHERE NOT EXISTS (SELECT 1 FROM "MenuItem" WHERE "menu" = 'mobile');
