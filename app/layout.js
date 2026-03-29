export const metadata = {
  title: 'MEPCO Bill Checker',
  description: 'Instantly check your MEPCO electricity bills',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
      <body>{children}</body>
    </html>
  )
}
