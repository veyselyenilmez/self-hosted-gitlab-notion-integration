import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
import { Client } from "@notionhq/client"
dotenv.config()

// Initialize the GitLab API
const gitlabUrl = process.env.GITLAB_URL
const gitlabToken = process.env.GITLAB_TOKEN
const projectIds = process.env.PROJECT_IDS.split(',')

// Initialize the Notion API
const notion = new Client({ auth: process.env.NOTION_TOKEN })
const databaseId = process.env.NOTION_DATABASE_ID  // replace with your database ID

// Fetch all pages from the Notion database
notion.databases.query({ database_id: databaseId })
  .then(pages => {
    // Convert the list of pages into a map where the key is the GitLab issue ID and the value is the Notion page ID
    let pageMap = {};
    pages.results.forEach(page => {
      let gitlabIssueId = page.properties['gitlabIssueId'].number;
      !!gitlabIssueId ? pageMap[gitlabIssueId] = page.id : null
    });

    // Fetch the issues from GitLab for each project
    projectIds.forEach(projectId => {
      const issuesEndpoint = `${gitlabUrl}/api/v4/projects/${projectId}/issues`
      fetch(issuesEndpoint, { headers: { "Private-Token": gitlabToken } })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch issues from GitLab: ${response.status}`)
          }
          return response.json()
        })
        .then(issues => {
          // Iterate over the issues and put them into the Notion database
          issues.forEach(issue => {
            if (issue.id in pageMap) {
              // If the issue already exists in Notion, update the existing page
              notion.pages.update({
                page_id: pageMap[issue.id],
                properties: {

                  'Task name': {
                    title: [
                      {
                        text: {
                          content: issue.title,
                        },
                      },
                    ],
                  },
                  'Description': {
                    rich_text: [
                      {
                        text: {
                          content: issue.description,
                        },
                      },
                    ],
                  },
                  'Due': {
                    date: {
                      start: issue.due_date || issue.created_at,
                    },
                  },
                },
              });
            } else {
              // If the issue doesn't exist in Notion, create a new page
              notion.pages.create({
                parent: { database_id: databaseId },
                properties: {

                  'Task name': {
                    title: [
                      {
                        text: {
                          content: issue.title,
                        },
                      },
                    ],
                  },
                  'Description': {
                    rich_text: [
                      {
                        text: {
                          content: issue.description,
                        },
                      },
                    ],
                  },
                  'Due': {
                    date: {
                      start: issue.due_date || issue.created_at,
                    },
                  },
                  'gitlabIssueId': {
                    number: issue.id,
                  },
                },
              });
            }
          });
        })
        .catch(error => console.error(error));
    });
  })
  .catch(error => console.error(error));
