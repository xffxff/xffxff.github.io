import Head from 'next/head'
import Layout, { siteTitle } from '../components/layout'
import { getSortedPostsData } from '../lib/posts'
import Link from 'next/link'
import Date from '../components/date'
import { GetStaticProps } from 'next'

export default function Home({
  allPostsData
}: {
  allPostsData: {
    date: string
    title: string
    id: string
  }[]
}) {
  return (
    <Layout home>
      <Head>
        <title>{siteTitle}</title>
      </Head>
      <section className="text-xl leading-normal pt-1 flex flex-col items-center">
        <div>
          <h2 className="text-2xl leading-normal my-4 font-bold tracking-wider">日拱一卒</h2>
          <ul className="m-0 p-0">
            {allPostsData.map(({ id, date, title }) => (
              <li className="mb-5 list-none p-0" key={id}>
                <Link href={`/posts/${id}`} className="text-blue-500">
                  {title}
                </Link>
                <br />
                <small className="text-gray-500">
                  <Date dateString={date} />
                </small>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const allPostsData = getSortedPostsData()
  return {
    props: {
      allPostsData
    }
  }
}
