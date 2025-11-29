import mongoose from "mongoose"
import { Company } from "../models/Company"
import { Ticket } from "../models/Ticket"
import { User } from "../models/User"

const { ObjectId } = mongoose.Types

export const DEMO_USER_ID = new ObjectId("65f1234567890abcdef12345")
const DEMO_COMPANY_ID = new ObjectId("65f1234567890abcdef12340")
const DEMO_AGENT_ID = new ObjectId("65f1234567890abcdef12346")
const DEMO_ENGINEER_ID = new ObjectId("65f1234567890abcdef12347")
const DEMO_PRODUCT_ID = new ObjectId("65f1234567890abcdef12348")

const demoUserIds = [DEMO_USER_ID, DEMO_AGENT_ID, DEMO_ENGINEER_ID, DEMO_PRODUCT_ID]

const dateFromNow = (daysAgo: number, hour: number, minute = 0): Date => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date
}

const normalizeUser = (user: any) => {
  const company = user.company
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone,
    company: company
      ? {
          _id: String(company._id),
          name: company.name,
          admins: (company.admins || []).map((admin: unknown) => String(admin))
        }
      : undefined,
    isAdmin: true
  }
}

export const getDemoSessionUser = async () => {
  const user = await User.findById(DEMO_USER_ID).select("-sub").populate("company").lean()
  if (!user) throw new Error("Demo user was not seeded.")
  return normalizeUser(user)
}

export const seedDemoData = async () => {
  await Ticket.deleteMany({ company: DEMO_COMPANY_ID })
  await Company.deleteOne({ _id: DEMO_COMPANY_ID })
  await User.deleteMany({ _id: { $in: demoUserIds } })

  const company = await Company.create({
    _id: DEMO_COMPANY_ID,
    name: "Northstar Labs",
    admins: [DEMO_USER_ID, DEMO_AGENT_ID]
  })

  await User.insertMany([
    {
      _id: DEMO_USER_ID,
      sub: "demo-user",
      name: "Maya Patel",
      email: "maya@sprintflow.app",
      avatar: "avatar01",
      phone: "+14165550124",
      company: company._id
    },
    {
      _id: DEMO_AGENT_ID,
      sub: "demo-agent",
      name: "Noah Kim",
      email: "noah@sprintflow.app",
      avatar: "avatar06",
      phone: "+14165550143",
      company: company._id
    },
    {
      _id: DEMO_ENGINEER_ID,
      sub: "demo-engineer",
      name: "Iris Chen",
      email: "iris@sprintflow.app",
      avatar: "avatar09",
      phone: "+14165550167",
      company: company._id
    },
    {
      _id: DEMO_PRODUCT_ID,
      sub: "demo-product",
      name: "Jon Rivera",
      email: "jon@sprintflow.app",
      avatar: "avatar12",
      phone: "+14165550188",
      company: company._id
    }
  ])

  await Ticket.insertMany([
    {
      _id: new ObjectId("65f1234567890abcdef12401"),
      createdBy: DEMO_PRODUCT_ID,
      company: company._id,
      subject: "Checkout users cannot upload receipts",
      description: "Receipt attachments fail after the confirmation modal closes.",
      priority: "high",
      status: "open",
      messages: [
        { user: DEMO_PRODUCT_ID, message: "The finance team can reproduce this on Chrome and Edge.", date: dateFromNow(5, 10, 12) },
        { user: DEMO_AGENT_ID, message: "I pulled logs and the upload token is expiring before the modal completes.", date: dateFromNow(5, 11, 4) }
      ],
      createdAt: dateFromNow(5, 10),
      updatedAt: dateFromNow(1, 15, 30)
    },
    {
      _id: new ObjectId("65f1234567890abcdef12402"),
      createdBy: DEMO_USER_ID,
      company: company._id,
      subject: "Mobile dashboard cards overlap",
      description: "Statistic cards overlap chart labels on 390px screens.",
      priority: "medium",
      status: "pending",
      messages: [
        { user: DEMO_USER_ID, message: "This appears on iPhone 13 width in Safari.", date: dateFromNow(4, 9, 20) },
        { user: DEMO_ENGINEER_ID, message: "A layout patch is ready for review.", date: dateFromNow(2, 14, 45) }
      ],
      createdAt: dateFromNow(4, 9),
      updatedAt: dateFromNow(2, 14, 45)
    },
    {
      _id: new ObjectId("65f1234567890abcdef12403"),
      createdBy: DEMO_ENGINEER_ID,
      company: company._id,
      subject: "Weekly export times out",
      description: "Exports above 10,000 rows exceed the current API timeout.",
      priority: "high",
      status: "closed",
      messages: [
        { user: DEMO_ENGINEER_ID, message: "Batching reduced the export duration to 18 seconds.", date: dateFromNow(6, 13, 15) },
        { user: DEMO_AGENT_ID, message: "Confirmed with operations. Closing this out.", date: dateFromNow(3, 16, 5) }
      ],
      createdAt: dateFromNow(6, 13),
      updatedAt: dateFromNow(3, 16, 5)
    },
    {
      _id: new ObjectId("65f1234567890abcdef12404"),
      createdBy: DEMO_USER_ID,
      company: company._id,
      subject: "Priority selector resets after refresh",
      description: "Selected priority is saved in the API but the control displays low after reload.",
      priority: "medium",
      status: "open",
      messages: [
        { user: DEMO_USER_ID, message: "The ticket detail API returns the correct priority.", date: dateFromNow(1, 8, 30) }
      ],
      createdAt: dateFromNow(1, 8),
      updatedAt: dateFromNow(1, 8, 30)
    },
    {
      _id: new ObjectId("65f1234567890abcdef12405"),
      createdBy: DEMO_PRODUCT_ID,
      company: company._id,
      subject: "Add requester phone number to ticket details",
      description: "Support agents want the requester phone number visible beside profile context.",
      priority: "low",
      status: "pending",
      messages: [],
      createdAt: dateFromNow(2, 12),
      updatedAt: dateFromNow(0, 9, 10)
    },
    {
      _id: new ObjectId("65f1234567890abcdef12406"),
      createdBy: DEMO_AGENT_ID,
      company: company._id,
      subject: "Chart totals differ from ticket list",
      description: "The total card includes closed tickets but the list filter hides them.",
      priority: "medium",
      status: "closed",
      messages: [
        { user: DEMO_AGENT_ID, message: "Updated the support note to explain the chart scope.", date: dateFromNow(3, 10, 40) }
      ],
      createdAt: dateFromNow(3, 10),
      updatedAt: dateFromNow(0, 13, 20)
    }
  ])

  return getDemoSessionUser()
}
