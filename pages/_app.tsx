// this file is used to add global css to the app, see https://nextjs.org/learn/basics/assets-metadata-css/global-styles for more details
import '../styles/global.css'
import { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
