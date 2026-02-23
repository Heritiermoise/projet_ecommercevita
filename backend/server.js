import dotenv from 'dotenv'
import app from './index.js'

dotenv.config()

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
