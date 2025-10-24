import express, { Request, Response } from "express"
import { z } from "zod"
import mongoose from "mongoose"
import verifySchema from "../middlewares/verifySchema"
import verifyToken from "../middlewares/verifyToken"
import { Ticket, TicketType } from "../models/Ticket"

const router = express.Router()
const { ObjectId } = mongoose.Types
const ObjectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value))

const getIdValue = (value: any): string | undefined => {
  if (!value) return undefined
  if (typeof value === "string") return value
  if (value._id) return String(value._id)
  return String(value)
}

const canAccessTicket = (user: any, ticket: any): boolean => {
  const ticketOwnerId = getIdValue(ticket.createdBy)
  const ticketCompanyId = getIdValue(ticket.company)
  const userCompanyId = getIdValue(user.company)
  return ticketOwnerId === user._id || (user.isAdmin && ticketCompanyId === userCompanyId)
}

const MessageSchema = z.object({
  date: z.date().default(() => new Date()),
  user: ObjectIdSchema,
  message: z.string().trim().min(1),
})
type MessageType = z.infer<typeof MessageSchema>

const TicketSchema = z.object({
  createdBy: ObjectIdSchema,
  subject: z.string().trim().min(1),
  company: ObjectIdSchema,
  description: z.string().trim().optional(),
  priority: z.enum(["low", "medium", "high"]).default("low"),
  status: z.enum(["open", "pending", "closed"]).default("open"),
  messages: z.array(MessageSchema).default([])
})
type NewTicketType = z.infer<typeof TicketSchema>

const TicketUpdateSchema = z.object({
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["open", "pending", "closed"]).optional(),
})
type TicketUpdateType = z.infer<typeof TicketUpdateSchema>

router.get("/", verifyToken, async (req: Request, res: Response) => {
  const user = res.locals.user
  const limit = Math.max(parseInt(req.query.limit as string) || 0, 0)
  const page = Math.max(parseInt(req.query.page as string) || 1, 1)
  const skip = limit > 0 ? (page - 1) * limit : 0

  let findQuery: any = { createdBy: user._id }
  if (user.isAdmin) findQuery = { company: user.company._id }
  const userTickets = await Ticket.find(findQuery).skip(skip).limit(limit).populate("createdBy").populate("company").populate({ path: "messages.user", select: "_id name avatar" }).sort({ createdAt: -1 })
  
  const totalCount = await Ticket.countDocuments(findQuery)
  const totalPages = limit > 0 ? Math.ceil(totalCount / limit) : 1
  return res.status(200).json({ tickets: userTickets, page, totalPages, totalCount })
})

router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  const id = req.params.id
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(422).json("Please provide correct id.")
  const foundTicket = await Ticket.findById(id).populate("createdBy").populate("company").populate(({ path: "messages.user", select: "_id name avatar" }))
  if (!foundTicket) return res.sendStatus(404)
  if (!canAccessTicket(res.locals.user, foundTicket)) return res.sendStatus(403)
  res.status(200).json(foundTicket)
})

router.post("/", verifyToken, verifySchema(TicketSchema), async (req: Request, res: Response) => {
  const data = req.body as NewTicketType
  const user = res.locals.user
  if (data.createdBy !== user._id || data.company !== getIdValue(user.company)) return res.sendStatus(403)
  const ticketData: TicketType = {
    ...data,
    createdBy: new ObjectId(data.createdBy),
    company: new ObjectId(data.company),
    messages: data.messages.map((message) => ({ ...message, user: new ObjectId(message.user) }))
  }
  const createdTicket = await Ticket.create<TicketType>(ticketData)
  res.status(201).json(createdTicket._id)
})

router.put("/:id", verifyToken, verifySchema(TicketUpdateSchema), async (req: Request, res: Response) => {
  const id = req.params.id
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(422).json("Please provide correct id.")
  const data = req.body as TicketUpdateType
  const foundTicket = await Ticket.findById(id)
  if (!foundTicket) return res.sendStatus(404)
  if (!canAccessTicket(res.locals.user, foundTicket)) return res.sendStatus(403)
  const updatedTicket = await Ticket.findByIdAndUpdate(id, { $set: { ...data } }, { new: true }).populate("createdBy").populate("company").populate(({ path: "messages.user", select: "_id name avatar" }))
  res.status(200).json(updatedTicket)
})

router.put("/:id/messages", verifyToken, verifySchema(MessageSchema), async (req: Request, res: Response) => {
  const id = req.params.id
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(422).json("Please provide correct id.")
  const user = res.locals.user
  if (req.body.user !== user._id) return res.sendStatus(403)
  const message = req.body as MessageType
  const foundTicket = await Ticket.findById(id)
  if (!foundTicket) return res.sendStatus(404)
  if (!canAccessTicket(user, foundTicket)) return res.sendStatus(403)
  const updatedTicket = await Ticket.findByIdAndUpdate(id, { $push: { messages: message } }, { new: true }).populate("createdBy").populate("company").populate(({ path: "messages.user", select: "_id name avatar" }))
  res.status(200).json(updatedTicket)
})

router.delete("/:id", verifyToken, async (req: Request, res: Response) => {
  const id = req.params.id
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(422).json("Please provide correct id.")
  const foundTicket = await Ticket.findById(id)
  if (!foundTicket) return res.sendStatus(404)
  if (!canAccessTicket(res.locals.user, foundTicket)) return res.sendStatus(403)
  await Ticket.findByIdAndDelete(id)
  res.status(200).json("Ticket has been deleted successfully.")
})

export default router
