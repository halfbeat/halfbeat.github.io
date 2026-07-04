const fs = require('fs');
const path = require('path');

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const BLOG_BASE_URL = 'https://halfbeat.github.io';

async function getExistingArticles() {
  const response = await fetch('https://dev.to/api/articles/me/all?per_page=100', {
    headers: { 'api-key': DEVTO_API_KEY }
  });
  return response.json();
}

async function publishArticle(article) {
  const response = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'api-key': DEVTO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ article })
  });
  return response.json();
}

async function updateArticle(id, article) {
  const response = await fetch(`https://dev.to/api/articles/${id}`, {
    method: 'PUT',
    headers: {
      'api-key': DEVTO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ article })
  });
  return response.json();
}

function parseFrontmatter(content) {
  const tomlMatch = content.match(/^\+\+\+([\s\S]*?)\+\+\+/);
  const yamlMatch = content.match(/^---([\s\S]*?)---/);
  
  let frontmatter = {};
  let body = content;

  if (tomlMatch) {
    const toml = tomlMatch[1];
    frontmatter.title = (toml.match(/title\s*=\s*['"](.+?)['"]/) || [])[1];
    frontmatter.draft = toml.includes('draft = true');
    frontmatter.tags = (toml.match(/tags\s*=\s*\[([^\]]+)\]/) || [])[1]
      ?.split(',').map(t => t.trim().replace(/['"]/g, ''));
    body = content.slice(tomlMatch[0].length).trim();
  } else if (yamlMatch) {
    const yaml = yamlMatch[1];
    frontmatter.title = (yaml.match(/title:\s*['"]?(.+?)['"]?\n/) || [])[1];
    frontmatter.draft = yaml.includes('draft: true');
    frontmatter.tags = (yaml.match(/tags:\s*\[([^\]]+)\]/) || [])[1]
      ?.split(',').map(t => t.trim().replace(/['"]/g, ''));
    body = content.slice(yamlMatch[0].length).trim();
  }

  return { frontmatter, body };
}

async function main() {
  const postsDir = path.join(process.cwd(), 'content/posts');
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== '_index.md');
  
  const existing = await getExistingArticles();

  for (const file of files) {
    const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    if (frontmatter.draft) {
      console.log(`Skipping draft: ${file}`);
      continue;
    }

    const slug = file.replace('.md', '');
    const canonicalUrl = `${BLOG_BASE_URL}/posts/${slug}/`;

    const article = {
      title: frontmatter.title,
      body_markdown: body,
      published: true,
      canonical_url: canonicalUrl,
      tags: frontmatter.tags || []
    };

    const existingArticle = existing.find(a => a.canonical_url === canonicalUrl);

    if (existingArticle) {
      console.log(`Updating: ${frontmatter.title}`);
      await updateArticle(existingArticle.id, article);
    } else {
      console.log(`Publishing: ${frontmatter.title}`);
      await publishArticle(article);
    }
  }
}

main().catch(console.error);
