FROM node:lts

WORKDIR /app
COPY src /app/src
COPY *.json /app/
COPY jest.config.js /app/

RUN npm install
RUN npx tsc
CMD ["npm", "run-script", "api"]
