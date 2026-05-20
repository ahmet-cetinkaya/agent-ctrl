export function createInvalidGitUrlError(ref: string, cause?: string): Error {
  const baseMessage = `Invalid git skill URL: "${ref}".`;
  const hint = `Expected format: git:https://github.com/owner/repo/tree/main/path/to/skill`;
  const causeSuffix = cause ? `\nCause: ${cause}` : "";
  return new Error(`${baseMessage}${causeSuffix}\n\n${hint}`);
}

export function createGitHubRepoNotAccessibleError(owner: string, repo: string, cause?: string): Error {
  const baseMessage = `GitHub repository "${owner}/${repo}" could not be accessed.`;
  const hint = `Verify the repository exists and is publicly accessible.`;
  const causeSuffix = cause ? `\nCause: ${cause}` : "";
  return new Error(`${baseMessage}${causeSuffix}\n\n${hint}`);
}

export function createSkillMdNotFoundError(path: string): Error {
  return new Error(
    `SKILL.md not found at path "${path}".\n\n` +
      `Hint: A valid skill must include a SKILL.md file at the specified path.`
  );
}

export function createGitCloneFailedError(repoUrl: string, cause?: string): Error {
  const baseMessage = `Failed to clone repository "${repoUrl}".`;
  const hint = `Ensure git is installed and the repository is accessible.`;
  const causeSuffix = cause ? `\nCause: ${cause}` : "";
  return new Error(`${baseMessage}${causeSuffix}\n\n${hint}`);
}

export function createGitNotInstalledError(): Error {
  return new Error(
    `git is not installed or not found in PATH.\n\n` + `Hint: Install git to use skills from non-GitHub providers.`
  );
}
