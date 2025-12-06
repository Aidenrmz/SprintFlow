import express, { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { seedDemoData } from "../utils/demoData"

const router = express.Router()

router.post("/login", async (_req: Request, res: Response) => {
  if (process.env.DEMO_MODE !== "true") return res.sendStatus(404)

  const secretKey = process.env.JWT_SECRET_KEY
  if (!secretKey) return res.status(500).json("Demo authentication is not configured.")

  try {
    const user = await seedDemoData()
    const token = jwt.sign(user, secretKey, { expiresIn: process.env.TOKEN_EXPIRATION_TIME || "24h" })
    res.status(200).json(token)
  } catch {
    res.status(500).json("Unable to start demo session.")
  }
})

export default router
