FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm install && npm run build
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/game.db
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
