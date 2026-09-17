# Un solo contenedor: API Express + frontend Vite compilado.
# Node 22+ es obligatorio (node:sqlite). El host inyecta PORT.
FROM node:22-bookworm-slim

WORKDIR /app

# Instalar con NODE_ENV distinto de production para incluir Vite (build).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# Volumen persistente: montar en /data y definir DATABASE_PATH=/data/noches.db
RUN mkdir -p /data

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    DATABASE_PATH=/data/noches.db

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Render/Railway asignan PORT; no hardcodear el puerto de escucha en CMD.
CMD ["npm", "start"]
