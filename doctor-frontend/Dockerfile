FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build for production
RUN npm run build

# To serve in production, we could use nginx. 
# But for development/testing inside Docker:
CMD ["npm", "run", "dev", "--", "--host"]
