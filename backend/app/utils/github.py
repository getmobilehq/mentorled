import httpx
from typing import Optional, Dict, Any
import logging
import re

logger = logging.getLogger(__name__)

class GitHubHelper:
    """
    Helper class for analyzing GitHub repositories.
    This is a simple implementation - can be enhanced with GitHub API.
    """

    @staticmethod
    def extract_username_and_repo(github_url: str) -> Optional[tuple[str, str]]:
        """
        Extract username and repo name from GitHub URL.

        Args:
            github_url: GitHub repository URL

        Returns:
            Tuple of (username, repo) or None if invalid
        """
        pattern = r'github\.com/([^/]+)/([^/]+)'
        match = re.search(pattern, github_url)
        if match:
            return match.group(1), match.group(2).replace('.git', '')
        return None

    @staticmethod
    async def get_repo_info(github_url: str) -> Optional[Dict[str, Any]]:
        """
        Get basic repository information.

        Args:
            github_url: GitHub repository URL

        Returns:
            Dict with repo info or None if failed
        """
        repo_info = GitHubHelper.extract_username_and_repo(github_url)
        if not repo_info:
            return None

        username, repo = repo_info

        try:
            async with httpx.AsyncClient() as client:
                # Public API - no auth needed for public repos
                response = await client.get(
                    f"https://api.github.com/repos/{username}/{repo}",
                    headers={"Accept": "application/vnd.github.v3+json"},
                    timeout=10.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "name": data.get("name"),
                        "description": data.get("description"),
                        "language": data.get("language"),
                        "stars": data.get("stargazers_count", 0),
                        "forks": data.get("forks_count", 0),
                        "open_issues": data.get("open_issues_count", 0),
                        "created_at": data.get("created_at"),
                        "updated_at": data.get("updated_at"),
                        "size": data.get("size", 0),
                        "has_readme": data.get("has_wiki", False)
                    }
                else:
                    logger.warning(f"GitHub API returned {response.status_code} for {github_url}")
                    return None
        except Exception as e:
            logger.error(f"Failed to fetch GitHub repo info: {e}")
            return None

    @staticmethod
    async def get_commit_count(github_url: str) -> int:
        """
        Get commit count for a repository.

        Args:
            github_url: GitHub repository URL

        Returns:
            Number of commits or 0 if failed
        """
        repo_info = GitHubHelper.extract_username_and_repo(github_url)
        if not repo_info:
            return 0

        username, repo = repo_info

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://api.github.com/repos/{username}/{repo}/commits",
                    headers={"Accept": "application/vnd.github.v3+json"},
                    timeout=10.0
                )

                if response.status_code == 200:
                    commits = response.json()
                    return len(commits)
                else:
                    return 0
        except Exception as e:
            logger.error(f"Failed to fetch commit count: {e}")
            return 0

    @staticmethod
    def analyze_github_url(github_url: Optional[str]) -> Dict[str, Any]:
        """
        Simple synchronous analysis of GitHub URL format.

        Args:
            github_url: GitHub URL or None

        Returns:
            Dict with analysis results
        """
        if not github_url:
            return {
                "valid": False,
                "has_github": False,
                "analysis": "No GitHub URL provided"
            }

        repo_info = GitHubHelper.extract_username_and_repo(github_url)
        if not repo_info:
            return {
                "valid": False,
                "has_github": True,
                "analysis": "Invalid GitHub URL format"
            }

        username, repo = repo_info
        return {
            "valid": True,
            "has_github": True,
            "username": username,
            "repo": repo,
            "analysis": f"Valid GitHub repo: {username}/{repo}"
        }

github_helper = GitHubHelper()
