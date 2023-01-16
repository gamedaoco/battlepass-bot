import { Battlepass, DiscordActivity, Identity, Quest, ChainStatus, CompletedQuest } from '../db';

export default async function truncate() {
  return await Promise.all(
    [
      Battlepass, DiscordActivity, Identity, Quest, ChainStatus, CompletedQuest
    ].map((model: any) => {
      model.destroy({where: {}, force: true});
    })
  );
}