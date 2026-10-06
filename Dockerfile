# ساخت و اجرای فروشگاه (Next.js + SQLite)
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY --from=build /app ./
VOLUME ["/data"]
EXPOSE 3000
# اولین اجرا: داده‌ی اولیه را می‌سازد (اگر پایگاه داده پر باشد، کاری نمی‌کند) و سپس سرور را بالا می‌آورد
CMD ["sh", "-c", "npm run seed -- ${SEED_ARGS---empty} && npm start"]
