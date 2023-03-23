# to build on apple silicone use
# DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build -t battlepass-bot:local .
# FROM --platform=linux/amd64 node:lts-alpine
FROM node:lts-alpine

WORKDIR /app
COPY src /app/src
COPY *.json /app/
COPY jest.config.js /app/

RUN npm install && \
    npx tsc

CMD ["npm", "run-script", "api"]
