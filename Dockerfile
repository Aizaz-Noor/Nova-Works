FROM node:24-bookworm-slim AS frontend
WORKDIR /build/app/client
COPY app/client/package.json app/client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/client/ ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/novaworks.sqlite
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node backend/ ./
COPY --from=frontend --chown=node:node /build/app/client/dist /app/app/client/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "start"]
