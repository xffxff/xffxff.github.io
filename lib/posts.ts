import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeHighlight from 'rehype-highlight'
import rehypeMermaid from 'rehype-mermaidjs'

const postsDirectory = path.join(process.cwd(), 'posts')

export function getSortedPostsData() {
  // Get file names under /posts
  const fileNames = fs.readdirSync(postsDirectory)
  const allPostsData = fileNames.map((fileName) => {
    // Remove ".md" from file name to get id
    const id = fileName.replace(/\.md$/, '')

    // Read markdown file as string
    const fullPath = path.join(postsDirectory, fileName)
    const fileContents = fs.readFileSync(fullPath, 'utf8')

    // Use gray-matter to parse the post metadata section
    const matterResult = matter(fileContents)

    // Combine the data with the id
    return {
      id,
      ...(matterResult.data as { date: string; title: string }),
    }
  })

  // Filter out posts whose title starts with "WIP"
  const filteredPostsData = allPostsData.filter(
    (post) => !post.title.startsWith('WIP'),
  )

  // Sort posts by date
  return filteredPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1
    } else {
      return -1
    }
  })
}

export function getAllPostIds() {
  const fileNames = fs.readdirSync(postsDirectory)
  return fileNames.map((fileName) => {
    return {
      params: {
        id: fileName.replace(/\.md$/, ''),
      },
    }
  })
}

export async function getPostData(id: string) {
  const fullPath = path.join(postsDirectory, `${id}.md`)
  const fileContents = fs.readFileSync(fullPath, 'utf8')

  // Use gray-matter to parse the post metadata section
  const matterResult = matter(fileContents)

  // get home directory of the user
  const homeDir = require('os').homedir();
  // FIXME: this is a hack to set the path of playwright executable. 
  // I set it explicitly here because I when I run `npx playwright install --with-deps chromium`, 
  // it installs the newest version, for now it's chromium-1080, but the code below is using chromium-1067
  // if I don't set it explicitly, it will throw an error saying that can not find the executable
  const playwrightExecutablePath = `${homeDir}/.cache/ms-playwright/chromium-1080/chrome-linux/chrome`

  // Use remark to convert markdown into HTML string
  const processedContent = await remark()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeMermaid, {
      strategy: 'img-svg',
      mermaidConfig: {
        flowchart: {
          htmlLabels: true,
        },
        securityLevel: 'loose',
      },
      launchOptions: {
        executablePath: playwrightExecutablePath
      }
    })
    .use(rehypeHighlight, { plainText: ['txt', 'text'] })
    .use(rehypeStringify)
    .process(matterResult.content)

  // Remove the space between two chinese charators
  const contentHtml = processedContent
    .toString()
    .replace(/(\p{Script=Hani})\s+(?=\p{Script=Hani})/gu, '$1')

  // Combine the data with the id and contentHtml
  return {
    id,
    contentHtml,
    ...(matterResult.data as { date: string; title: string }),
  }
}
