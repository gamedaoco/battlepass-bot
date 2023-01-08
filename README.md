# Battlepass Bot

## Components
Service consists of few components, which are required for it to properly operate.
* Discord tracking process - monitors and stores the activity in the Discord guilds;
* Chain tracking process - checks battlepass status changes, on-chain activities;
* Aggregation process - collects all gathered activities, analyzes them and assigns points to the users for completed quests;
* API - provides access to manage battlepass quests and receive information about users progress, like completed quests and earned points.


## Running the service
Before running make sure all required configs are provided.

### Directly on server
Make sure to compile the project before executing any of the commands (or tests) via `npx tsc`.
* `npm run-script discord` - starts service, which keeps track of discord activity;
* `npm run-script chain` - starts service, which keeps track of on-chain activity and battlepass status changes;
* `npm run-script api` - starts API server;
* `npm run-script service` - starts aggregations service, which keeps track of completed quests;

### With docker-compose
1. Build image to use
   ```bash
   docker build . -t battlepass-bot:local
   ```
2. Update docker-compose with env variables `DISCORD_BOT_KEY`, `GRAPH_URL`, `CHAIN_RPC_URL`
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
* `LOGGING_JSON` - should logs be stored in JSON format or not. Useful 
* `DATABASE_URL` - access to database, e.g. `postgres://user:pass@example.com:5432/dbname`;
#### Discord
* `*DISCORD_BOT_KEY` - bot key to connect to discord guild and track progress. Bot should be added to guild before that.
#### Chain
* `*CHAIN_RPC_URL` - chain node URL. It will be used to track chain events, such as battlepass status updates or user activities.
* `*GRAPH_URL` - graph URL. It will be used to fetch initial battlepass objects.
#### Aggregation
* `QUEST_CHECK_FREQUENCY` - how often completed quests should be evaluated. Default value is `60`, meaning every minute.
#### API
* `API_PORT` - which port to use to run API on, e.g. `8080`.


## Testing
To run tests, execute.
```bash
npm test
```

## API endpoints

#### Save identity
Store identity, which is associated with discord id, twitter id and chain address.  
All values are optional but at least one should be specified.  
It is possible to update the identity by providing same field with additional ones.  
For example, if identity was saved only with discord earlier, it can be updated by providing same discord and additional fields.  
Endpoint: `/api/identity`.  
Method: `POST`.  
Format: `json`.  
Request data:
* `discord` - user discord ID (not nickname/username, digits format);
* `twitter` - user twitter ID;
* `address` - user on-chain wallet address.  

Request example:
```json
{
	"discord": "111111111111111111"
}
```

Response example:
```json
{
  "success": true,
  "identity": {
    "id": 1,
    "discord": "111111111111111111",
    "updatedAt": "2023-01-04T14:19:40.343Z",
    "createdAt": "2023-01-04T14:19:40.343Z"
  }
}
```

#### Save quest
Save new quest, which may be used in battleground to earn points and win rewards.  
Endpoint: `/api/quest`.  
Method: `POST`.  
Format: `json`.  
Request data:
* `battlepass` - battlepass id (hash), as stored on the chain;
* `daily` - boolean flag, indicating if quest is available for daily completion (`true`) or it's a one-time action (`false`).
* `source` - which source quest applies to: `discord`, `twitter` or `gamedao`;
* `type` - type of the action to complete quest: `post` - post a message, `reaction` - leave a reaction;
* `channelId` - for quests in discord this value specifies specific channel it applies to. If not provided, activity in all channels counts;
* `quantity` - how many times activity should be perfromed to complete quest (for example, send `100` messages to complete);
* `points` - specify amount of points, which will be received by completing the quest;
* `maxDaily` - if quest is daily, specify amount of times it can be completed per day.

Request example:
```json
{
  "success": true,
  "quest": {
    "battlepass": "111111111111111111111111111111111111111111111111111111111111111111",
    "daily": false,
    "source": "discord",
    "type": "post",
    "quantity": 100,
    "points": 5000
  }
}
```

Response example:
```json
{
  "success": true,
  "quest": {
    "id": 1,
    "BattlepassId": 1,
    "repeat": false,
    "source": "discord",
    "type": "post",
    "quantity": 100,
    "points": 5000,
    "updatedAt": "2023-01-04T14:50:03.168Z",
    "createdAt": "2023-01-04T14:50:03.168Z"
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

