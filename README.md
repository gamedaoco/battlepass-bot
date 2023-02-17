# Battlepass Bot

## Components
Service consists of few components, which are required for it to properly operate.
* Discord tracking process - monitors and stores the activity in the Discord guilds;
* Twitter tracking process - monitors and stores the activity in the Twitter;
* Chain integration process - checks battlepass status changes, on-chain activities;
* Aggregation process - collects all gathered activities, analyzes them and assigns points to the users for completed quests;
* API - provides access to manage battlepass quests and receive information about users progress, like completed quests and earned points.


## Running the service
Before running make sure all required configs are provided.

### Directly on server
Make sure to compile the project before executing any of the commands (or tests) via `npx tsc`.
* `npm run-script discord` - starts service, which keeps track of discord activity;
* `npm run-script twitter` - starts service, which keeps track of twitter activity;
* `npm run-script chain` - starts service, which keeps track of on-chain activity and battlepass status changes;
* `npm run-script api` - starts API server;
* `npm run-script service` - starts aggregations service, which keeps track of completed quests;

### With docker-compose
1. Build image to use
   ```bash
   docker build . -t battlepass-bot:local
   ```
2. Update docker-compose with env variables `DISCORD_BOT_KEY`, `TWITTER_BEARER_TOKEN`, `GRAPH_URL`, `CHAIN_RPC_URL`
3. Run compose services
   ```bash
   docker-compose up
   ```

## Configuration
All settings provided with env variables.  
Variables, market with `*` are required and service wouldn't operate properly without them.  
There are few categories of configs, which are applied to one/multiple processes of the service.
#### General
* `LOGGING_LEVEL` - specify which log level to use, all logs which are lower will be ignored. Possible options are `debug`, `info`, `warn`, `error`;
* `LOGGING_JSON` - should logs be stored in JSON format or not. Useful for storing and analyzing logs with additional tools.
* `DATABASE_URL` - access to database, e.g. `postgres://user:pass@example.com:5432/dbname`;
#### Discord
* `*DISCORD_BOT_KEY` - bot key to connect to discord guild and track progress. Bot should be added to guild before that.
* `DISCORD_FETCH_MESSAGES_SINCE` - specify time (in days), since which discord messages should be synced. All messages, which are older then this value, will be skipped. Default value is `2`.
#### Twitter
* `*TWITTER_BEARER_TOKEN` - bearer token of the active application to access Twitter API.
#### Chain
* `*CHAIN_RPC_URL` - chain node URL. It will be used to track chain events, such as battlepass status updates or user activities.
* `*GRAPH_URL` - graph URL. It will be used to fetch initial battlepass objects.
#### Aggregation
* `QUEST_CHECK_FREQUENCY` - how often completed quests should be evaluated. Default value is `60`, meaning every minute.
#### API
* `API_PORT` - which port to use to run API on, e.g. `8080`.
* `API_SECRET_KEY` - secret key to use to access the API. If not specified, API will be accessible without auth.
* `API_GRAPHQL_UI` - add UI features for GraphQL.


## Testing
To run tests, execute.
```bash
npm test
```

## API service
API is provided as GraphQL service with number of available query and mutation methods.  
Queries allow to fetch data from the service.  
Mutations allow to interact with the application and change its state.

### Available mutations

#### Save identity
Store identity, which is associated with discord id, twitter id and chain address.  
All values are optional but at least one should be specified.  
It is possible to update the identity by providing same field with additional ones.  
For example, if identity was saved only with discord earlier, it can be updated by providing same discord and additional fields.  
Input parameters:
* `discord` - user discord ID (not nickname/username, digits format);
* `twitter` - user twitter ID (not nickname/username, digits format);
* `address` - user on-chain wallet address;
* `email` - optional user email;
* `name` - optional user display name;
* `cid` - optional content id for IPFS object, associated with the account.

Request example:
```gql
mutation Mutation {
  identity(
    discord: "819274758560135164",
    twitter: "2764942166287669366",
    address: null,
    name: "John",
    email: "john@zero.io",
    cid: null
  ) {
    ...returned fields...
  }
}
```

Response example:
```json
{
  "data": {
    "BattlepassIdentity": {
      "id": 128,
      "uuid": "d9c931e6-2ea0-4934-ac64-3e21e7f72474",
      "discord": "819274758560135164",
      "twitter": "2764942166287669366",
      "address": null,
      "name": "John",
      "email": "john@zero.io",
      "cid": null
    }
  }
}
```

#### Save quest
Save new quest, which may be used in battleground to earn points and win rewards.  
Input parameters:
* `battlepass` - battlepass id (hash), as stored on the chain;
* `name` - quest name or title;
* `description` - additional quest description;
* `cid` - content id on IPFS, associated with the quest;
* `source` - which source quest applies to: `discord`, `twitter` or `gamedao`;
* `quantity` - how many times activity should be perfromed to complete quest (for example, send `100` messages to complete);
* `points` - specify amount of points, which will be received by completing the quest;
* `daily` - boolean flag, indicating if quest is available for daily completion (`true`) or it's a one-time action (`false`);
* `maxDaily` - if quest is daily, specify amount of times it can be completed per day;
* `type` - which quest type is it, or which action should be performed to complete the quest.
  There are few types, which can be used, depending on the `source` value.
  If source is `discord`, next types are available:
  - `connect` - connect your discord account to the battlepass identity;
  - `join` - join discord guild with your account;
  - `post` - post a message in discord guild or specific channel;
  For `twitter`:
  - `connect` - user should connect his twitter account;
  - `tweet` - user should post a tweet with specific details;
  - `retweet` - user should retweet tweet of the specific user;
  - `follow` - user to follow specific twitter account;
  - `comment` - user to comment tweet of specific twitter account;
  - `like`  - user to like tweets of specific twitter account;
