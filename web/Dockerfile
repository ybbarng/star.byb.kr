### image: build
FROM node:19 AS build

# Install dependencies.
WORKDIR /usr/src/web
COPY package.json package-lock.json ./
RUN npm ci

# Copy all local files into the image.
COPY . .

# Build.
RUN npm run build



### image: deploy-node
FROM node:19 AS deploy-node

WORKDIR /usr/src/web
# Clean the directory.
RUN rm -rf ./*

# Copy the resources from build image.
COPY --from=build /usr/src/web/package.json .
COPY --from=build /usr/src/web/build .

# Install dependencies for production.
RUN npm install --production

# Run the node server.
CMD ["node", "index.js"]
