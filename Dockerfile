# to build on apple silicone use
# DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build -t battlepass-bot:local .
FROM --platform=linux/amd64 node:lts-alpine
# FROM node:lts-alpine

RUN apk add --no-cache --virtual python make g++
RUN apk add --no-cache --virtual .gyp

WORKDIR /app
COPY . .

RUN npm install && apk del .gyp
# RUN npm run build

CMD ["npm", "run-script", "api"]
