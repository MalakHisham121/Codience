export const getUserRepo = () => {
  const userName = localStorage.getItem("User");
  const repoName = localStorage.getItem("RepoName");

  if (!userName || !repoName) {
    throw new Error("Username or repository name not found in local storage.");
  }

  return { userName, repoName };
};

export const getBusinessImpactConfig = () => {
  const jiraApiToken = (localStorage.getItem("JiraAccessToken") ?? "").trim();
  const jiraCloudId = (localStorage.getItem("JiraCloudId") ?? "").trim();
  const jiraProjectKey = (localStorage.getItem("JiraProjectKey") ?? "").trim();

  if (!jiraApiToken || !jiraCloudId || !jiraProjectKey) {
    throw new Error("Jira configuration is missing from local storage.");
  }

  return {
    jira_api_token: jiraApiToken,
    jira_cloud_id: jiraCloudId,
    jira_project_key: jiraProjectKey,
  };
};

export const withOneRetry = async <T>(request: () => Promise<T>): Promise<T> => {
  try {
    return await request();
  } catch (firstError) {
    return await request().catch((secondError) => {
      throw secondError ?? firstError;
    });
  }
};
