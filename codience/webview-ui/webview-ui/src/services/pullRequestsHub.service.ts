import * as signalR from "@microsoft/signalr";

const PULL_REQUESTS_HUB_URL = "http://localhost:5051/hubs/pullrequests";

export type PullRequestCreatedHandler = (payload: unknown) => void;

export type PullRequestsHubRegistration = {
  userId: string;
  owner: string;
  repo: string;
};

export const subscribeToPullRequestCreated = async (
  registration: PullRequestsHubRegistration,
  onCreated: PullRequestCreatedHandler,
): Promise<() => void> => {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(PULL_REQUESTS_HUB_URL)
    .withAutomaticReconnect()
    .build();

  connection.on("PullRequestCreated", onCreated);

  await connection.start();

  console.log(connection.connectionId, "Connected to PullRequestsHub");
  
  await connection.invoke(
    "RegisterRepository",
    registration.userId,
    registration.owner,
    registration.repo,
  );

  return () => {
    connection.off("PullRequestCreated", onCreated);
    void connection.stop();
  };
};
