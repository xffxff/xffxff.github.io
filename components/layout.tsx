import Head from 'next/head'
import Link from 'next/link'

export const siteTitle = '日拱一卒'

export default function Layout({
  children,
  home
}: {
  children: React.ReactNode
  home?: boolean
}) {
  return (
  // margin: 3rem auto 6rem;
    <div className="max-w-4xl px-4 mt-12 mb-24 mx-auto">
      <Head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/github.min.css"></link>
      </Head>
      <main>{children}</main>
      {!home && (
        <div className="mt-12">
          <Link href="/">
            ← 返回首页
          </Link>
        </div>
      )}
    </div>
  )
}
