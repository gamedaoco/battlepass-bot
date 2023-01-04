#### Save identity
Store identity, which is associated with discord id, twitter id and chain address.

Request example:
```
POST /api/identity 
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

Request example:
```
POST /api/quest
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

Request example: 
`GET /api/completed-quest?battlepass=111111111111111111111111111111111111111111111111111111111111111111`

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
Request earned points for given battlepass. Can be filtered by last update time.

Request example: 
`GET /api/points?battlepass=111111111111111111111111111111111111111111111111111111111111111111&since=2023-01-01T00:03:10Z`

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
