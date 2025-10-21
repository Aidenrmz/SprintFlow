import mongoose from "mongoose"

const mongoUri = process.env.MONGO_URI as string

const connectDB = async () => {
  try {
    await mongoose.connect(mongoUri)
    console.info("Connected to database.")
  } catch (error) {
    console.error("Cannot connect to database.", error)
    process.exit(1)
  }
}

export default connectDB
