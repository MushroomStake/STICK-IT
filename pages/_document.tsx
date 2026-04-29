import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Favicon and touch icons using project logo */}
          <link rel="icon" href="/assets/StickIT.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/assets/StickIT.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/assets/StickIT.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/assets/StickIT.png" />
          <meta name="theme-color" content="#ffffff" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
