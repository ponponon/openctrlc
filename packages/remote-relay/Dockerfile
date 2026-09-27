FROM oven/bun:1.3.14-alpine

WORKDIR /app
COPY package.json ./package.json
COPY src ./src

ENV HOST=0.0.0.0
ENV PORT=4097
EXPOSE 4097
CMD ["bun", "run", "src/index.ts"]
