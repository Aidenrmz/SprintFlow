import dotenv from "dotenv"
dotenv.config()
import mongoose from "mongoose"
import { seedDemoData } from "../utils/demoData"

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required to seed demo data.")

  await mongoose.connect(process.env.MONGO_URI)
  await seedDemoData()
  await mongoose.disconnect()
  console.info("Demo data seeded.")
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect()
  process.exit(1)
})
