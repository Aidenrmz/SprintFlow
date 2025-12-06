import { MongoMemoryServer } from "mongodb-memory-server"
import mongoose from "mongoose"
import { seedDemoData } from "../utils/demoData"

const run = async () => {
  process.env.PORT = process.env.PORT || "8000"
  process.env.DEMO_MODE = "true"
  process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "demo-secret-key-for-screenshots"
  process.env.TOKEN_EXPIRATION_TIME = process.env.TOKEN_EXPIRATION_TIME || "24h"
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "demo"
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "demo"
  process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://127.0.0.1:5173/callback"

  const mongoServer = await MongoMemoryServer.create()
  process.env.MONGO_URI = mongoServer.getUri()

  const app = require("../app").default
  await mongoose.connect(process.env.MONGO_URI)
  await seedDemoData()

  const server = app.listen(process.env.PORT, () => {
    console.info(`SprintFlow demo API listening on port ${process.env.PORT}.`)
  })

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect()
      await mongoServer.stop()
      process.exit(0)
    })
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect()
  process.exit(1)
})