Discord quests specific fields:
* `channelId` - specifies specific channel it applies to. If not provided, activity in all channels counts;
Twitter quests specific fields:
* `twitterId` - twitter account, which users need to follow/like/retweet/comment to complete the quest;
* `hashtag` - for tweet quests, specific hashtag to be present in a tweet message.

Request example:
```gql
mutation Mutation {
  quest(
    battlepass: "111111111111111111111111111111111111111111111111111111111111111111",
    daily: false,
    source: "discord",
    type: "connect",
    quantity: 1,
    points: 1000,
    name: "Connect your Discord account",
    description: null,
    cid: null
  ) {
    ...returned fields...
  }
}
```

Response example:
```json
{
  "data": {
    "BattlepassQuest": {
        "id": 1,
        "battlepassId": 1,
        "name": "Connect your Discord account",
        "description": null,
        "cid": null,
        "repeat": false,
        "source": "discord",
        "type": "connect",
        "channelId": null,
        "hashtag": null,
        "twitterId": null,
        "quantity": 1,
        "points": 1000,
        "maxDaily": null
    }
  }
}
```

#### Add battlepass participant
Allows to add users to existing battlepass if they don't have chain address specified.  
In this case, they need to provide either discord or twitter handle.  
Endpoint: `/api/participant`.  
Method: `POST`.  
Format: `json`.  
Request data: 
* `battlepass` - battlepass id (hash), as stored on the chain;
* `discord` - user discord handle, optional;
* `twitter` - user twitter handle, optional.

Request example:
```json
{
  "battlepass": "111111111111111111111111111111111111111111111111111111111111111111",
  "discord": "333333333333",
  "twitter": "444444444444"
}
```

Response example:
```json
 {
    "success": true,
    "identity": {
      "id": 1,
      "discord": "333333333333",
      "twitter": "444444444444",
      "updatedAt": "2023-01-01T00:05:10.000Z",
      "createdAt": "2023-01-01T00:05:10.000Z"
    }
}
```

#### Get quests
Request list of all quests for given battlepass.  
Endpoint: `/api/quests`.  
Method: `GET`.  
Params:
* `battlepass` - chain id (hash) of the battlepass, required.

Request example: 
```
/api/quest?battlepass=111111111111111111111111111111111111111111111111111111111111111111
```

Response example:
```json
{
  "success":true,
  "quest":{
    "battlepass": "111111111111111111111111111111111111111111111111111111111111111111",
    "daily":true,
    "source":"discord",
    "type":"post",
    "quantity":100,
    "points":5000,
    "maxDaily":10
  }
}
```

#### Get completed quests
Request list of all completed quests for given battlepass.  
Every record contains identity fields `discord` and `address`.  
Endpoint: `/api/completed-quest`.  
Method: `GET`.  
Params: 
* `battlepass` - chain id (hash) of the battlepass, required;
* `since` - filter completed quests by time, returning only the ones which updated after this value (date in ISO format);
* `address` - filter results by specific chain address.

Request example: 
```
/api/completed-quest?battlepass=111111111111111111111111111111111111111111111111111111111111111111
```

Response example:
```json
{
  "success": true,
  "quests": [
    {
      "questId": 1,
      "discord": "111111111111111",
      "address": "111111111111111111111111111111111111111111111111",
      "count": 1,
      "points": 1000
    },
    {
      "questId": 1,
      "discord": "222222222222222",
      "address": "222222222222222222222222222222222222222222222222",
      "count": 1,
      "points": 1000
    },
    {
      "questId": 2,
      "discord": "111111111111111",
      "address": "111111111111111111111111111111111111111111111111",
      "count": 3,
      "points": 1500
    },
    {
      "questId": 2,
      "discord": "222222222222222",
      "address": "222222222222222222222222222222222222222222222222",
      "count": 1,
      "points": 500
    }
  ]
}
```


#### Get earned points
Request earned points for given battlepass.  
Every record contains identity fields `discord` and `address`.  
Endpoint: `/api/points`.  
Method: `GET`.  
Params:
* `battlepass` - chain id (hash) of the battlepass, required;
* `since` - filter completed quests by time, returning only the ones which updated after this value (date in ISO format);
* `address` - filter results by specific chain address.

Request example: 
```
/api/points?battlepass=111111111111111111111111111111111111111111111111111111111111111111&since=2023-01-01T00:03:10Z
```

Response example:
```json
{
  "success": true,
  "points": [
    {
      "discord": "111111111111111",
      "address": "111111111111111111111111111111111111111111111111",
      "quests": 4,
      "points": 2500
    },
    {
      "discord": "222222222222222",
      "address": "222222222222222222222222222222222222222222222222",
      "quests": 2,
      "points": 1500
    }
  ]
}
```

### Generating API token
Once API secret key is provided (via `API_SECRET_KEY` config), you will need to generate JWT token, which can be used in order to access the API.
It can be done by running the script:
```bash
npm run-script generate-api-key
```
Note that env variable should be specified before executing.
Output will contain token value, which can be used in requests to the API in form of header `Authorization: Bearer ...`.